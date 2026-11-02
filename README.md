# Yardline V2 — Factory operations decision pilot

**Live product:** https://framsikt-yardline.vercel.app  
**Purpose:** Framsikt engineering fundamentals case — a working, transparent prototype for truck queue, readiness, issue ownership, capacity and audit decisions.

V2 documentation: [Implementation details](docs/IMPLEMENTATION_V2.md) | [Scenario coverage](docs/SCENARIO_COVERAGE.md) | [Full blueprint](docs/YARDLINE_COMPLETE_SOLUTION_BLUEPRINT.md)

This application uses synthetic data, demo identities and illustrative appointment capacity. It is not a live factory deployment or measured business outcome.

# Yardline — Factory Operations Pilot

A full-stack, evidence-driven factory truck turnaround and dock-coordination application for a product engineering case study.

This is a proposed pilot based on a **hypothetical coordination problem**. It does not imply that actual factory delays are caused by a scheduling system. All demo data must be synthetic.

## Structure

- `ui/` — React, TypeScript, Vite, components, API services and domain types.
- `backend/` — FastAPI API routers, business services, schemas, SQLAlchemy models, and tests.
- `PROJECT_CONTEXT.md` — reusable full-stack architecture conventions.
- `docs/ENGINEERING_DECISIONS.md` — decisions to discuss in the interview.

## Local development

```bash
cd backend
pip install -r requirements.txt
export DEMO_ACCESS_PIN=123456
export SESSION_SECRET=replace-for-production
uvicorn main:app --reload --port 8000
```

In a separate terminal:

```bash
cd ui
npm install
npm run dev
```

Visit http://localhost:5173. Sign in as any of the four roles with the configured PIN. UI API requests are proxied to the backend in development.

## Cloud deployment — existing `framsikt--yardline` Vercel project

The current deployment uses a single Vercel project with React and FastAPI hosted on the same origin. The repository root contains `api/index.py`, `requirements.txt`, `package.json`, and `vercel.json` for the combined build. `ui/` and `backend/` remain separate application source directories.

- Vercel project: `Next phase / framsikt--yardline`.
- Connected Git repository: `BALA-PRADEEP/framsikt--yardline` (double hyphen).
- Neon database: `framsikt-yardline` in Singapore (already initialized with synthetic seed data).

Refer to `docs/DEPLOY_VERCEL.md` for exact setup, environment variables, and verification steps. Configure `DATABASE_URL`, `SESSION_SECRET`, and `DEMO_ACCESS_PIN` in the Vercel dashboard; never place them in the repository. The API creates missing dock rows on startup; a real production rollout would use migrations.

## Security note

The PIN-based role selector is **interview pilot authentication only**, not enterprise-grade authentication. Do not use for real factory data. Access is enforced server-side; pin and signing secrets must remain environment secrets.

## Tests

```bash
cd backend && python -m pytest -q
cd ui && npm run build
```
