# Google Drive Integration

Photographers keep using Google Drive as they already do. The platform connects once and handles sync automatically.

## One-time setup flow

| Step | Action |
|------|--------|
| 1 | Create Google Cloud project; enable Drive API; create OAuth 2.0 Web credentials |
| 2 | Photographer logs in with Google; grant "read Drive files"; store encrypted refresh token |
| 3 | Photographer selects a Drive folder per event on admin dashboard |
| 4 | (v2) Register Drive push notification webhook on folder |

## Ongoing sync

### MVP — Polling (Phase 2)

- Every 30 minutes, scan event folder for unprocessed files
- Simple, reliable, no webhook renewal

### v2 — Webhooks (push)

- Drive notifies backend instantly on new files
- Webhooks expire after 7 days — must renew
- Use **both** webhook + polling as fallback

## Key Drive API operations

| Operation | Purpose |
|-----------|---------|
| `files.list` | List all images in a folder |
| `files.get` | File metadata (name, size, created time) |
| `files.get (alt=media)` | Download file content for face processing |
| `files.get (fields=thumbnailLink)` | Built-in thumbnail for gallery |
| `channels.watch` | Register webhook (v2) |

## Thumbnail strategy

Do **not** re-host photos. Use Google Drive thumbnail URLs with `?sz=400` in the gallery. Full-res download only when client requests it.

## OAuth scopes required

```
https://www.googleapis.com/auth/drive.readonly
```

## Token storage

- Store `access_token`, `refresh_token`, `expires_at` encrypted in `photographers` table
- Refresh access token automatically before API calls

## Quotas & resilience

- Free tier: 10,000 queries/100 seconds
- Use exponential backoff on batch processing
- Run heavy indexing during off-peak hours (2am–6am IST cron)

## Environment variables

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```
