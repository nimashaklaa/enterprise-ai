from app.observability import trace
from typing import TypeDict,Any
from langgraph import stateGraph, START, END
from app.aws import answer,embed
from app.vector import search
from app.config import settings



class State(TypeDict, total=False):
    question:str
