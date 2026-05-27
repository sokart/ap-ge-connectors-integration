# ==============================================================================
# 🤖 ADK Space Coordinator Agent Wiring Configuration
# ==============================================================================

import logging
from google.adk.agents import Agent

from .tools import query_corporate_search_index, list_available_search_engines
from .prompts import COORDINATOR_INSTRUCTIONS

logger = logging.getLogger("SpaceHubAgent.Core")

# Define the Space Hub Coordinator Agent persona and tools mapping
# Uses gemini-2.0-flash-001 under local Vertex AI context configuration
logger.info("Initializing ADK Space Hub Coordinator Agent configuration...")

space_hub_agent = Agent(
    model='gemini-2.0-flash-001',
    name='space_hub_coordinator',
    instruction=COORDINATOR_INSTRUCTIONS,
    tools=[
        query_corporate_search_index,
        list_available_search_engines
    ]
)

logger.info("ADK Space Hub Coordinator Agent initialization complete.")
