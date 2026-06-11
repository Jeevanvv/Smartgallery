# Build Roadmap

8-12 weeks for a solo developer or small team.

## Phase 1 - Foundation (Week 1-2) <- **MOSTLY DONE**

- [x] Documentation (`docs/`)
- [x] Next.js + FastAPI project structure
- [x] Database schema + Alembic migration on Supabase
- [x] Supabase Auth - Google login for photographers
- [x] Backend JWT validation + Drive token storage
- [x] Event CRUD + admin dashboard (`/admin`)
- [x] Public event API + event page
- [ ] Redis Cloud password in `backend/.env`
- [ ] Supabase redirect URL: `http://localhost:3000/auth/callback`

## Phase 2 - Drive Integration (Week 3-4) <- **NEXT**

- [x] Drive API folder browsing & selection (admin UI)
- [x] File listing and metadata sync (manual event sync)
- [x] Polling sync (30 min interval) - MVP
- [ ] Drive push notification webhook - v2

## Phase 3 - AI Pipeline (Week 5-6)

- [x] InsightFace + ONNX runtime integration
- [x] Celery background job queue scaffold
- [x] Batch indexing with progress states (`queued`, `processing`, `done`, `failed`)
- [x] Manual re-index trigger (admin)

## Phase 4 - Client Website (Week 7-8)

- [x] Event landing page + selfie upload UI
- [x] Search API: selfie -> embedding -> pgvector -> photos
- [x] Basic gallery with Drive thumbnails
- [x] Individual photo download

## Phase 5 - Polish & Launch (Week 9-10)

- [x] Mobile responsiveness (iOS + Android browsers)
- [x] Privacy policy + consent UI
- [ ] Accuracy tuning (threshold, edge cases)
- [x] Photographer admin dashboard (analytics)
- [ ] "Download all as ZIP" - v2

## MVP Cut List

| Feature | MVP | v2 |
|---------|-----|-----|
| Drive polling sync | x | |
| Drive webhooks | | x |
| Individual download | x | |
| Download all ZIP | | x |
| Face search E2E | x | |
| Admin analytics | | x |

**Priority:** Get face search working end-to-end first.
