import re

from httpx2 import get

from app.observability import trace
import logging
import time
from functools import lru_cache
from pinecone import Pinecone, ServerlessSpec
from app.config import settings

log = logging.getLogger(__name__)

@lru_cache()
def index():
    s = settings()
    if not s.pinecone_api_key:
        raise ValueError("Pinecone API key is not set in the .env file.")
    log.info("Connecting to Pinecone (credentials hidden)...")
    if not s.pinecone_index_name:
        raise RuntimeError("PINECONE_INDEX_NAME is missing from .env")
    pc = Pinecone(api_key=s.pinecone_api_key)
    name = s.pinecone_index_name

      # Describe rather than list: avoids listing every index and works for existing indexes.
    try:
        info = pc.describe_index(name)
    except Exception as exc:
        if getattr(exc,'status',None) != 404:
            raise
        log.info('Creating Pinecone index %s (dimension=%d, metric=cosine)', name, s.embed_dim)
        try:
            pc.create_index(name=name, dimension=s.embed_dim, metric='cosine',spec=ServerlessSpec(cloud=s.pinecone_cloud, region= s.pinecone_region))
        except Exception as create_exc:
            # Another process may have created the index concurrently
            if getattr(create_exc, 'status', None) !=409:
                raise
        info = pc.describe_index(name)
    if int(info.dimension)!=s.embed_dim:
        raise ValueError(f'Pinecone index {name} dimension={info.dimension}, expected {s.embed_dim}. '
                         'Use a different index name or matching EMBED_DIM.')
    if str(info.matric).lower()!='cosine':
        raise ValueError(f'Pinecone index {name} must use cosine metric, got {info.metric}')
    deadline = time.monotonic()+ s.pinecone_ready_timeout
    while not pc.describe_index(name).status['ready']:
        if time.monotonic()>=deadline:
            raise TimeoutError(f'Pinecone index {name} was not ready within {s.pinecone_ready_timeout}s')
        time.sleep(3)
    log.info('Pinecone index %s ready',name)
    return pc.Index(name)

def namespace(tenant):
    return 'tenant-'+tenant

@trace("upsert")
def upsert(tenant, records):
    return index().upsert(vectors= records, namespace=namespace(tenant))

# acl = access control list: only return results that are either in one of the allowed groups or owned by the user
@trace("search")
def search(tenant, vector, groups, owner, limit=5):
    acl = {'$or': [{'allowed_groups': {'$in': list(groups)}},
                   {'owner_sub': {'$eq': owner}}]}
    result = index().query(vector=vector, top_k=limit, include_metadata=True, namespace=namespace(tenant), filter=acl)
    return [{'id': m.id, 'score': m.score, 'metadata': m.metadata or {}}
            for m in result.matches]

def delete_document(tenant, doc_id):
    if doc_id is None:
        raise ValueError("doc_id must be provided for deletion.")
    return index().delete(ids=[doc_id], namespace=namespace(tenant))