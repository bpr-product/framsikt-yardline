# Yardline — deployment to existing Vercel project

Target Vercel project: `Next phase / framsikt--yardline`
Connected Git repository: `BALA-PRADEEP/framsikt--yardline` (note the double hyphen).

## One-project architecture

- Root `package.json` builds `ui/` (React/TypeScript, Vite) into `ui/dist`.
- Root `api/index.py` exposes `backend/source/api/AppAPI.py` as a Vercel Python function.
- Root `requirements.txt` provides Python dependencies.
- Root `vercel.json` routes `/api/*` into FastAPI and serves Vite's `index.html` for client-side routes.
- The existing Vite Axios client uses same-origin `/api/v1`, so no frontend API URL is required.

## Required actions

1. Push the contents of this directory to `BALA-PRADEEP/framsikt--yardline` on the `main` branch (not to `bpr-product/framsikt-yardline`).
2. In Vercel project Settings -> Build and Deployment, keep root directory `.` (the repository root). Framework can be `Other`; the root `vercel.json` specifies build and output.
3. In Vercel project Settings -> Environment Variables, set the following for `Production` and `Preview`:
   - `DATABASE_URL`: Neon project's `framsikt-yardline` connection string, preferably for dedicated role `yardline_app` rather than the owner. Put this only in Vercel environment variables.
   - `SESSION_SECRET`: a long randomly generated value (>= 32 characters).
   - `DEMO_ACCESS_PIN`: an unpredictable PIN. The UI asks for this during role selection.
   - `ALLOWED_ORIGINS`: `https://framsikt-yardline.vercel.app` (optional for same-origin, but recommended).
4. Deploy and verify `https://framsikt-yardline.vercel.app/api/health` returns `{"status":"ok","environment":"pilot"}`.
5. Log in, create an appointment, check in, mark ready, assign a free dock, start/finish service, and depart. Check event history.

Database project `calm-sunset-85419458` already contains the SQL tables and synthetic seed records.

**Security:** This is an interview pilot with shared-role PIN login, not production-grade identity/authentication. Do not expose a development PIN and do not load real factory customer or personal data.

## Verified

- Python code compiles; backend pytest: 3 tests passed on 2026-11-02.
- Neon schema created and 4 docks / 7 synthetic truck visits loaded previously.

## Pending verification

- Node dependencies were not available in the isolated local environment; `npm run build` has not been verified.
- The Vercel cloud deployment has not yet been verified with this source. The current deployment was an initial Vercel starter.
- Browser Playwright E2E has not been executed on the cloud app.
