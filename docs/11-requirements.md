# Requirements

## Functional requirements

### FR-1 Photographer authentication

- Photographer signs in with Google OAuth
- Session persists across visits
- OAuth tokens stored encrypted

### FR-2 Event management

- Create, list, view, archive events
- Each event linked to one Google Drive folder
- Unique active public URL per event; same-name conflicts use an event-ID-prefixed slug

### FR-3 Photo sync

- Detect new images in linked Drive folder
- Store metadata (file ID, name, thumbnail URL) in DB
- MVP: poll every 30 minutes
- v2: real-time webhook + polling fallback

### FR-4 Face indexing

- Download photo temporarily from Drive
- Detect all faces; extract 512-dim embeddings
- Store embeddings linked to photo ID
- Process asynchronously via job queue
- Show indexing progress to photographer

### FR-5 Client face search

- Public event page — no login required
- Guest enters name, phone, and email before selfie search`r`n- Selfie via webcam or file upload
- Validate face present before search
- Return matched photos for that event only
- Selfie discarded after search — never stored

### FR-6 Gallery & download

- Display matched photos using Drive thumbnails
- Individual full-res download from Drive
- v2: bulk ZIP download

### FR-7 Privacy

- Display consent message before selfie capture
- Guest contact details are stored with the search session for event follow-up
- Privacy policy page

## Non-functional requirements

### NFR-1 Cost

- Operate on free tiers for launch scale (≤10k photos)

### NFR-2 Performance

- Client search response: < 5 seconds
- Face indexing: background, non-blocking

### NFR-3 Accuracy

- Configurable similarity threshold (default 0.4 cosine distance)
- Tunable per deployment via env var

### NFR-4 Security

- Encrypted OAuth tokens at rest
- HTTPS everywhere
- Event-scoped search (no cross-event leakage)
- Rate limit public search endpoint

### NFR-5 Mobile

- Selfie capture works on iOS Safari and Android Chrome
- Responsive gallery layout

### NFR-6 Reliability

- Exponential backoff on Drive API errors
- Failed photo processing retried with status `failed` visible in admin

## Out of scope (v1)

- Client accounts / login
- Payment / subscriptions
- Photo editing or watermarking
- Multi-photographer marketplace
- On-device (browser) face recognition

## Acceptance criteria (MVP)

1. Photographer can OAuth login, create event, link Drive folder
2. Photos sync and index within 30 min of upload
3. Client can open event URL, take selfie, see matched photos
4. Client can download individual matched photos
5. Selfie is not persisted in DB or filesystem after search
