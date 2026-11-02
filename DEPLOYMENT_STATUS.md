# Yardline cloud rollout

## Verified
- Neon project: `calm-sunset-85419458`, Singapore region.
- Database tables: `docks`, `users`, `visits`, `assignments`, `events`.
- Seeded data: 4 docks, 7 synthetic truck visits, 7 events, 1 active assignment.
- Local FastAPI tests: `cd backend && python -m pytest -q` — 3 passed.

## Pending
- Upload the complete source archive `Framsikt_Yardline_Source.zip` into this repository. The repo currently has the bootstrap README/workflow and this status file, not the full source.
- Vercel `Next phase` team rejects project creation with HTTP 403. Grant project-creation access or create two projects via Vercel UI with roots `ui/` and `backend/`.
- Set encrypted backend variables `DATABASE_URL`, `SESSION_SECRET`, `DEMO_ACCESS_PIN`, `ALLOWED_ORIGINS` and frontend `VITE_API_BASE_URL`. Do not commit secret values.
- Build and smoke-test both cloud services. Browser E2E has not yet been verified.

## Security warning
The PIN-based operator switch is for a synthetic interview pilot, not real manufacturing data. Do not expose the default development PIN or default signing secret on a public site.

## Suggested setup
1. Extract `Framsikt_Yardline_Source.zip`; upload extracted contents to `main` through GitHub desktop/web UI.
2. In Vercel, import `bpr-product/framsikt-yardline` twice: `framsikt-yardline-api` with root `backend`, and `framsikt-yardline-ui` with root `ui`.
3. Add encrypted backend variables and frontend API origin, then deploy API before UI.
4. Verify GET `/api/health`, login, visits, docks, check-in, hold/ready, assign, finish, depart, and audit history.
