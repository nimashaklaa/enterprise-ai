import re
import uuid
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from app.observability import initialize
from app.demo_context import principal, Principal
from app.aws import client
from app.config import settings
from app.db import connection, audit
from app.rag import chat
from app.guardrails import check_input, classify_input
from app.memory import history, save_turn, list_messages
from worker.ingest import process_s3_key


initialize()

BASE= Path(__file__).resolve().parent
app=FastAPI(title='Atlas ENterprise RAG', docs_url='/api/docs')
# static: Where your CSS styles, images, and JavaScript files live.
app.mount('/static', StaticFiles(directory=BASE/'static'),name='static')
# Where your HTML web pages live.
templates=Jinja2Templates(directory=BASE/'templates')


# It acts as a gatekeeper. 
# If a user tries to send a blank file name or an absurdly long name,
# FastAPI automatically blocks it and returns an error before your code even processes it.
class Upload(BaseModel):
    filename:str = Field(min_length=1, max_length=180)

class CompleteUpload(BaseModel):
    document_id:uuid.UUID


@app.get('/', response_class=HTTPException)
def home(request: Request):
    return templates.TemplateResponse(
        'index.html',{'request': request,'region':settings().aws_region,'mode':'single-workspace demo'}
        )

@app.get('/health/live')
def live():
    return {'status':'alive'}

@app.get('health/ready')
def ready():
    try:
        with connection() as conn: conn.execute('SELECT 1').fetchone()
        return {'status':'ready'}
    except Exception as exc:
        raise HTTPException(503,'Database unavailable') from exec

@app.post('/api/documents/uploads')
def create_upload(body:Upload,p:Principal=Depends(principal) ):
    # depends-> This uses FastAPI's dependency injection system.
    # It uses Upload to make sure the filename is safe and valid.
    # It uses Principal to check who is uploading it.

    suffix=Path(body.filename).suffix.lower()
    if suffix not in {'.pdf','.docx','.txt','.md'}:
        raise HTTPException(400,'Allowed types: PDF, DOCX, TXT,MD')
    doc_id = str(uuid.uuid4())
    key=f'tenants/{p.tenant}/incoming/{doc_id}/v1{suffix}'
    with connection() as conn:
        conn.execute('''INSERT INTO documents(id,tenant_id,title,owner_sub,allowed_groups,s3_key,status,current_version)
                        VALUES (%s,%s,%s,%s,%s,%s,'pending',1)''',
                        (doc_id,p.tenant,body.filename,p.subject,["workspace"],key))
        audit(conn,p.subject,p.tenant,'upload_requested',{'document_id': doc_id})
    url=client('s3').generate_presigned_url('put_object',Params={'Bucket':settings().s3_bucket,
        'Key':key,'ContentType':'application/octet-stream'},ExpiresIn=300)
    return {'document_id':doc_id,'upload_url':url,'headers':{'Content-Type':'application/octet-stream'}}    


@app.post('/api/documents/complete')
def complete_upload(body:CompleteUpload, p:Principal=Depends(principal)):
    with connection() as conn:
        row=conn.execute("""SELECT s3_key,status FROM documents WHERE id=%s AND tenant_id=%s""",
                         (body.document_id,p.tenant)).fetchone()
    if not row: raise HTTPException(404, 'Document not found')
    if row['status']=='ready': return{'status':'ready'}
    if row['status']=='processing': raise HTTPException(409,'Already processing')
    try:
        process_s3_key(row['s3_key'])
    except Exception as exc:
        raise HTTPException(502,'Ingestion failed. Check server logs and document status.') from exec
    return{'status':'ready'}