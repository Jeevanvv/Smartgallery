# Database Schema

PostgreSQL with **pgvector** extension. Hosted on Supabase (prod) or Docker (local).

## Enable extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Tables

### `photographers`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| name | VARCHAR(255) | From Google profile |
| email | VARCHAR(255) UNIQUE | From Google profile |
| google_oauth_token | TEXT | Encrypted JSON: access + refresh tokens |
| created_at | TIMESTAMPTZ | Default `now()` |
| updated_at | TIMESTAMPTZ | |

### `events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| photographer_id | UUID FK → photographers | |
| name | VARCHAR(255) | e.g. "Wedding - Sharma Family" |
| slug | VARCHAR(100) | Active-event unique URL slug. Duplicates are allowed for archived events; collisions restore/create as `eventid-sharma-wedding`. |
| drive_folder_id | VARCHAR(255) | Google Drive folder ID |
| status | VARCHAR(50) | `active`, `archived` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `photos`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK → events | |
| drive_file_id | VARCHAR(255) UNIQUE | |
| drive_url | TEXT | Direct link |
| thumbnail_url | TEXT | Drive thumbnail with `?sz=400` |
| filename | VARCHAR(512) | |
| processed_at | TIMESTAMPTZ | NULL until indexed |
| processing_status | VARCHAR(50) | `pending`, `processing`, `done`, `failed` |
| created_at | TIMESTAMPTZ | |

### `face_embeddings`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| photo_id | UUID FK → photos | |
| embedding | vector(512) | pgvector column |
| face_box | JSONB | `{x, y, w, h}` bounding box |
| created_at | TIMESTAMPTZ | |

**Index:**

```sql
CREATE INDEX ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### `search_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK → events | |
| guest_name | VARCHAR(255) | Guest-provided name for search follow-up |
| guest_phone | VARCHAR(50) | Guest-provided phone number |
| guest_email | VARCHAR(255) | Guest-provided email |
| consented_at | TIMESTAMPTZ | Evidence that required search consent was submitted |
| match_count | INTEGER | Number of photos returned |
| searched_at | TIMESTAMPTZ | Selfie is not stored |

## Entity relationships

```
photographers 1──* events 1──* photos 1──* face_embeddings
                      └──* search_sessions
```

## Migration tool

Alembic migrations in `backend/alembic/`.
