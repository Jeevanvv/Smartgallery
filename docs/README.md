# SmartGallery — Documentation Index

Photographer face-recognition platform. Clients take a selfie and find matching event photos.

## Quick links

| Doc | Description |
|-----|-------------|
| [01 — Overview](./01-overview.md) | Product vision, capabilities, and constraints |
| [02 — Architecture](./02-architecture.md) | System layers, data flow, and design decisions |
| [03 — Tech Stack](./03-tech-stack.md) | Frontend, backend, AI, database, and hosting |
| [04 — Face Recognition](./04-face-recognition.md) | Indexing and search pipelines |
| [05 — Google Drive](./05-google-drive.md) | OAuth and synchronization |
| [06 — User Flows](./06-user-flows.md) | Photographer and client journeys |
| [07 — Cost Plan](./07-cost-plan.md) | Historical estimates; verify before relying on them |
| [08 — Roadmap](./08-roadmap.md) | Historical build plan |
| [09 — Database Schema](./09-database-schema.md) | Tables, columns, indexes, and pgvector |
| [10 — API Spec](./10-api-spec.md) | REST endpoint overview |
| [11 — Requirements](./11-requirements.md) | Functional and non-functional requirements |
| [12 — Cloud Setup Plan](./12-cloud-setup-plan.md) | Supabase, Redis, and Google OAuth setup |

## Implementation status

The repository includes the Next.js client, FastAPI API, Supabase authentication, Google
Drive synchronization, face indexing workers, public search, privacy controls, and database
migrations. Provider instructions and prices change; verify deployment steps against current
official documentation.
