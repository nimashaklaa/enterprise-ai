import json
from functools import lru_cache
import boto3
from app.config import settings


@lru_cache()
def client(service):
    s= settings()
    if bool(s.aws_access_key_id)!=bool(s.aws_secret_access_key):
        raise ValueError("Both AWS access key and secret key must be provided or neither.")
    options = {'region_name': s.aws_region}
    if s.aws_access_key_id and s.aws_secret_access_key:
        options.update(aws_access_key_id=s.aws_access_key_id, aws_secret_access_key=s.aws_secret_access_key)
    return boto3.client(service, **options)

# function generates vector embeddings from text using Amazon Bedrock.
def embed(text):
    body = json.dumps({'inputText': text, 'dimensions': settings().embed_dim, 'normalize': True})
    result = client('bedrock-runtime').invoke_model(modelId=settings().bedrock_embed_model, body=body)
    return json.loads(result['body'].read())['embedding']