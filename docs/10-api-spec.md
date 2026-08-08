# API Specification

Base URL: `http://localhost:8000/api` (dev) | `https://api.yourdomain.com/api` (prod)

All responses JSON unless noted. Auth via session cookie or Bearer token for photographer routes.

---

## Health

### `GET /health`

```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Auth (Photographer)

### `GET /auth/google`

Redirects to Google OAuth consent screen.

### `GET /auth/google/callback`

Handles OAuth callback; creates/updates photographer; sets session.

### `GET /auth/me`

Returns current photographer profile. Requires auth.

```json
{
  "id": "uuid",
  "name": "Jane Photographer",
  "email": "jane@example.com"
}
```

### `POST /auth/logout`

Clears session.

---

## Events (Photographer — auth required)

### `GET /events`

List photographer's events.

### `POST /events`

```json
{
  "name": "Wedding - Sharma Family",
  "slug": "sharma-wedding",
  "drive_folder_id": "1abc..."
}
```

If another active event already uses the readable slug, create/restore keeps the URL unique by prefixing the restored or newly created event slug with that event ID prefix, for example `a1b2c3d4-sharma-wedding`.

### `GET /events/{event_id}`

Event detail + processing stats.

```json
{
  "id": "uuid",
  "name": "Wedding - Sharma Family",
  "slug": "sharma-wedding",
  "photos_total": 500,
  "photos_indexed": 234,
  "public_url": "https://yourdomain.com/event/sharma-wedding"
}
```

### `DELETE /events/{event_id}`

Archive event.

### `POST /events/{event_id}/sync`

Trigger manual Drive sync. Drive sync removes database photo and face embedding records for event photos that no longer exist in the selected Drive folder.

```json
{
  "scanned": 120,
  "created": 120,
  "updated": 0,
  "deleted": 0,
  "photos_total": 120
}
```

### `POST /events/{event_id}/reindex`

Trigger full re-index of all photos.

```json
{
  "queued": 120,
  "reset": 120,
  "photos_total": 120
}
```

---

## Drive (Photographer — auth required)

### `GET /drive/folders`

List Drive folders for folder picker UI.

### `GET /drive/folders/{folder_id}/files`

Preview image files in a folder.

---

## Public — Client (no auth)

### `GET /public/events/{slug}`

Event landing info.

```json
{
  "name": "Wedding - Sharma Family",
  "slug": "sharma-wedding",
  "photos_indexed": 450,
  "ready": true
}
```

### `POST /public/events/{slug}/search`

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| guest_name | string | yes |
| guest_phone | string | yes |
| guest_email | string | yes |
| privacy_consent | boolean (`true`) | yes |
| selfie | JPEG, PNG, or WebP file (8 MB default maximum) | yes |

**Response:**

```json
{
  "session_id": "uuid",
  "match_count": 23,
  "photos": [
    {
      "id": "uuid",
      "access_token": "short-lived-resource-bound-token"
    }
  ]
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400 | No face detected in selfie |
| 413 | Request or selfie is too large |
| 415 | Unsupported image type |
| 429 | Search rate limit exceeded |
| 404 | Event not found |
| 503 | Event not ready (indexing in progress) |

### `GET /public/events/{slug}/photos/{photo_id}/download`

Requires the result's `token` query parameter and proxies the original image as a private,
non-cacheable attachment. The same token is required by the `/thumbnail` endpoint and expires
after the configured access period.

---

## Webhooks (v2)

### `POST /webhooks/drive`

Handles Google Drive push notifications. Validates channel token.

---

## Error format

```json
{
  "detail": "Human-readable message",
  "code": "NO_FACE_DETECTED"
}
```
