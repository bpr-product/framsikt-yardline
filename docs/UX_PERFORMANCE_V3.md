# Yardline — Operator UX & Performance Update (V3)

## Objective
Turn the Command Center from an oversized, passive KPI dashboard into an operator's working queue; make each mutation visibly responsive; and reduce avoidable server/database round trips. This is an enhancement to V2, not a replacement of its workflows.

## User-visible changes

| Before | After |
|---|---|
| Four tall, inert cards: Action needed, Trucks at plant, Occupied bays, Active recommendations | One compact, meaningful workflow toolbar with real click actions |
| Large, editorial-looking headline fonts | Consistent UI/system sans-serif typography, smaller scale, readable density |
| Clicking a readiness checkbox appears to do nothing while saving | The check changes immediately; its row says **Saving…** with an indicator. A rejected save restores the previous value and shows an error |
| UI remains disabled until POST plus multiple GETs complete | The POST controls completion. Other read queries refresh in the background |
| Opening a truck looks idle while loading details | A modal loading state appears immediately |
| Loading previously hidden for operations | Small, non-blocking updating/saving status is visible |
| Recommendation count is passive | "Needs attention" and "All suggestions" filter the list; "On site" and "Bays in use" open the relevant workspace |

### Command Center behavior
- Urgent filter is initially selected; selecting "All suggestions" reveals lower-priority items.
- Counts for on-site trucks and occupied bays navigate to the gate register and dock operations, respectively.
- Each recommendation retains "Review and act" to open the authoritative truck record.
- The rule-based nature of recommendations is explained quietly near the queue rather than promoted as a fourth metric.
- Responsive wrapping supports tablets and narrow terminals. Keyboard focus outlines and aria-pressed values are present.

### Save, loading, and error behavior
- Optimistic readiness update on Command Center readiness view and per-truck readiness view.
- Save response is authoritative; on failure, checkbox state is rolled back with an error message.
- During a save, the check is locked against duplicate submissions; relevant progress is visible in the row.
- For state transitions and issue actions, buttons show a save state and re-enable once the POST succeeds or fails. Other data is refreshed independently.
- Initial view switching loads only the data for the selected tab, not readiness, diagnosis, all issues, and types together.
- Problem Desk and truck issues show a loading state instead of claiming there are no issues before the first response.

## Backend performance corrections

### 1. Truck list query fan-out
`GET /api/v1/visits` previously called `detail()` for each truck. `detail()` looked up an assignment and dock. The collection endpoint now retrieves all current dock assignments in one joined query and serializes the truck list without N+1 database calls. The single-truck endpoint retains its detailed query.

### 2. Open issues with truck metadata
`GET /api/v1/issues` previously fetched all issues then performed an additional truck lookup per row. Now it uses one join to return plate and visit status for each issue.

### 3. Dedicated per-truck issue endpoint
Added `GET /api/v1/visits/{visit_id}/issues` to avoid requesting up to 300 issues for each truck detail dialog. Same session authorization applies; unknown visits return 404.

### 4. Decision queue clearance lookup
`GET /api/v1/decisions` previously looked up clearance events for each completed truck. It now loads cleared visit IDs in one query.

### 5. Checklist saving
`POST /api/v1/visits/{id}/readiness/{code}` previously committed and then re-entered `get()`, which read all readiness rows again. It now returns the saved values from the same transaction (no extra read/commit).

### 6. Serverless startup
FastAPI startup no longer runs SQLAlchemy `create_all` and dock seeding on every Vercel cold start; the existing production Neon schema stays managed through migrations. Local development keeps the convenient bootstrap path.

### 7. Fewer frontend requests
The per-truck modal only loads the active tab, and static issue types are cached for the current browser session. Checkbox saves no longer wait for the global dashboard and detail GETs.

## Files changed

- `ui/src/components/DecisionWorkspace.tsx`
- `ui/src/components/VisitDecisionPanel.tsx`
- `ui/src/services/DecisionService.ts`
- `ui/src/pages/App.tsx`
- `ui/src/main.tsx`
- `ui/src/styles/operations.css` (new, loaded after Midnight Brass)
- `backend/source/api/AppAPI.py`
- `backend/source/api/VisitsAPI.py`
- `backend/source/api/DecisionAPI.py`
- `backend/source/service/VisitsService.py`
- `backend/source/service/DecisionService.py`
- `backend/source/service/ReadinessService.py`
- `backend/tests/test_performance.py` (new)

## Verification

- 18 backend tests passed on the local SQLite test fixture, including new performance/query-count and per-truck issue tests.
- TypeScript syntax transpilation passed on all modified TSX files (not a full dependency-linked typecheck).
- CSS parser validated `operations.css` and the existing local styles.
- A full frontend production build requires installing dependencies and the actual new `theme-midnight.css` from the current GitHub `main` branch. The uploaded source ZIP predated the Midnight Brass theme, so this patch intentionally preserves the file from the live repository rather than replacing it.
- Manual browser/Playwright end-to-end tests, deployed production latency measurements, and current Vercel deployment have **not** been verified by this local patch. Do not claim deployment without a new matching commit and READY production alias.

## Deployment safety

The integration patch is designed for `bpr-product/framsikt-yardline` and preserves the existing `ui/src/styles/theme-midnight.css` on `main`. It only adds the final `operations.css` import after that theme.

Release steps: apply patch on current main, run backend tests and `npm --prefix ui run build`, push to a feature branch, review GitHub Actions, deploy a preview, and release production after a successful build and checks. Verify `framsikt-yardline.vercel.app` resolves to the new deployment ID.

## Remaining constraints

- First request to a cold serverless function or cold Neon database can still take longer; optimistic UI provides feedback but does not eliminate server cold starts.
- Time-sensitive shared resources should eventually use cache invalidation, request cancellation, and polling or real-time subscriptions.
- A real factory environment would also require multi-site tenancy, stronger concurrency tests, and dedicated E2E monitoring.
