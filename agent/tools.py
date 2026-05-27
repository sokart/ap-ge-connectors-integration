# ==============================================================================
# 🛠️ ADK Space Coordinator Agent Python Tools System
# ==============================================================================

import sys
import os
import json
import logging
import asyncio

# Append parent directory to sys.path to enable importing server primitives
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger("SpaceHubAgent.Tools")

async def query_corporate_search_index(engine_id: str, query: str) -> str:
    """Queries a specific GCP generative search assistant engine to search through local corporate documents database.
    
    Use this tool whenever you need to search document stores, look up financial results, earnings figures, 
    releases metrics, or corporate data grounded in private company assets.
    
    Args:
        engine_id: The exact ID of the search engine configuration to target (e.g., 'gemini-enterprise-e2e_1779876734248').
        query: The specific search query or comparative question to run against index documents.
        
    Returns:
        A detailed summary containing grounded facts, figures, comparison tables, and references.
    """
    logger.info(f"Executing Tool: query_corporate_search_index. Target Engine: {engine_id}, Query: {query}")
    
    # Deferred import to resolve Python startup circular loops
    from server import gcp_stream_generator
    
    try:
        accumulated_chunks = []
        
        # Consume the streaming proxy generator in real-time
        async for sse_event in gcp_stream_generator(engine_id=engine_id, query=query):
            # Transcoded SSE blocks format: "event: chunk\ndata: {...}\n\n"
            lines = sse_event.split("\n")
            event_type = "chunk"
            data_str = ""
            
            for line in lines:
                if line.startswith("event: "):
                    event_type = line.split("event: ")[1].strip()
                elif line.startswith("data: "):
                    data_str = line.split("data: ")[1].strip()
            
            # Aggregate only factual progressive text elements under "chunk" event
            if event_type == "chunk" and data_str:
                try:
                    data_json = json.loads(data_str)
                    if "text" in data_json:
                        accumulated_chunks.append(data_json["text"])
                except Exception:
                    pass
                    
        if not accumulated_chunks:
            return "Execution complete. No grounded documents records were matched for this query."
            
        final_response = "".join(accumulated_chunks)
        logger.info(f"Tool query_corporate_search_index completed. Returned {len(final_response)} characters.")
        return final_response
        
    except Exception as e:
        logger.exception("Failure encountered in query_corporate_search_index tool:")
        return f"Tool execution crashed with internal server exception: {str(e)}"


async def list_available_search_engines() -> str:
    """Discovers and lists all search and conversational engines currently configured in the active GCP project.
    
    Use this tool at the start of a session or when the user asks a query about assets you aren't sure of, 
    to see what private data indexing and engine configs are available to search.
    
    Returns:
        A JSON string containing the list of discovered engines, their IDs, display names, and connected datastore IDs.
    """
    logger.info("Executing Tool: list_available_search_engines")
    
    # Deferred import
    from server import get_engines
    
    try:
        res = await get_engines()
        engines_list = res.get("engines", [])
        formatted_json = json.dumps(engines_list, indent=2)
        logger.info(f"Tool list_available_search_engines completed. Discovered {len(engines_list)} engines.")
        return formatted_json
    except Exception as e:
        logger.exception("Failure encountered in list_available_search_engines tool:")
        return f"Tool execution failed to list engines: {str(e)}"
