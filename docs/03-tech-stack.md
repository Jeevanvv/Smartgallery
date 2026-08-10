# Tech Stack

Chosen for lowest cost, fastest build time, and best free tier availability. **No Docker** — all infra is cloud-hosted.

## Frontend (client website + admin)

| Layer | Choice | Cost |
|-------|--------|------|
| Framework | Next.js 16 (App Router, React) | Free |
| Hosting | Vercel | Free tier |
| Styling | Tailwind CSS | Free |
| Auth (photographer) | Supabase Auth + Google OAuth | Free |
| Camera | react-webcam / native browser API | Free |
| Gallery UI | react-photo-album | Free |

## Backend (API server)

| Layer | Choice | Cost |
|-------|--------|------|
| Language | Python 3.11+ (FastAPI) | Free |
| Hosting | Railway.app or Render.com | Free tier |
| Task queue | Celery + Redis Cloud | Free tier |
| Auth validation | Supabase JWT (verify photographer) | Free |
| Drive tokens | Stored per photographer from Supabase OAuth | Free |

## AI / Face recognition

| Layer | Choice | Cost |
|-------|--------|------|
| Primary model | InsightFace (ArcFace backbone) | Free / OSS |
| Alternative | DeepFace (multi-model wrapper) | Free / OSS |
| Face detection | RetinaFace (via InsightFace) | Free |
| Runtime | ONNX Runtime (CPU is fine) | Free |

## Database

| Layer | Choice | Cost |
|-------|--------|------|
| Main DB | PostgreSQL + pgvector | Free |
| Hosting | **Supabase** (500MB free) | Free tier |
| ORM | SQLAlchemy + Alembic | Free |
| Auth users | Supabase Auth (`auth.users`) | Free |

## Cache / job queue

| Layer | Choice | Cost |
|-------|--------|------|
| Broker | **Redis Cloud** (or Upstash) | Free tier |
| Use | Celery background face indexing | |

## Google Drive integration

| Layer | Choice | Cost |
|-------|--------|------|
| API | Google Drive API v3 | Free (quota limits) |
| SDK | google-api-python-client | Free |
| Login + Drive scope | Google OAuth via **Supabase Auth** | Free |
| Webhooks | Drive Push Notifications (v2) | Free |

## Local development

No Docker. Dev machine connects directly to cloud services:

| Layer | Choice |
|-------|--------|
| DB | Supabase (remote) |
| Redis | Redis Cloud (remote) |
| Env | `.env` + `.env.example` |

See [12 — Cloud Setup Plan](./12-cloud-setup-plan.md) for step-by-step account setup.

## Monorepo layout

```
smartgallery/
├── docs/           # Documentation
├── frontend/       # Next.js app
├── backend/        # FastAPI + Celery
└── README.md
```
