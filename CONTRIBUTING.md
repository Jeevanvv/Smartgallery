# Contributing

Thank you for improving SmartGallery.

1. Open an issue for significant behavior or schema changes.
2. Create a focused branch and never commit `.env` files, credentials, runtime databases,
   real faces, event photos, or personal data.
3. Add or update tests for behavioral changes.
4. Run the checks below before opening a pull request.

```powershell
cd frontend
npm ci
npm run lint
npm run typecheck
npm run build

cd ..\backend
python -m pip install -r requirements-dev.txt
pytest tests -p no:cacheprovider
```

Report security issues privately as described in `SECURITY.md`.

For an isolated local PostgreSQL/pgvector and Redis stack, run
`./scripts/setup-local.ps1` from PowerShell. The named Docker volumes preserve development
data across normal `docker compose down` operations.
