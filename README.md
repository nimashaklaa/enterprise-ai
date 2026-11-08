# Enterprise AI Platform (`enterprise-ai`)

An enterprise-grade, secure, and scalable **RAG (Retrieval-Augmented Generation) & Agentic AI Platform** built with FastAPI, LangGraph, Amazon Bedrock, Pinecone, and PostgreSQL. It features robust guardrails, asynchronous document ingestion, multi-tenant user interfaces, Human-in-the-Loop (HITL) workflows, and deep observability.

---

## 🏗️ System Architecture

The architecture follows a decoupled microservices-ready pattern featuring a React/HTML frontend, FastAPI backend core running LangGraph agent workflows, asynchronous ingestion workers, and managed cloud storage/databases.

```mermaid
graph TD
    %% Users & Frontend
    User([Users / Clients]) -->|HTTPS / REST API| Frontend[Web Browser UI / React]

    %% Backend & Core
    Frontend -->|API Requests| FastAPI[FastAPI Backend Server]
    FastAPI --> LangGraph[Application Core: LangGraph Agent Workflow]

    %% LangGraph Sub-pipeline
    subgraph LangGraph Core [Application Core]
        InputG[Input Guardrails] --> Agent[LangGraph Agent Workflow]
        Agent --> Tools[Tools & Integrations]
        Agent --> OutputG[Output Guardrails]
        OutputG --> Response[Response Generation]
    end

    %% Storage & Databases & Services
    Frontend -->|Presigned URL Upload| S3[(Amazon S3 File Storage)]
    S3 --> IngestionWorker[Ingestion Worker worker/ingest.py]
    IngestionWorker -->|Store Embeddings| Pinecone[(Pinecone Vector DB)]
    IngestionWorker -->|Update Status| Postgres[(PostgreSQL Database)]
    
    Agent -->|Vector Search| Pinecone
    Agent -->|App Data & Memory| Postgres
    Agent -->|LLM Inference & Embeddings| Bedrock[Amazon Bedrock LLMs]

    %% Observability & HITL
    LangGraph -.->|Traces, Metrics, Logs| Rius[GlassFlow Rius Observability]
    Agent -.->|HITL Requests| HITL[Human-in-the-Loop Approval Flow]

```

---

## 🚀 Key Features & Components

### 1. Frontend & User Interface (`Users`)

* **Web Browser UI**: Built with React/HTML+JS supporting multi-tenant access.


* **Capabilities**: Document chat (RAG + Agentic AI), file uploads, real-time document status viewing, HITL approval dashboards, and admin metrics/logs viewing.



### 2. Backend API (`FastAPI`)

* Exposes clean REST endpoints for core operations:


* `/api/chat`: Handles conversational RAG and agent interactions.
* `/api/upload-url`: Generates presigned URLs for direct browser-to-S3 uploads.
* `/api/ingest`: Triggers document processing workflows.
* `/api/documents`: Manages document states and metadata.
* `/api/approvals`: Handles Human-in-the-Loop (HITL) request workflows.
* `/api/metrics`: Exposes system and usage metrics.



### 3. Application Core (`LangGraph Agent Workflow`)

* **Input Guardrails**: Prompt injection detection, sensitive query blocking, PII detection, and HITL action detection.


* **Agent Workflow**: Handles query understanding, multi-step retrieval, tool usage, memory persistence in PostgreSQL, and structured output generation.


* **Output Guardrails**: Sensitive information filtering, hallucination control, citation validation, and tenant-specific rules.



### 4. Storage & Ingestion Pipeline

* **Amazon S3**: Secure raw document storage with direct browser uploads via presigned URLs.


* **Ingestion Worker (`worker/ingest.py`)**: Asynchronously downloads from S3, extracts text (PDF, TXT), chunks content, generates embeddings via Amazon Titan, indexes them in Pinecone, and logs status to PostgreSQL.



### 5. Databases & LLMs

* **Pinecone Vector Database**: High-performance semantic similarity search and auto-scaling index management.


* **PostgreSQL**: Stores relational metadata including documents, chat history/memory, approval requests, feedback, audit events, and guardrail logs.


* **Amazon Bedrock**: Powers LLM reasoning and embedding generation using models like Claude, Nova, and Titan.



### 6. Observability & Governance

* **GlassFlow Rius**: Real-time tracing of LangGraph workflows, LLM token/latency tracking, error debugging, and OpenTelemetry integration.


* **Human-in-the-Loop (HITL)**: Safeguards sensitive actions (e.g., restricted file deletions or policy triggers) by routing them through administrator approval queues before execution.



---

## 🛠️ Quick Start Guide

1. **Clone the Repository**:
```bash
git clone https://github.com/nimashaklaa/enterprise-ai.git
cd enterprise-ai

```


2. **Set up Python Environment**:
```bash
python3 -m venv atlas
source atlas/bin/activate
pip install -r requirements.txt

```


3. **Configure Environment Variables**:
Copy `.env.example` to `.env` in the root directory, then replace the placeholder values with your AWS, Pinecone, PostgreSQL, and observability settings. `.env.example` lists the supported environment variables; never commit real credentials.
```env
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_KEY=your_aws_secret_key
PINECONE_API_KEY=your_pinecone_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/enterprise_ai
AWS_REGION=us-east-1
S3_BUCKET=your_s3_bucket
BEDROCK_EMBED_MODEL=your_bedrock_embedding_model_id
BEDROCK_CHAT_MODEL=your_bedrock_chat_model_id
EMBEDDING_DIMENSION=1024
PINECONE_INDEX_HOST=your_pinecone_index_host
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_READY_TIMEOUT=60
RUIS_API_KEY=your_rius_api_key
RUIS_SERVICE_NAME=enterprise-ai
RUIS_DISABLED=false
RUIS_CAPTURE_CONTENT=false

```


4. **Run the FastAPI Backend**:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000

```