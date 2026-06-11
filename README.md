# SmartGallery

Photographer face recognition platform. Clients take a selfie at an event page and instantly find all photos featuring their face.

## Documentation

All specs live in [`docs/`](./docs/README.md).

**Start here for setup:** [docs/12-cloud-setup-plan.md](./docs/12-cloud-setup-plan.md) — Supabase, Redis Cloud, Google OAuth, no Docker.

## Project structure

```
smartgallery/
├── docs/              # Requirements, architecture, API spec, roadmap
├── frontend/          # Next.js 14 — client site + admin
└── backend/           # FastAPI — API, Drive sync, face AI workers
```

## Infrastructure (cloud — no Docker)

| Service | Purpose |
|---------|---------|
| **Supabase** | PostgreSQL + pgvector + photographer Google login |
| **Redis Cloud** | Celery job queue (background face indexing) |
| **Google Cloud** | Drive API (read photographer photos) |
| **Vercel** | Host frontend |
| **Railway / Render** | Host backend + Celery worker |

## Quick start (local dev)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase, Redis Cloud, and Google Cloud accounts configured — see [cloud setup plan](./docs/12-cloud-setup-plan.md)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # fill with Supabase + Redis Cloud values
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Current phase

**Phase 1 — Foundation** — see [docs/08-roadmap.md](./docs/08-roadmap.md)
