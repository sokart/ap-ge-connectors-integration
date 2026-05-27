# ==============================================================================
# 🧪 Local ADK Agent Runner Verification Test Script
# ==============================================================================

import os
import sys
import asyncio
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestADK")

# Append parent directory to sys.path to enable imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared utility parameters to resolve dynamically authenticated Project ID
# and establish standard Vertex AI SDK environment boundaries
from util import GCP_PROJECT_ID

import vertexai

# Initialize global Vertex AI sandbox variables
logger.info(f"Initializing Vertex AI SDK context. Project: {GCP_PROJECT_ID}...")
vertexai.init(project=GCP_PROJECT_ID, location="us-central1")

from google.adk.runners import InMemoryRunner
from google.genai import types
from agent import space_hub_agent

async def main():
    logger.info("Instantiating local InMemoryRunner mapping for ADK agent...")
    runner = InMemoryRunner(agent=space_hub_agent)
    
    # Pre-create the session service context to allow local run_async executions
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="test_developer_sokart",
        session_id="test_verification_session_99"
    )
    
    # Query: Hello, who are you and what tools do you have?
    prompt = "Hello! Who are you, list the available corporate search engines, and tell me what they search?"
    user_msg = types.Content(
        role="user",
        parts=[types.Part(text=prompt)]
    )
    
    logger.info(f"Submitting query prompt: '{prompt}'")
    print("\n--- AGENT SESSION STREAM START ---")
    
    events = runner.run_async(
        user_id="test_developer_sokart",
        session_id="test_verification_session_99",
        new_message=user_msg
    )
    
    # Iterate over progressive runner logs blocks
    async for event in events:
        content = getattr(event, "content", None)
        if not content:
            # Check other properties: e.g. raw function calls
            continue
            
        parts = getattr(content, "parts", [])
        for part in parts:
            part_dict = part.model_dump() if hasattr(part, "model_dump") else part
            
            if "text" in part_dict and part_dict["text"]:
                print(part_dict["text"], end="", flush=True)
                
            elif "function_call" in part_dict and part_dict["function_call"]:
                fc = part_dict["function_call"]
                print(f"\n\n[AGENT INTERMEDIATE DECISION] Tool Call triggered: {fc.get('name')}\n")
                print(f"Arguments payload: {fc.get('args')}\n")
                
    print("\n--- AGENT SESSION STREAM COMPLETE ---\n")

if __name__ == "__main__":
    asyncio.run(main())
