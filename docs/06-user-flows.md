# User Flows

## Photographer flow

| Step | Action |
|------|--------|
| 1 | Visit `/admin` and sign in with Google |
| 2 | Create event: name + select Google Drive folder |
| 3 | Upload photos to Drive folder as usual (no workflow change) |
| 4 | Platform indexes in background; progress on admin dashboard |
| 5 | Share public event URL with clients (WhatsApp, email, etc.) |

**Example event URL:** `yourdomain.com/event/sharma-wedding`

## Client flow

| Step | Action |
|------|--------|
| 1 | Open event link on phone or laptop |
| 2 | See event name + "Find my photos" button |
| 3 | Take selfie or upload face photo; UI confirms face detected |
| 4 | Wait 2–5 seconds while server searches |
| 5 | View matched photos in gallery |
| 6 | Download individual photos (MVP) or all as ZIP (v2) |

## Auth model

| Role | Auth |
|------|------|
| Photographer | Google OAuth — required |
| Client | **No account** — frictionless; face is the only identifier |

## Privacy messaging (required at launch)

> "Your selfie is used only to find your photos and is deleted immediately."

Show this before selfie capture. Link to privacy policy.

## Admin dashboard (Phase 5)

- List all events
- Processing status per event (photos indexed / total)
- Number of client searches
- Copy shareable event link
