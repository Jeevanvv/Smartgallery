# SmartGallery

Photographer face recognition platform. Clients take a selfie at an event page and instantly find all photos featuring their face.

> Face recognition and contact-data collection can be regulated in your jurisdiction.
> Deployers must obtain appropriate consent, publish an operator-specific privacy notice,
> and configure retention before allowing real users.

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

### Automatic local database (optional)

If you do not have Supabase/PostgreSQL available, install Docker Desktop and run this once
from the repository root:

```powershell
.\scripts\setup-local.ps1
```

It starts a loopback-only PostgreSQL 17 database with pgvector plus Redis, creates an ignored
`backend/.env.local`, configures the frontend development profile, and applies every Alembic
migration. It does not overwrite `backend/.env` or unrelated local settings. Stop the
containers without deleting their data with `docker compose down`.

The script also configures an ignored, loopback-only development login so the dashboard can
run without Supabase. The backend refuses this mode outside the development profile or when
the database/frontend URLs are not local. Google Drive browsing and synchronization still
require real Google OAuth credentials.

To verify the code without any database or Docker at all:

```powershell
cd backend
.venv\Scripts\python -m pytest tests -q -p no:cacheprovider
cd ..\frontend
npm run lint
npm run typecheck
npm run build
```

Run the worker and scheduler in separate terminals. The scheduler performs Drive sync and
privacy-retention cleanup:

```bash
cd backend
celery -A app.worker.celery_app worker --loglevel=info
celery -A app.worker.celery_app beat --loglevel=info
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

## Security and privacy defaults

- Public searches require explicit consent and accept JPEG, PNG, or WebP selfies up to 8 MB.
- Searches are rate-limited per client, using Redis when configured.
- Selfies are processed in memory and are not persisted.
- Guest contact/search records are deleted after 30 days by default.
- Photo result links are resource-bound and expire after 15 minutes by default.
- Google OAuth tokens are encrypted at rest with `SECRET_KEY`.

Review [SECURITY.md](./SECURITY.md), [PRIVACY.md](./PRIVACY.md), and every environment
setting before production deployment.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). By participating, you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

SmartGallery is available under the [MIT License](./LICENSE).
