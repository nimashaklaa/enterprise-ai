import json
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from app.config import settings


#psycopg3 is the modern PostgreSQL driver for Python


@contextmanager
def connection():
    url = settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is missing from .env")
    with psycopg.connect(url, row_factory=dict_row,connect_timeout=10) as conn:
        yield conn

#with is the context manager that automatically handles opening and closing the connection to the database. 
# the moment code finishes running the database query (or if an error/crash happens midway), Python automatically closes the database connection for you.
# It prevents memory leaks and connection limit errors on your PostgreSQL server.

# yeild turn the function into a generator, allowing it to produce a value (the database connection) that can be used in the context of the with statement.

# Lifecycle of the connection:
# Hand Over: yield conn passes the open connection to your API route so it can fetch data.
# Finish Route: Your API route finishes sending data back to the user.
# Clean Up: Python automatically wakes up and closes the database connection so everything stays clean and secure.


def audit(conn, actor,tenant, action, detail):
    conn.execute(
        "INSERT INTO audit (actor, tenant, action, detail) VALUES (%s, %s, %s, %s)",
        (actor, tenant, action, json.dumps(detail)),
    )   