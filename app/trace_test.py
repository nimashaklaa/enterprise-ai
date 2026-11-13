from dotenv import load_dotenv
load_dotenv()
import os, rius
from rius import start_as_current_span

client = rius.init(service_name="atlas-trace-test", capture_content=False)
with start_as_current_span("hello-trace"):
    print("span created, key present:", bool(os.getenv("RIUS_API_KEY")))
client.flush()