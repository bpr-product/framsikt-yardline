# Yardline V2 — Interview implementation report

Version: 2 November 2026. Source of truth: `YARDLINE_COMPLETE_SOLUTION_BLUEPRINT.md`.

## Product story

**Question → observe → detect → assign owner → take action → verify result → measure.**

This is a working, synthetic single-plant interview pilot. The interview's 8h/18h/48h examples do not establish causes. Do not present simulated records as observed factory findings.

## Delivered in the first V2 implementation slice

| Capability | User-facing result | Backend / evidence |
|---|---|---|
| Command center | Prioritized recommendations with evidence, owner and review action | GET `/api/v1/decisions` with explicit rules |
| Problem desk | Structured issues; resolve, audit and manager escalation | `issues` table; POST create / resolve / escalate |
| Direction-specific readiness | Inbound: PO, crew, equipment. Outbound: picked, staged, documents | `readiness_checks`; server blocks `ready` and `assign` until checks pass |
| Appointment planner | 08:00-18:00 IST Mon-Sat slots, per-direction capacity, overbooking guard | GET `/planning/slots`, transactional booking validation, reschedule history |
| Gate operations | Record outside-gate observed arrival; handle walk-ins | POST `/outside-arrival`, `/visits/walk-in` |
| Dock lifecycle | Keep dock occupied after service completion; release only after vehicle leaves | POST `/release-dock`; unique active dock constraints |
| Service interruption | Pause with reason, resume, timestamps in immutable event history | `/pause`, `/resume` with state checks |
| Departure safety | Enforce physical dock release, document clearance, and no open blockers | POST `/clearance`, then `/depart` |
| Visit diagnosis | Stage-by-stage measured intervals; unknown data remains unknown | GET `/visits/{id}/diagnosis` |
| Manager analysis | p50/p90/p95, n, inbound/outbound, issue reasons, unresolved count | GET `/analytics/overview` |
| Technical checks | 14 backend regression tests and TypeScript syntax validation | CI backend + frontend build |

## Why there are not 59 UI implementations yet

The blueprint contains 59 foreseeable situations. Some are solved directly by the shared mechanisms above; many require actual site configuration, external data and other new modules. The documented **next** capabilities include resource calendars, site-specific safety rules, freight contract charging, capacity by processing duration, yard zones, equipment management, secure company-specific identity, ERP/ASN integration, notification delivery, offline queue, detailed idempotency, true PostgreSQL concurrent testing, and live pilot analysis.

## Architecture

- Backend: FastAPI with separate `api/`, `service/`, `schemas/`, and `dal/` layers.
- PostgreSQL: Existing `visits`, `assignments`, `docks`, `events` preserved; additive `issues` and `readiness_checks` tables.
- Frontend: React + TypeScript, dedicated V2 decision components and API client.
- Authentication: Shared demo PIN accounts only; do not use in a real plant.
- Source timestamps: Server-generated UTC for operational events; site time shown in Asia/Kolkata.
- Concurrency: PostgreSQL row locks and unique active dock/visit keys; appointment validation locks compatible dock records before count.
- No background jobs currently. Recommendations are computed when requested; event-driven notification delivery remains future work.
- The planner's one-dock-one-booking-per-hour assumption is **illustrative**, not actual throughput; replace with factory-specific service durations, crew/equipment availability and shift data before rollout.

## Interview walkthrough

1. Open **Command center** and show one actionable cause with the assigned owner.
2. In **Problem desk**, record a blocker (e.g. goods not staged); server rejects readiness.
3. In **Readiness**, confirm the direction-specific checklist, resolve the issue, and mark the visit ready.
4. With a suitable dock free, use the command-center suggestion to assign the truck.
5. Start service; pause and resume to show an interruption.
6. Complete service and show that the dock is **still physically occupied**.
7. Confirm the truck moved out of the bay, then confirm exit clearance and record departure.
8. Open **Time breakdown** to see measured segments; open **Analysis** for percentile metrics, sample size, and cause counts.
9. Show a conflicting dock assignment returns 409 and that server-side role authorization blocks invalid actions.
10. Explain the next low-investment experiment and show the design is an exploratory pilot, not a claimed factory improvement.

## First-class limitations

- Demo records are synthetic; no actual freight savings or detention charges.
- No actual proof of 8/18/48h delay causes.
- Some legacy visits have missing milestone events; diagnosis labels these as incomplete rather than estimating.
- Real-time staffing and equipment availability are not integrated; dock recommendations require supervisor verification.
- Manager override, double-cause attribution and external live notification queue are deferred.
- CI uses SQLite; PostgreSQL race test and authenticated browser end-to-end tests are next.
- Runtime deployment health must be checked on the actual Vercel URL; deployment marked READY alone is not proof of operational success.

## Release checklist

1. Apply additive migration `backend/migrations/002_decision_ops.sql` with a schema owner.
2. Run tests locally: `cd backend && python -m pytest -q tests/`.
3. Check CI backend and frontend build against the exact new commit.
4. Deploy Preview and verify API readiness, UI and permissions.
5. Release production after validation, with a rollback plan to the previously working deployment.
