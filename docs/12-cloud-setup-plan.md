# Cloud Setup Plan (No Docker)

Run everything on managed free tiers. Your laptop only runs the frontend and backend code — no local database or Redis containers.

## Architecture at a glance

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Next.js        │────▶│  FastAPI        │────▶│  Supabase        │
│  (Vercel)       │     │  (Railway)      │     │  PostgreSQL +    │
│                 │     │                 │     │  pgvector        │
│  Supabase Auth  │     │  Celery worker  │────▶│                  │
│  (Google login) │     │       │         │     └──────────────────┘
└─────────────────┘     │       ▼         │
                          │  Redis Cloud    │
                          │  (job queue)    │
                          └───────┬─────────┘
                                  │
                          ┌───────▼─────────┐
                          │  Google Drive   │
                          │  API (photos)   │
                          └─────────────────┘
```

| Service | What it does | Who uses it |
|---------|--------------|-------------|
| **Supabase** | Database (events, photos, face vectors) + photographer login | Backend + Frontend |
| **Redis Cloud** | Celery job queue (background face indexing) | Backend only |
| **Google Cloud** | Drive API (read photographer's photos) | Backend only |
| **Vercel** | Host the website | Public |
| **Railway / Render** | Host FastAPI + Celery worker | Backend |

Clients (guests) never log in — they only use the public event page.

---

## Accounts you need to create

| # | Account | URL | Cost |
|---|---------|-----|------|
| 1 | Supabase | https://supabase.com | Free (500MB DB) |
| 2 | Redis Cloud | https://redis.com/try-free | Free (~30MB) |
| 3 | Google Cloud | https://console.cloud.google.com | Free (API quotas) |
| 4 | Vercel | https://vercel.com | Free |
| 5 | Railway or Render | https://railway.app or https://render.com | Free tier |

Optional later: domain registrar (~₹800/year).

---

## Step 1 — Supabase (database + auth)

### 1a. Create project

1. Sign up at [supabase.com](https://supabase.com)
2. **New project** → pick name, password (save it), region (choose closest to India, e.g. Singapore)
3. Wait ~2 minutes for provisioning

### 1b. Enable pgvector

In Supabase **SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then run our schema migration (from your machine, after Python is installed):

```bash
cd backend
# Set DATABASE_URL to Supabase connection string (see below)
alembic upgrade head
```

**Connection string:** Project Settings → Database → Connection string → URI  
Use the **Session pooler** URL for server apps:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 1c. What Supabase stores

| Data | Table |
|------|-------|
| Photographer profile | `photographers` (synced from Supabase Auth) |
| Events, photos, embeddings | `events`, `photos`, `face_embeddings` |
| Anonymous search logs | `search_sessions` |

Supabase Auth stores login sessions separately in `auth.users` — we link via email or a `user_id` column.

### 1d. Can Supabase handle Google login?

**Yes — for photographer login.** Supabase Auth supports Google OAuth out of the box.

| Auth need | Handled by |
|-----------|------------|
| Photographer sign up / sign in | **Supabase Auth** (Google provider) |
| Session / JWT for admin API | **Supabase Auth** (frontend sends JWT to FastAPI) |
| Reading Google Drive files | **Google OAuth scopes** (see Step 3) |

**Important:** Basic Google login only gives name + email. To read Drive folders you must request an **extra scope** at sign-in:

```
https://www.googleapis.com/auth/drive.readonly
```

Flow:

1. Photographer clicks "Sign in with Google" on `/admin`
2. Frontend calls Supabase `signInWithOAuth` with Drive scope + `access_type=offline`
3. Google asks: "Allow read access to Drive?"
4. After login, Supabase session includes `provider_refresh_token`
5. Backend saves that refresh token (encrypted) in `photographers.google_oauth_token`
6. Backend uses it to call Drive API anytime

You do **not** need a separate custom OAuth server in FastAPI if Supabase returns the refresh token. FastAPI only **validates** the Supabase JWT and **uses** the stored Drive token.

### 1e. Supabase keys (for frontend + backend)

Project Settings → API:

| Key | Where to use |
|-----|--------------|
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` (public) key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend only) |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (backend only — never expose to browser) |
| JWT Secret | `SUPABASE_JWT_SECRET` (backend validates tokens) |

---

## Step 2 — Redis Cloud (background jobs)

Face indexing runs in the background via **Celery**. Celery needs Redis as a message broker.

### 2a. Create database

1. Sign up at [redis.com/try-free](https://redis.com/try-free)
2. Create a **free** database (30MB is enough for MVP)
3. Note the connection details

### 2b. Connection URL format

Redis Cloud gives you host, port, and password. Combine into:

```
redis://default:[PASSWORD]@[HOST]:[PORT]
```

Example:

```
REDIS_URL=redis://default:AbCdEf123@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
CELERY_BROKER_URL=redis://default:AbCdEf123@...
CELERY_RESULT_BACKEND=redis://default:AbCdEf123@...
```

### 2c. What Redis is used for

| Job | Example |
|-----|---------|
| New photo detected | Queue `index_photo(photo_id)` |
| Batch re-index | Queue 500 photos without blocking API |
| Drive sync poll | Optional scheduled task every 30 min |

Redis does **not** store photos or face data — only short-lived job messages.

### Alternative: Upstash Redis

If Redis Cloud signup is slow, [Upstash](https://upstash.com) offers a similar free tier with a single URL. Works the same with Celery.

---

## Step 3 — Google Cloud (Drive API)

Supabase handles **login**, but Google Drive is a **separate API** that needs its own setup in Google Cloud Console.

### 3a. Create project

1. [Google Cloud Console](https://console.cloud.google.com) → New project → e.g. `smartgallery`
2. **APIs & Services → Library** → enable **Google Drive API**

### 3b. OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External** (for any photographer with a Google account)
3. App name: SmartGallery
4. Add scopes:
   - `email`, `profile`, `openid` (default for login)
   - `https://www.googleapis.com/auth/drive.readonly` (read Drive photos)
5. Add your email as test user (while in "Testing" mode)

### 3c. OAuth credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Type: **Web application**
3. **Authorized redirect URIs** — add Supabase's callback:

```
https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
```

(Find `[YOUR-PROJECT-REF]` in Supabase Project Settings → General)

4. Copy **Client ID** and **Client Secret**

### 3d. Connect Google to Supabase

1. Supabase Dashboard → **Authentication → Providers → Google**
2. Enable Google
3. Paste Client ID and Client Secret from step 3c
4. Save

### 3e. Frontend sign-in (with Drive scope)

When we implement admin login, the frontend will call something like:

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    scopes: "https://www.googleapis.com/auth/drive.readonly",
    redirectTo: `${window.location.origin}/admin/callback`,
    queryParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
});
```

`access_type=offline` + `prompt=consent` ensures Google returns a **refresh token** (needed for long-term Drive access).

---

## Step 4 — Environment variables

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### Backend (`backend/.env`)

```env
# App
SECRET_KEY=generate-a-random-32-char-string
DEBUG=true
FRONTEND_URL=http://localhost:3000

# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-settings
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # backend only
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Redis Cloud
REDIS_URL=redis://default:password@host:port
CELERY_BROKER_URL=redis://default:password@host:port
CELERY_RESULT_BACKEND=redis://default:password@host:port

# Face recognition
SIMILARITY_THRESHOLD=0.4
MAX_SEARCH_RESULTS=200
```

**Note:** Google OAuth login is configured in the Supabase dashboard, but the backend still needs the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` so it can refresh stored Google Drive tokens when calling the Drive API.

---

## Step 5 — How auth flows end-to-end

### Photographer (admin)

```
1. Visit /admin
2. Click "Sign in with Google"
3. Supabase → Google (login + Drive permission)
4. Redirect back to /admin/callback
5. Frontend gets Supabase session (JWT)
6. Frontend calls POST /api/auth/sync-profile with JWT
7. Backend validates JWT, saves provider_refresh_token to photographers table
8. Photographer is logged in — can create events, link Drive folders
```

### Client (guest) — no login

```
1. Visit /event/sharma-wedding
2. Take selfie
3. POST /api/public/events/sharma-wedding/search (no auth)
4. Get matched photos
```

Supabase Auth is **only for photographers**, not clients.

---

## Step 6 — Local development (no Docker)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Accounts above configured

### Run

```bash
# Terminal 1 — API
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # fill with Supabase + Redis Cloud values
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery worker (when face AI is built)
celery -A app.worker worker --loglevel=info

# Terminal 3 — Frontend
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Your code talks to **cloud** Supabase and Redis — nothing to install locally except Python and Node.

---

## Step 7 — Production deployment

| Component | Deploy to | Notes |
|-----------|-----------|-------|
| Frontend | Vercel | Connect GitHub repo, set env vars |
| FastAPI | Railway or Render | Web service on port 8000 |
| Celery worker | Same Railway/Render project | Second process / worker dyno |
| Database | Supabase | Already cloud |
| Redis | Redis Cloud | Already cloud |
| Photos | Google Drive | Photographer's account |

### Production env changes

- `FRONTEND_URL=https://yourdomain.com`
- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`
- Supabase Auth → add production URL to **Redirect URLs**
- Google OAuth → add production redirect if needed

---

## Build order (what we implement next)

| Order | Task | Depends on |
|-------|------|------------|
| 1 | You create Supabase + Redis Cloud + Google Cloud accounts | — |
| 2 | Run `alembic upgrade head` against Supabase | Supabase + Python |
| 3 | Add `@supabase/supabase-js` to frontend | Supabase keys |
| 4 | Implement Google sign-in on `/admin` | Supabase Google provider |
| 5 | Backend JWT validation + save Drive refresh token | Step 4 |
| 6 | Event CRUD + Drive folder picker | Step 5 |
| 7 | Celery + Redis Cloud + face indexing | Redis Cloud |
| 8 | Client selfie search + gallery | Steps 6–7 |

---

## FAQ

### Do clients need Supabase accounts?

No. Only photographers log in. Clients use the public event link.

### Can we use email/password instead of Google?

Supabase supports email login, but photographers **must** use Google anyway — we need Drive access. Google OAuth is required for the product to work.

### Is Supabase free enough?

Yes for launch. 500MB holds ~100k+ face embeddings (vectors are small). Upgrade when you exceed limits.

### Redis Cloud vs Upstash?

Both work. Redis Cloud is what you asked for; Upstash is simpler (one URL, serverless). Pick one — Celery works with either.

### Do we still need docker-compose.yml?

No. You can ignore or delete it. All infra is cloud-hosted.

### What about InsightFace / AI?

Runs on the **backend server** (Railway/Render), not Supabase. No extra account needed — open-source, runs on CPU.

---

## Checklist — copy and tick off

```
[ ] Supabase project created
[ ] pgvector extension enabled
[ ] Supabase API keys copied to .env files
[ ] Google Cloud project + Drive API enabled
[ ] OAuth consent screen configured with drive.readonly scope
[ ] OAuth client ID/secret added to Supabase Google provider
[ ] Redis Cloud database created, URL copied
[ ] alembic upgrade head run successfully
[ ] Frontend loads at localhost:3000
[ ] Backend health check at localhost:8000/api/health
[ ] Photographer can sign in with Google (once we build it)
```
