from dataclasses import dataclass

@dataclass(frozen=True)
# @dataclass automatically writes boring boilerplate code like __init__ for you.
# frozen=True makes the object immutable (read-only). Once a Principal object is created, its values cannot be modified. 
# This is a crucial security feature so that permissions or user IDs can't accidentally (or maliciously) be altered mid-request.
class Principal:
    subject: str ='demo-operator'
    tenant: str ='demo-workspace'
    groups:tuple[str,...]=('workspace',)
    admin: bool = True


def principal()->Principal:
    return Principal()

# A principal object is a digital ID badge used by an application to represent who is making a request and 
# what permissions they have (such as their user ID, company, and access roles).