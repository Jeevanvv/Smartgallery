# SmartGallery frontend

Next.js client for photographer administration and public event face search.

## Development

```powershell
copy .env.example .env.local
npm ci
npm run dev
```

The frontend expects the FastAPI service at `NEXT_PUBLIC_API_URL`. Supabase browser
credentials are public identifiers; never place a service-role key in a `NEXT_PUBLIC_*`
variable.

Run `npm run lint`, `npm run typecheck`, and `npm run build` before submitting changes.
See the repository root for full setup, privacy, and contribution guidance.
