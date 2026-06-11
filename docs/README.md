# SmartGallery — Documentation Index

Photographer Face Recognition Platform. Clients take a selfie and instantly find all event photos featuring their face.

## Quick links

| Doc | Description |
|-----|-------------|
| [01 — Overview](./01-overview.md) | Product vision, core capabilities, key insight |
| [02 — Architecture](./02-architecture.md) | System layers, data flow, design decisions |
| [03 — Tech Stack](./03-tech-stack.md) | Frontend, backend, AI, DB, hosting choices |
| [04 — Face Recognition](./04-face-recognition.md) | Indexing pipeline, search pipeline, model choice |
| [05 — Google Drive](./05-google-drive.md) | OAuth, sync, webhooks, API operations |
| [06 — User Flows](./06-user-flows.md) | Photographer and client journeys |
| [07 — Cost Plan](./07-cost-plan.md) | Free-tier costs, scaling estimates |
| [08 — Roadmap](./08-roadmap.md) | 8–12 week build phases, MVP scope |
| [09 — Database Schema](./09-database-schema.md) | Tables, columns, indexes, pgvector |
| [10 — API Spec](./10-api-spec.md) | REST endpoints, request/response shapes |
| [11 — Requirements](./11-requirements.md) | Functional & non-functional requirements |
| [12 — Cloud Setup Plan](./12-cloud-setup-plan.md) | **Supabase + Redis Cloud + Google OAuth — no Docker** |

## Source

These docs are derived from `photographer_face_recognition_platform_docs.html` and expanded for development use.

## How to use during development

1. **Starting a feature** — Read the relevant doc section + API spec + schema.
2. **Phase tracking** — Check [08 — Roadmap](./08-roadmap.md) and mark items done in the root `README.md`.
3. **Decisions** — Architecture and tech stack docs are the source of truth; update them if we change approach.

## Current phase

**Phase 1 — Foundation** (Week 1–2)

- [x] Documentation
- [x] Next.js + FastAPI project structure
- [x] Database schema + Alembic migration
- [x] Cloud setup plan (Supabase + Redis Cloud — no Docker)
- [ ] Supabase project + pgvector + migrations
- [ ] Redis Cloud database
- [ ] Google Cloud + Supabase Google provider
- [ ] Photographer login via Supabase Auth
