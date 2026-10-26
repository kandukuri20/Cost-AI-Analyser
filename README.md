# AI AWS Cost Detective

An AI-powered **AWS** cost analysis tool. Connect your AWS account, run a scan, and get a plain-English report showing exactly which resources are costing you money unnecessarily — with the precise commands to fix each one.

> **AWS-only build.** This is an AWS-focused version of the AI Cloud Cost Detective — Azure and GCP scanning have been removed.

---

## What It Does

- Scans **87 AWS services** across all regions
- Detects idle, over-provisioned, and forgotten resources
- Estimates monthly savings for every finding
- Provides exact CLI commands to resolve each issue
- Streams live scan progress to the browser via WebSocket
- Stores scan history per user — auto-deleted after 2 days
- Users can delete individual history entries at any time

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python 3.11 + FastAPI |
| Auth | JWT (bcrypt + PyJWT) via httpOnly cookies with JTI-based token revocation |
| Cloud SDK | boto3 (AWS) |
| AI Analysis | Claude · GPT-4o · Gemini · Groq · DeepSeek · xAI · Mistral · Cohere · Together · Perplexity · Azure OpenAI · AWS Bedrock · Ollama · Built-in rule engine |
| Database | PostgreSQL 16 (asyncpg) |
| Live Updates | FastAPI WebSocket |
| Logging | Structured JSON via python-json-logger with request-id correlation |
| Tests | pytest + pytest-asyncio + httpx (backend) · vitest + jsdom (frontend) |
| Deployment | Docker + Docker Compose |

---

## Prerequisites

This project runs two local processes — a Python backend and a React frontend.

| Tool | Version | Check |
| --- | --- | --- |
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ (ships with Node) | `npm --version` |

> No database is required for local use. If `DATABASE_URL` is not set, the backend runs in **in-memory mode** — scans and history work, but data is cleared when the backend restarts. (PostgreSQL is only needed for persistent, production use — see the Docker section below.)

---

## Quick Start (local — backend + frontend)

Run the backend and frontend in **two separate terminals**. Commands below are PowerShell (Windows); the equivalents work on macOS/Linux.

### Terminal 1 — Backend

```powershell
cd backend

# 1. Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows PowerShell
# source venv/bin/activate           # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set a JWT secret (required, 32+ chars) — in-memory mode (no DATABASE_URL)
$secret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
$env:JWT_SECRET = $secret
$env:DEBUG = "true"                  # enables Swagger UI at /docs

# 4. Start the API
uvicorn main:app --port 8000

```

Backend is live at **[http://localhost:8000](http://localhost:8000)** (API docs at `/docs`). Leave this terminal running.

> **Note:** `JWT_SECRET` is set per terminal session. If you close and reopen the terminal, set it again before starting `uvicorn`.

### Terminal 2 — Frontend

```powershell
cd frontend

npm install
npm run dev

```

Frontend is live at **[http://localhost:5173](http://localhost:5173)**. The Vite dev server automatically proxies `/api` and `/ws` to the backend on port 8000 — no extra config needed.

### Use the app

1. Open **[http://localhost:5173](http://localhost:5173)**
2. Sign up with any email + password (local account only)
3. On the Dashboard, enter your AWS credentials (Access Keys, **AWS SSO**, or Organizations)
4. Select regions and services, then **Run AWS Cost Analysis**
5. Watch live progress; results also appear under **History**

> **AI analysis is optional.** Without an AI key the built-in rule engine runs for free. To use an AI provider, set its API key in `backend/.env` (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`) and restart the backend.

---

## Alternative: Run with Docker

If you have Docker, you can run everything (including PostgreSQL) in containers instead.

```bash
# Create a root .env with a Postgres password
python -c "import secrets; print('POSTGRES_PASSWORD=[REDACTED_PASSWORD] + secrets.token_hex(24))" > .env

docker compose up --build -d

```

Then open **[http://localhost:3000](http://localhost:3000)**. With Docker, `JWT_SECRET` is auto-generated and `DATABASE_URL` is wired to the Postgres container automatically.

---

## Environment Variables

### Root `.env` *(Docker only — Postgres password)*

Only needed when running with Docker. Not used in the local backend+frontend flow.

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | **required** | Set a strong random password. Generate: `python3 -c "import secrets; print(secrets.token_hex(24))"` |
| `POSTGRES_USER` | `costdetective` | Database username |
| `POSTGRES_DB` | `costdetective` | Database name |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated CORS origins |

### `backend/.env` *(optional — AI keys and overrides)*

Copy `backend/.env.example` to `backend/.env` only if you want to add an AI provider key or override defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_SECRET` | **required** | Random string, 32+ chars. **Local:** set it yourself before starting the backend (see Quick Start). **Docker:** auto-generated and persisted in the `backend_data` volume. |
| `DATABASE_URL` | *(unset)* | **Local:** leave unset to run in in-memory mode (no persistence). **Docker:** auto-wired to the Postgres container. Set to a `postgresql://` URL to use your own database. |
| `UVICORN_WORKERS` | `1` | **Must stay at 1** until rate-limit buckets and SSO sessions are externalized to Redis. Multiple workers split in-memory state silently. |
| `DEBUG` | `false` | Set to `true` to enable Swagger UI at `/docs` and disable cookie `Secure` flag for plain HTTP local dev. |
| `ENABLE_METRICS` | `false` | Set to `true` to expose a Prometheus `/metrics` endpoint. Requires `prometheus-fastapi-instrumentator` (already in `requirements.txt`). |
| `LOG_FORMAT` | `json` | Set to `text` for human-readable logs during local development. |
| `MAX_CONCURRENT_SCANS` | `5` | Platform-wide limit on parallel scans. |
| `MAX_ANALYSES_PER_USER` | `3` | Per-user concurrent scan limit. |
| `SCAN_TASK_TIMEOUT` | `600` | Per-scan timeout in seconds. |
| `ANALYSIS_RETENTION_DAYS` | `2` | Auto-delete analyses older than this many days. |

---

## Cloud Credentials

Credentials are entered in the dashboard UI — they are **never stored in the database**. They are held in memory only for the duration of each scan.

### AWS

**Option 1 — Access Keys (recommended for single accounts)**

Enter your Access Key ID and Secret Access Key in the AWS Credentials card on the dashboard.

**Option 2 — AWS SSO**

Log in via the SSO tab. An in-browser device-authorization flow authenticates you with your AWS identity provider. SSO sessions are scoped per-user — one user cannot access another user's SSO session. Temporary credentials are stored in `sessionStorage` for the current browser tab only.

**Option 3 — AWS Organizations (multi-account)**

Scan across multiple accounts from a management account. Enable the **Organizations** tab and enter your management account credentials plus the list of accounts to scan.

IAM permissions required: read-only (`ReadOnlyAccess` managed policy, or custom with `List*`, `Describe*`, `Get*` actions across the services you scan).

For Organizations mode, each member account needs a role (`CostDetectiveRole`) that the management account can assume. See `CLOUD_ORGANIZATIONS_SETUP.md`.

---

---

---

## AI Engine

Set **one** API key in `backend/.env` to enable AI-powered analysis. If none is set, the built-in rule engine runs automatically at no cost.

| Provider | Environment Variable | Default Model |
| --- | --- | --- |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | claude-sonnet-4-6 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| Google Gemini | `GOOGLE_API_KEY` | gemini-2.0-flash |
| Groq (Llama) | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| xAI (Grok) | `XAI_API_KEY` | grok-3 |
| Mistral | `MISTRAL_API_KEY` | mistral-large-latest |
| Cohere | `COHERE_API_KEY` | command-r-plus |
| Together AI | `TOGETHER_API_KEY` | Meta-Llama-3.1-70B |
| Perplexity | `PERPLEXITY_API_KEY` | sonar-pro |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | — |
| AWS Bedrock | *(uses boto3 credentials)* | amazon.nova-pro-v1:0 |
| Ollama (local) | *(no key — set *`OLLAMA_BASE_URL`*)* | llama3.2 |
| Built-in rule engine | *(no key required)* | — |

Override provider or model:

```env
AI_PROVIDER=anthropic   # force a specific provider
AI_MODEL=claude-opus-4-8  # override the default model

```

---

## Services Scanned

### AWS — 87 services

| Category | Services |
| --- | --- |
| Compute | EC2 / EBS / EIP / NAT, Load Balancers (ALB/NLB/CLB), Auto Scaling, ECS, EKS, ECR, App Runner, Elastic Beanstalk, Batch, Lightsail |
| Storage | S3, EFS, FSx, AWS Backup |
| Databases | RDS, ElastiCache, DynamoDB, DAX, Redshift, DocumentDB, Neptune, Timestream, QLDB, Keyspaces, MemoryDB, DMS |
| Serverless | Lambda |
| Networking | CloudFront, API Gateway, Transit Gateway, VPC Endpoints, Global Accelerator, Direct Connect, Network Firewall, Route 53, Transfer Family, WAF |
| Messaging | SQS, SNS, Kinesis, MSK, Amazon MQ, EventBridge, Step Functions, AppSync |
| Analytics | EMR, Glue, Athena, OpenSearch, QuickSight |
| AI / ML | SageMaker, Bedrock, Rekognition, Comprehend, Lex |
| Security | KMS, Secrets Manager, SSM, ACM Private CA, GuardDuty, Macie, Inspector, Security Hub, Firewall Manager, Shield, License Manager |
| Management | CloudWatch Synthetics, CloudTrail, AWS Config, X-Ray |
| Developer Tools | CodeBuild, CodePipeline, CodeArtifact |
| Business & Media | Connect, SES, WorkSpaces, Pinpoint, MediaConvert, MediaLive, IVS |

---

## Project Structure

```
AI-Cloud-Cost-Detective-main/
├── backend/
│   ├── main.py                 # FastAPI app — all API endpoints
│   ├── cloud_scanner.py        # AWS scanner (87 services)
│   ├── ai_analyzer.py          # AI cost analysis engine (14 providers)
│   ├── db.py                   # PostgreSQL + in-memory fallback database layer
│   ├── cloud_organizations.py  # AWS multi-account / SSO support
│   ├── sso_manager.py          # AWS SSO device authorization flow
│   ├── log_config.py           # Structured JSON logging setup
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── Dockerfile
│   ├── entrypoint.sh           # Startup: JWT secret generation, uvicorn launch
│   ├── tests/                  # pytest test suite
│   │   ├── test_auth.py        # Signup, login, logout, token revocation
│   │   ├── test_db.py          # In-memory DB operations
│   │   ├── test_rate_limit.py  # Login rate limiting
│   │   ├── test_validate_rate_limit.py  # /api/validate rate limiting
│   │   ├── test_sso_isolation.py        # SSO session scoping per user
│   │   └── test_health.py      # /health endpoint (in-memory, connected, degraded)
│   ├── .env                    # Optional — AI API keys only (gitignored; copy from .env.example)
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Dashboard, Analyze, History, Report, Login, Signup
│   │   ├── components/         # Navbar, ServiceSelector, ProgressTracker, SSOAuth
│   │   ├── __tests__/          # vitest test suite
│   │   ├── api.ts              # Backend API client (cookie-based auth)
│   │   ├── AuthContext.tsx     # Auth state — hydrated from httpOnly cookie on mount
│   │   └── App.tsx             # Routes + auth guard
│   ├── nginx.conf              # Reverse proxy + security headers
│   ├── vite.config.ts          # Build + vitest config
│   └── Dockerfile
│
├── docker-compose.yml
├── .env                        # Root env — POSTGRES_PASSWORD required (gitignored)
└── .env.example

```

---

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | — | Create account |
| `POST` | `/api/auth/login` | — | Login — sets httpOnly cookie |
| `POST` | `/api/auth/logout` | ✓ | Revoke token, clear cookie |
| `GET` | `/api/auth/me` | ✓ | Return current user info |
| `POST` | `/api/auth/change-password` | ✓ | Change password |
| `GET` | `/api/regions` | ✓ | Region list for provider |
| `GET` | `/api/services` | ✓ | Service list for provider |
| `POST` | `/api/validate` | ✓ | Pre-scan credential check (rate limited: 10/user/min) |
| `POST` | `/api/analyze` | ✓ | Start scan + analysis |
| `WS` | `/ws/progress/{id}` | ✓ | Live scan progress |
| `GET` | `/api/history` | ✓ | Past analyses |
| `GET` | `/api/history/{id}` | ✓ | Single analysis result |
| `DELETE` | `/api/history/{id}` | ✓ | Delete own analysis |
| `POST` | `/api/sso/start` | ✓ | Begin AWS SSO device flow |
| `GET` | `/api/sso/poll/{session}` | ✓ | Poll SSO auth status |
| `GET` | `/api/sso/accounts/{session}` | ✓ | List SSO accounts/roles |
| `POST` | `/api/sso/credentials` | ✓ | Get temporary credentials |
| `GET` | `/api/config/accounts` | ✓ | List org/SSO accounts |
| `POST` | `/api/config/accounts` | ✓ | Add account |
| `DELETE` | `/api/config/accounts/{id}` | ✓ | Remove account |
| `GET` | `/health` | — | Health check (DB probe + status) |

---

## How a Scan Works

```
Browser → FastAPI → Cloud Scanner(s) → AI Analyser → PostgreSQL
                         ↕
                  WebSocket (live progress streamed to browser)

```

1. You select a cloud provider, regions, and services in the dashboard
2. The backend validates credentials with a lightweight API call
3. Scanners query every selected service in every selected region in parallel
4. Resources are passed to the AI engine (or rule engine) for cost analysis
5. Live progress streams to the browser via WebSocket
6. The final report is saved to PostgreSQL and displayed

---

## Docker Services

| Container | Role | Port |
| --- | --- | --- |
| `cost-detective-frontend` | React app served by nginx | `0.0.0.0:3000` |
| `cost-detective-backend` | FastAPI + scanners | `127.0.0.1:8000` (internal) |
| `cost-detective-db` | PostgreSQL 16 | `127.0.0.1:5432` (internal) |
| `cost-detective-tunnel` | Cloudflare tunnel — auto public URL | *(no port binding)* |

The backend and database are not exposed to the internet — only port 3000 is public. The Cloudflare tunnel prints a randomly generated `trycloudflare.com` URL in its logs that exposes the frontend publicly without opening any firewall ports.

### Named Volumes

| Volume | Purpose |
| --- | --- |
| `postgres_data` | PostgreSQL data — persists across container restarts |
| `backend_data` | Stores the auto-generated `JWT_SECRET` — deleting this volume logs all users out |

---

## Security

| Feature | Implementation |
| --- | --- |
| Authentication | JWT (HS256, 8-hour expiry) stored in httpOnly, SameSite=strict cookies — not accessible to JavaScript (XSS-safe) |
| Dual auth mode | Endpoints accept both cookie and `Authorization: Bearer` header for API/CLI use |
| JWT secret | Auto-generated at first startup using `secrets.token_hex(32)`; persisted in the `backend_data` Docker volume |
| Token revocation | JTI stored in `revoked_tokens` table; logout immediately invalidates the token |
| Password storage | bcrypt — timing-safe comparison, constant-time dummy hash run even for unknown emails |
| Rate limiting | Login: 20/min per IP + 10/min per email. Signup: 10/5min per IP. `/api/validate`: 10/min per user |
| IP trust | `--forwarded-allow-ips` scoped to Docker network CIDR (`172.18.0.0/16`) — prevents X-Forwarded-For spoofing |
| SSO isolation | SSO sessions are bound to the creating user's ID; cross-user access returns 403 |
| SSRF prevention | SSO `start_url` restricted to `*.awsapps.com/*` by regex allowlist |
| Single worker | Uvicorn runs 1 worker by default — prevents in-memory state (rate buckets, SSO sessions) from being split across processes |
| Concurrent scans | Max 5 platform-wide, max 3 per user |
| Credential handling | Cloud credentials never stored — in memory for scan duration only |
| Input validation | Pydantic with field validators; emails, account IDs all validated |
| Request correlation | `X-Request-ID` header generated/forwarded on every request for log tracing |
| Health check | `/health` performs a live DB query with 2s timeout; returns 503 `{"status":"degraded"}` if unreachable |
| Auto data purge | Analyses older than 2 days deleted automatically every 12 hours |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP |
| Source maps | Disabled in production build; `.map` and `.ts` file routes blocked by nginx |
| Container isolation | Backend runs as non-root `appuser`; database and backend ports not exposed publicly |
| Error sanitization | Internal file paths stripped from error messages before reaching the client |

---

## Running Tests

### CI (GitHub Actions)

Tests run automatically on every push and pull request to `main` via `.github/workflows/ci.yml`. The pipeline runs:

1. Backend pytest against a real PostgreSQL 16 instance
2. TypeScript type-check (`tsc --noEmit`) + frontend vitest suite
3. Docker build check for both images (push to main only)

### Backend (local)

```bash
# Install test dependencies
pip install -r requirements.txt

# Run from the backend directory
cd backend
pytest tests/ -v

```

The test suite covers: signup/login/logout, token revocation, in-memory DB operations, login rate limiting, `/api/validate` rate limiting, SSO session isolation (cross-user access denied), and `/health` in all three states (in-memory, connected, degraded).

### Frontend (local)

```bash
cd frontend
npm install
npm test

```

---

## Common Commands

```bash
# Build all containers
docker compose build

# Start everything
docker compose up -d

# Stop everything
docker compose down

# View logs
docker compose logs -f

# Rebuild a single service after code changes
docker compose build backend && docker compose up -d backend

# Full rebuild (no cache)
docker compose build --no-cache && docker compose up -d

# Run backend tests inside the container
docker compose exec backend python3 -m pytest tests/ -v

```

---

## Troubleshooting

**Containers won't start**

```bash
docker compose logs backend
docker compose logs postgres

```

`POSTGRES_PASSWORD must be set`** error**

Create a root `.env` file with the password:

```bash
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_hex(24))" > .env
docker compose up -d

```

**Want to rotate the JWT secret (logs all users out)**

```bash
docker compose down
docker volume rm ai-cloud-cost-detective-main_backend_data
docker compose up -d

```

A fresh secret is generated on the next start.

**AWS scan returns no results**

- Confirm credentials work: `aws sts get-caller-identity`
- Check that selected regions contain your resources
- Verify the IAM user/role has `ReadOnlyAccess`

