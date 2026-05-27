import json
import logging
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import os
import vertexai
from google.adk.runners import InMemoryRunner
from google.genai import types
from agent import space_hub_agent

# Import our shared GCP Discovery Engine and streamAssist utilities (with namespace aliases)
from util import (
    credentials, 
    session, 
    GCP_PROJECT_ID, 
    get_engines as get_engines_util, 
    gcp_stream_generator
)

# Setup secure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BFF_Server")

app = FastAPI(title="Assistant Space Hub BFF")

# Add strict CORS headers - only allow self to avoid unauthorized access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Vertex AI context and ADK runner locally
adk_runner = None
if GCP_PROJECT_ID:
    os.environ["GOOGLE_CLOUD_PROJECT"] = GCP_PROJECT_ID
    os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"
    try:
        logger.info(f"Initializing Vertex AI SDK globally. Project: {GCP_PROJECT_ID}...")
        vertexai.init(project=GCP_PROJECT_ID, location="us-central1")
        
        logger.info("Instantiating local InMemoryRunner mapping for ADK Coordinator agent...")
        adk_runner = InMemoryRunner(agent=space_hub_agent)
    except Exception as exc:
        logger.error(f"Failed to initialize Vertex AI / ADK Runner context: {exc}")

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Add strict headers for anti-clickjacking and security enforcement
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self';"
    )
    return response

@app.get("/api/engines")
async def get_engines():
    """
    Discovers and lists all search and conversational engines configured in the active GCP project.
    """
    try:
        engines_data = await get_engines_util()
        return engines_data
    except Exception as e:
        logger.error(f"Failed to fetch engines list in BFF route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# The core streamAssist gcp_stream_generator is now hosted cleanly inside the shared util library!

@app.post("/api/chat")
async def chat(request: Request):
    """
    POST API that accepts target engine_id, query, and session, yielding real-time SSE.
    """
    try:
        body = await request.json()
        engine_id = body.get("engine_id")
        query = body.get("query")
        session_path = body.get("session")
        
        if not engine_id or not query:
            raise HTTPException(status_code=400, detail="engine_id and query are required parameters.")
            
        return StreamingResponse(
            gcp_stream_generator(engine_id, query, session_path),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error initiating chat streaming: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def adk_agent_stream_generator(query: str, session_id: str):
    """
    Executes the local ADK Space Coordinator Agent and transcodes its events into SSE streaming format.
    """
    if not GCP_PROJECT_ID:
        yield f"event: error\ndata: {json.dumps({'message': 'GCP authentication uninitialized'})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
        
    # Standard sanitization
    query = re.sub(r'[\r\n\t]', ' ', query).strip()
    
    # 1. Pre-create the session state locally if it is a new session
    try:
        session = await adk_runner.session_service.get_session(
            app_name=adk_runner.app_name,
            user_id="user_developer",
            session_id=session_id
        )
        if not session:
            await adk_runner.session_service.create_session(
                app_name=adk_runner.app_name,
                user_id="user_developer",
                session_id=session_id
            )
            logger.info(f"Established fresh ADK Agent session: {session_id}")
    except Exception as e:
        logger.error(f"Failed to load or establish ADK session: {e}")
        yield f"event: error\ndata: {json.dumps({'message': f'Session initialization error: {e}'})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
        
    # 2. Structure user message payload using google.genai specs
    user_msg = types.Content(
        role="user",
        parts=[types.Part(text=query)]
    )
    
    # 3. Yield mock headers metadata log immediately to terminal log
    headers_masked = {
        "Content-Type": "application/json",
        "Authorization": "Bearer [MASKED_ADK_RUNNER_CREDENTIALS]"
    }
    raw_req_metadata = {
        "method": "POST",
        "url": "http://127.0.0.1:8080/api/agent/chat (ADK Local Runner)",
        "headers": headers_masked,
        "payload": {
            "agent": "space_hub_coordinator",
            "user_id": "user_developer",
            "session_id": session_id,
            "query": query
        }
    }
    yield f"event: raw_request\ndata: {json.dumps(raw_req_metadata)}\n\n"
    
    try:
        # 4. Trigger runner stream session
        events = adk_runner.run_async(
            user_id="user_developer",
            session_id=session_id,
            new_message=user_msg
        )
        
        # 5. Consume stream events progressively
        async for event in events:
            # Yield raw chunk event to the response terminal log!
            event_dict = event.model_dump(mode="json") if hasattr(event, "model_dump") else str(event)
            yield f"event: raw_response_chunk\ndata: {json.dumps({'chunk': json.dumps(event_dict)})}\n\n"
            
            content = getattr(event, "content", None)
            if not content:
                continue
                
            parts = getattr(content, "parts", [])
            for part in parts:
                part_dict = part.model_dump() if hasattr(part, "model_dump") else part
                
                # Case A: Standard text chunk streaming
                if "text" in part_dict and part_dict["text"]:
                    yield f"event: chunk\ndata: {json.dumps({'text': part_dict['text']})}\n\n"
                    
                # Case B: Dynamic Tool call triggers! (Render as status warnings chips)
                elif "function_call" in part_dict and part_dict["function_call"]:
                    fc = part_dict["function_call"]
                    tool_name = fc.get("name", "unknown")
                    tool_args = fc.get("args", {})
                    warning_msg = f"🤖 Space Hub Coordinator: [Invoking Tool: '{tool_name}' with payload: {json.dumps(tool_args)}]"
                    yield f"event: warning\ndata: {json.dumps({'message': warning_msg})}\n\n"
                    
        # Yield metadata tracking closing block
        meta_info = {
            "session": f"projects/{GCP_PROJECT_ID}/locations/global/collections/default_collection/engines/space_hub_coordinator/sessions/{session_id}",
            "citations": []
        }
        yield f"event: metadata\ndata: {json.dumps(meta_info)}\n\n"
        yield "event: done\ndata: {}\n\n"
        
    except Exception as e:
        logger.exception("ADK stream generator failed:")
        yield f"event: error\ndata: {json.dumps({'message': f'ADK Runner Error: {str(e)}'})}\n\n"
        yield "event: done\ndata: {}\n\n"

@app.post("/api/agent/chat")
async def agent_chat(request: Request):
    """
    POST API that initiates streaming chat with the local ADK Agent, yielding real-time SSE.
    """
    try:
        body = await request.json()
        query = body.get("query")
        session_id = body.get("session_id")
        
        if not query or not session_id:
            raise HTTPException(status_code=400, detail="query and session_id are required parameters.")
            
        if not adk_runner:
            raise HTTPException(status_code=500, detail="ADK local runner context is uninitialized.")
            
        return StreamingResponse(
            adk_agent_stream_generator(query, session_id),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error initiating agent chat streaming: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static web app directory containing index.html, style.css, app.js
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    # strictly listen on 127.0.0.1 for local secure testing
    uvicorn.run(app, host="127.0.0.1", port=8080)
