import json
import logging
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import google.auth
from google.auth.transport.requests import AuthorizedSession
from google.cloud import discoveryengine_v1beta as discoveryengine

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

# Global authenticated credentials session
try:
    credentials, GCP_PROJECT_ID = google.auth.default()
    # Scopes check (optional, ADC handles standard scopes)
    session = AuthorizedSession(credentials)
    logger.info(f"Successfully authenticated server for GCP Project: {GCP_PROJECT_ID}")
except Exception as e:
    logger.error(f"Failed to initialize GCP authentication: {e}")
    GCP_PROJECT_ID = None
    session = None

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
    if not GCP_PROJECT_ID:
        raise HTTPException(status_code=500, detail="GCP Project ID not initialized. Check server authentication.")
        
    logger.info(f"Listing engines for project {GCP_PROJECT_ID}...")
    try:
        # Use discoveryengine client library to list all engines securely
        client = discoveryengine.EngineServiceClient(credentials=credentials)
        parent = f"projects/{GCP_PROJECT_ID}/locations/global/collections/default_collection"
        request = discoveryengine.ListEnginesRequest(parent=parent)
        page_result = client.list_engines(request=request)
        
        engines = []
        for res in page_result:
            # We want engines that have a default_assistant or are typical search engines
            engines.append({
                "id": res.name.split("/")[-1],
                "display_name": res.display_name,
                "solution_type": res.solution_type.name,
                "industry_vertical": res.industry_vertical.name,
                "data_store_ids": list(res.data_store_ids)
            })
            
        return {"engines": engines, "project_id": GCP_PROJECT_ID}
    except Exception as e:
        logger.error(f"Error fetching engines: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def gcp_stream_generator(engine_id: str, query: str, session_path: str = None):
    """
    Streams streamAssist REST API chunks in real-time as Server-Sent Events (SSE).
    """
    if not session or not GCP_PROJECT_ID:
        yield f"event: error\ndata: {json.dumps({'message': 'Server auth uninitialized'})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    # Escape query input strictly for safety
    query = re.sub(r'[\r\n\t]', ' ', query).strip()
    
    # Auto-discover linked data stores for dynamic grounding routing
    data_store_ids = []
    try:
        engine_client = discoveryengine.EngineServiceClient(credentials=credentials)
        engine_name = f"projects/{GCP_PROJECT_ID}/locations/global/collections/default_collection/engines/{engine_id}"
        engine_res = engine_client.get_engine(name=engine_name)
        data_store_ids = list(engine_res.data_store_ids)
        logger.info(f"Engine {engine_id} discovered linked data stores: {data_store_ids}")
    except Exception as e:
        logger.error(f"Failed to auto-discover data stores for engine {engine_id}: {e}")
        
    url = (
        f"https://discoveryengine.googleapis.com/v1beta/"
        f"projects/{GCP_PROJECT_ID}/locations/global/collections/default_collection/"
        f"engines/{engine_id}/assistants/default_assistant:streamAssist"
        f"?prettyPrint=false"
    )
    
    payload = {
        "query": {
            "text": query
        }
    }
    
    if data_store_ids:
        payload["toolsSpec"] = {
            "vertexAiSearchSpec": {
                "dataStoreSpecs": [
                    {
                        "dataStore": f"projects/{GCP_PROJECT_ID}/locations/global/collections/default_collection/dataStores/{ds_id}"
                    }
                    for ds_id in data_store_ids
                ]
            }
        }
    
    if session_path:
        # If continuing an existing conversation session
        payload["session"] = session_path
        
    logger.info(f"Initiating streamAssist session. Engine: {engine_id}, Session: {session_path}")
    
    # Mask headers securely for user raw REST log display
    headers_masked = {
        "Content-Type": "application/json",
        "Authorization": "Bearer [MASKED_GCP_BFF_TOKEN]"
    }
    raw_req_metadata = {
        "method": "POST",
        "url": url,
        "headers": headers_masked,
        "payload": payload
    }
    yield f"event: raw_request\ndata: {json.dumps(raw_req_metadata)}\n\n"
    
    try:
        # Use streaming POST request to proxy GCP response
        response = session.post(url, json=payload, stream=True)
        
        if response.status_code != 200:
            logger.error(f"GCP API returned code {response.status_code}: {response.text}")
            err_msg = "GCP Discovery Engine API error."
            try:
                err_details = response.json()
                if "error" in err_details:
                    err_msg = err_details["error"].get("message", err_msg)
            except Exception:
                pass
            yield f"event: error\ndata: {json.dumps({'message': err_msg})}\n\n"
            yield "event: done\ndata: {}\n\n"
            return
            
        citations = []
        final_session_id = None
        
        for line in response.iter_lines():
            if not line:
                continue
                
            decoded_line = line.decode('utf-8').strip()
            
            # Yield byte-for-byte compact response chunk to frontend dev console
            yield f"event: raw_response_chunk\ndata: {json.dumps({'chunk': decoded_line})}\n\n"
            
            # Standard REST transcoded stream returns an array: e.g. [{chunk1}, {chunk2}, ...]
            # We must strip array framing to parse each JSON chunk independently
            if decoded_line.startswith("["):
                decoded_line = decoded_line[1:]
            if decoded_line.endswith("]"):
                decoded_line = decoded_line[:-1]
            if decoded_line.endswith(","):
                decoded_line = decoded_line[:-1]
                
            decoded_line = decoded_line.strip()
            if not decoded_line:
                continue
                
            try:
                chunk = json.loads(decoded_line)
                
                # Check for skipped queries
                answer = chunk.get("answer", {})
                state = answer.get("state")
                
                # Handle skipped reasons
                if state == "SKIPPED":
                    reasons = answer.get("assistSkippedReasons", [])
                    yield f"event: warning\ndata: {json.dumps({'message': f'Skipped assistant response: {reasons}'})}\n\n"
                
                # Extract session info on completion
                session_info = chunk.get("sessionInfo", {})
                if session_info.get("session"):
                    final_session_id = session_info["session"]
                    
                replies = answer.get("replies", [])
                for reply in replies:
                    grounded_content = reply.get("groundedContent", {})
                    
                    # 1. Text payload chunks
                    content = grounded_content.get("content", {})
                    text_chunk = content.get("text")
                    if text_chunk:
                        # Yield immediate text chunk
                        yield f"event: chunk\ndata: {json.dumps({'text': text_chunk})}\n\n"
                        
                    # 2. Extract citations / grounding metadata to return at the end
                    metadata = grounded_content.get("textGroundingMetadata", {})
                    if metadata:
                        refs = metadata.get("references", [])
                        segments = metadata.get("segments", [])
                        if refs or segments:
                            citations.append({
                                "references": refs,
                                "segments": segments
                            })
                            
                # Yield metadata final response when done
                if state in ["SUCCEEDED", "FAILED", "SKIPPED"]:
                    metadata_payload = {
                        "state": state,
                        "session": final_session_id,
                        "citations": citations
                    }
                    yield f"event: metadata\ndata: {json.dumps(metadata_payload)}\n\n"
                    
            except Exception as e:
                logger.error(f"Error parsing line chunk: {e}. Line raw: {decoded_line[:200]}")
                # Don't fail the entire session on minor malformed array delimiters
                continue
                
        # Final done event
        yield "event: done\ndata: {}\n\n"
        
    except Exception as e:
        logger.error(f"Exception during streamAssist proxy stream: {e}")
        yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        yield "event: done\ndata: {}\n\n"

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

# Mount static web app directory containing index.html, style.css, app.js
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    # strictly listen on 127.0.0.1 for local secure testing
    uvicorn.run(app, host="127.0.0.1", port=8080)
