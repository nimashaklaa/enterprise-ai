# Enterprise AI Platform

An enterprise-grade, secure RAG and agentic AI platform for document intelligence, multi-tenant chat, policy-aware approvals, and operational observability.

This project combines a FastAPI backend, LangGraph-based reasoning flows, PostgreSQL metadata storage, Pinecone vector search, and Amazon Bedrock models into a single workspace for enterprise knowledge assistants.

## Highlights

- Document upload and ingestion pipeline for PDF, DOCX, TXT, and Markdown files
- Retrieval-augmented generation over indexed enterprise content
- Guardrails for prompt injection, sensitive output review, and blocked actions
- Human-in-the-loop approval flow for risky or policy-sensitive requests
- Multi-tenant ready architecture with audit logs and usage metrics
- Observability hooks for tracing, metrics, and debugging

## Live demo

The application is deployed on AWS: [Open the live demo](http://13.60.34.236:8000/).

## Demo gallery

<p align="center">
  <img src="./demo_results_ui/chat.png" alt="Chat interface" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/document upload.png" alt="Document upload flow" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/approval_request.png" alt="Approval request" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/guardrails_bloacked.png" alt="Guardrail blocked response" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/metrics.png" alt="Metrics dashboard" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/pinecone.png" alt="Pinecone vector index" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/s3_bucket.png" alt="S3 bucket storage" width="820" />
</p>

<p align="center">
  <img src="./demo_results_ui/db_schemas.png" alt="Database schema overview" width="820" />
</p>

## Architecture

### Platform and data flow

```mermaid
flowchart LR
    User[User / Admin] --> UI[Web UI]
    UI --> API[FastAPI API]
    API -->|Chat request| Guard[Input classification]
    Guard -->|Allowed| Agent[LangGraph RAG workflow]
    Guard -->|Sensitive action| Approval[HITL approval queue]
    UI -->|Presigned upload| S3[Amazon S3]
    S3 --> Worker[Document ingestion worker]
    Worker -->|Embeddings| Pinecone[(Pinecone)]
    Worker -->|Status and metadata| Postgres[(PostgreSQL)]
    Agent -->|Authorized semantic search| Pinecone
    Agent -->|Conversation history| Postgres
    API -->|Save turns, audit, metrics| Postgres
    Agent -.->|Traces| Rius[GlassFlow Rius]
    Approval -->|Admin review| UI
```

### LangGraph agent workflow

Each chat request first passes the API's input classification. Allowed requests enter the graph below; retrieval is tenant- and access-scoped, and generation only runs when relevant evidence is found.

```mermaid
flowchart TD
    Start((Start)) --> Guard[Input guard]
    Guard --> Retrieve[Retrieve authorized passages<br/>from Pinecone]
    Retrieve --> HasEvidence{Relevant passages found?}
    HasEvidence -->|No| NoEvidence[Return no-evidence response]
    HasEvidence -->|Yes| Generate[Generate answer with<br/>Bedrock and conversation history]
    Generate --> Validate[Output safety validation]
    Validate --> End((Return answer and citations))
    NoEvidence --> End
    Guard -.->|Tracing| Rius[GlassFlow Rius]
    Retrieve -.->|Tracing| Rius
    Generate -.->|Tracing| Rius
    Validate -.->|Tracing| Rius
```

## Core capabilities

### Secure document workflow

- Direct browser upload flow with presigned S3 URLs
- File validation for PDF, DOCX, TXT, and Markdown uploads
- Background ingestion worker to chunk and embed document content
- Per-tenant document metadata and status tracking

### RAG and agentic chat

- Query classification and guardrail checks before processing
- Semantic retrieval using Pinecone vector indexes
- Context-aware responses grounded in enterprise documents
- Conversation memory across short-turn chat sessions

### Governance and safety

- Input blocking for prompt-injection or policy-sensitive prompts
- Output guardrails to prevent leakage of sensitive data
- Approval step for risky actions such as policy updates or destructive operations
- Audit events and tenant-scoped metadata for traceability

### Observability

- Structured traces and metrics around agent execution
- LLM latency and token visibility through observability integrations
- Dashboard-friendly feedback and ingestion status reporting

## Repository structure

```text
.
├── app/
│   ├── main.py               # FastAPI application and routes
│   ├── config.py             # Environment configuration
│   ├── db.py                 # Database helpers
│   ├── rag.py                # Retrieval + chat logic
│   ├── guardrails.py         # Safety and input validation
│   ├── memory.py             # Conversation memory helpers
│   ├── aws.py                # AWS / Bedrock / S3 integration
│   ├── vector.py             # Pinecone wrapper
│   ├── observability.py      # Tracing / metrics integration
│   └── static/              # Frontend assets
├── worker/
│   └── ingest.py            # Async document ingestion job
├── infra/
│   ├── schema.sql           # PostgreSQL schema
│   └── migrations/
├── .github/
│   └── workflows/
│       └── cicd.yaml        # CI, ECR image publishing, and EC2 deployment
├── scripts/
│   └── init_db.py           # Schema initialization utility
├── demo_results_ui/         # Screenshots used in this README
├── Dockerfile               # Application container image
├── requirements.txt
├── LICENSE
└── README.md
```

## CI/CD deployment on AWS

The GitHub Actions workflow at `.github/workflows/cicd.yaml` builds and deploys the application as a Docker container on an EC2 instance:

1. **Continuous integration:** On a GitHub-hosted Ubuntu runner, installs Python 3.11 and checks Python syntax with `compileall`.
2. **Build and publish:** After CI succeeds, configures AWS credentials, builds the image using the repository's `Dockerfile`, and pushes it to the configured private Amazon ECR repository. Each image is tagged with the commit SHA.
3. **Deploy to EC2:** After the image is pushed, a self-hosted Linux x64 GitHub Actions runner on EC2 (labeled `atlas-ec2`) pulls that commit's image from ECR. The workflow replaces the `atlas-enterprise-ai` container, maps port `8000`, sets it to restart unless stopped, and checks that the container is running and the app responds at `http://127.0.0.1:8000/`.

The workflow runs on pushes to `main` (README-only changes are ignored) and can also be started manually with **workflow_dispatch**. The build and deployment jobs use the GitHub Actions environment named `production_1`.

### AWS and GitHub Actions setup

- Create a private ECR repository and set `ECR_REPOSITORY_NAME` to its name.
- Set up an EC2 instance as a self-hosted GitHub Actions runner with the labels `self-hosted`, `linux`, `x64`, and `atlas-ec2`. The runner needs Docker installed and running, network access to ECR, and permission to run Docker commands.
- In the `production_1` GitHub Actions environment, configure the following repository/environment secrets. The workflow validates all listed secrets before replacing the running container:
  - AWS and registry: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REPOSITORY_NAME`
  - Application AWS/S3: `S3_BUCKET`
  - Bedrock: `BEDROCK_EMBED_MODEL`, `BEDROCK_CHAT_MODEL`, `EMBED_DIM`
  - Pinecone: `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_CLOUD`, `PINECONE_REGION`, `PINECONE_READY_TIMEOUT`
  - Database: `DATABASE_URL`
  - Observability: `RIUS_API_KEY`, `RIUS_SERVICE_NAME`, `RIUS_DISABLED`, `RIUS_CAPTURE_CONTENT`
  - Application settings: `HITL_ENABLED`, `MEMORY_TURNS`
- Ensure the AWS credentials allow the workflow to authenticate to ECR and push/pull images, and allow the application to access its configured AWS services. Store credentials in GitHub Actions secrets; do not commit them to the repository.

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/nimashaklaa/enterprise-ai.git
cd enterprise-ai
```

### 2. Create a virtual environment and install dependencies

```bash
python3 -m venv atlas
source atlas/bin/activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root and set the required values for AWS, database, Bedrock, Pinecone, and observability.

```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET=your_s3_bucket

DATABASE_URL=postgresql://user:password@host:5432/enterprise_ai

BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_CHAT_MODEL=amazon.nova-lite-v1:0
EMBED_DIM=1024

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=atlas-enterprise-ai-index
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_READY_TIMEOUT=180

HITL_ENABLED=true
MEMORY_TURNS=6
```

### 4. Initialize the database schema

```bash
python scripts/init_db.py
```

### 5. Run the API server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The app will be available at:

- Frontend: http://localhost:8000/
- API docs: http://localhost:8000/api/docs

## Notes

- This project is designed for a demo and enterprise prototype workflow, not a production-ready replacement for a full platform stack.
- The application expects AWS, Postgres, and Pinecone credentials to be valid before uploading and querying documents.
- The ingestion pipeline automatically processes uploaded files once the upload is marked complete via the API.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
