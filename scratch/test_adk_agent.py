# ==============================================================================
# 🧠 Google Agent Development Kit (ADK) CLI Integration Test Verification
# ==============================================================================

import sys
import os
import asyncio
import logging
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestADK")

# Append parent directory to sys.path to enable imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import shared utility parameters to resolve dynamically authenticated Project ID
# and establish standard Vertex AI SDK environment boundaries
from util import GCP_PROJECT_ID

import vertexai
from google.genai import types
from google.adk.runners import InMemoryRunner
from agent import space_hub_agent

async def print_agent_events(events):
    """
    Consumes progressive runner events and parses text chunks and tool choices details live.
    """
    async for event in events:
        content = getattr(event, "content", None)
        if not content:
            continue
            
        parts = getattr(content, "parts", [])
        for part in parts:
            part_dict = part.model_dump() if hasattr(part, "model_dump") else part
            
            # 1. Text payload chunk streaming
            if "text" in part_dict and part_dict["text"]:
                print(part_dict["text"], end="", flush=True)
                
            # 2. Dynamic Tool Calling triggers warnings badges
            elif "function_call" in part_dict and part_dict["function_call"]:
                fc = part_dict["function_call"]
                print(f"\n\n[AGENT INTERMEDIATE DECISION] Tool Call triggered: {fc.get('name')}\n")
                print(f"Arguments payload: {json.dumps(fc.get('args'), indent=2)}\n")

async def main():
    logger.info("Initializing local Vertex AI SDK context...")
    
    # Dynamic model fallback checking to allow testing agent logic under GCP limits
    if space_hub_agent.model == "gemini-3.5-flash":
        logger.warning("Target agent model is configured as 'gemini-3.5-flash'.")
        logger.warning("Google Vertex AI API model version endpoint does not support it globally in this region yet.")
        logger.warning("Temporarily swapping testing sandbox context model target to 'gemini-2.0-flash-001' to verify tools choice planning and target boundaries...")
        space_hub_agent.model = "gemini-2.0-flash-001"
        
    logger.info(f"Using test-swapped model context: {space_hub_agent.model}")
    logger.info("Instantiating local InMemoryRunner mapping for ADK agent...")
    runner = InMemoryRunner(agent=space_hub_agent)
    
    # Pre-create the session service context to allow local run_async executions
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="test_developer_sokart",
        session_id="test_verification_session_99"
    )
    
    # ==========================================================================
    # 🏃‍♂️ TURN 1: Generic Welcome & Online engines discovery
    # ==========================================================================
    prompt_1 = "Hello! Who are you, list the available corporate search engines, and tell me what they search?"
    user_msg_1 = types.Content(
        role="user",
        parts=[types.Part(text=prompt_1)]
    )
    
    logger.info(f"Submitting query prompt 1: '{prompt_1}'")
    print("\n--- TURN 1 (DISCOVERY) STREAM START ---")
    
    events_1 = runner.run_async(
        user_id="test_developer_sokart",
        session_id="test_verification_session_99",
        new_message=user_msg_1
    )
    await print_agent_events(events_1)
    print("\n--- TURN 1 (DISCOVERY) STREAM COMPLETE ---\n")
    
    # ==========================================================================
    # 🏃‍♂️ TURN 2: Strict targeted datasource grounding comparison!
    # ==========================================================================
    prompt_2 = (
        "Excellent online engines indexing list. Now, please search STRICTLY and EXCLUSIVELY inside "
        "data source 'e2e-bucket_1779877581501' connected to engine 'gemini-enterprise-e2e' and compare Alphabet's revenue in Q1 2026 vs Q4 2025."
    )
    user_msg_2 = types.Content(
        role="user",
        parts=[types.Part(text=prompt_2)]
    )
    
    logger.info(f"Submitting query prompt 2: '{prompt_2}'")
    print("\n--- TURN 2 (TARGETED DATASTORE) STREAM START ---")
    
    events_2 = runner.run_async(
        user_id="test_developer_sokart",
        session_id="test_verification_session_99",
        new_message=user_msg_2
    )
    await print_agent_events(events_2)
    print("\n--- TURN 2 (TARGETED DATASTORE) STREAM COMPLETE ---\n")

if __name__ == "__main__":
    asyncio.run(main())
