import os
import logging
from functools import wraps
from dotenv import load_dotenv
import rius

log=logging.getLogger(__name__)

def initialize():
    """Call once, before instrumented app modules are loaded."""
    load_dotenv()
    if not os.getenv("RIUS_API_KEY") or os.getenv("RIUS_DISABLED", "false").lower() in ("1", "true","yes"):
        log.info("RIUS observability disabled.")
        return
    try:
        
        rius.init(service_name=os.getenv("RIUS_SERVICE_NAME", "atlas-ai-fde"), capture_content=False)
        log.info("Rius observability enabled")
    except Exception as e:
        log.exception("Rius observability failed to initialize: %s", e)

def trace(name):
    """Decorator to trace a function call with Rius observability."""
    def decorator(func):
        try:
            return rius.observe(name=name, capture_input=False, capture_output=False)(func)
        except ImportError:
            return func
    return decorator