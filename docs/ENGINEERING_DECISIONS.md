# Engineering fundamentals — interview notes

## Investigate before writing code
The problem statement gives only truck wait times (8/18/48 hours), not causes. Ask which timestamps matter, what stage consumes time, whether delays cluster by shift, cargo or readiness, and what capacity can physically process. Manual tracking may be the best first move.

## Why this prototype?
The app demonstrates a *conditional* solution for a coordination bottleneck. It does not establish that software is needed, and it does not claim real impact. A real pilot requires ground truth and baseline metrics.

## End-to-end lifecycle
`scheduled -> checked_in -> ready -> at_dock -> loading -> completed -> departed`, with a hold path from `checked_in` or `ready`, and a recovery `on_hold -> ready`.

Backend services validate all transitions. The frontend shows only permitted actions, but backend permissions are authoritative.

## Concurrency
Dock assignment locks selected visit and dock rows in the same database transaction, then inserts an assignment. A unique nullable active dock key and active visit key block double booking even if two requests race. SQLite is for local development; PostgreSQL is the target for concurrent production workers. The rule is stronger than a frontend available/free check.

## Audit trail
Each state change saves an immutable event with actor and timestamp. The event record and visit state are committed together. This lets us reconstruct a truck's timeline and compute delay segments.

## Operations and limits
- One service with distinct API/service/DAL layers instead of premature microservices.
- Records stored in relational tables; searchable by visit status.
- Role-based server authorization for every mutation.
- Basic error codes: 401 unauthenticated, 403 forbidden, 404 unknown truck, 409 invalid transition/conflict, 422 validation.
- No AI is necessary for the first scheduling/coordination pilot; it would be premature without trustworthy data.
- Data and identities are fabricated. Replace PIN demo auth before using with real users.

## Risks and follow-up
- Need proper historical telemetry and real hold-stage start/end transitions for accurate hold-duration analytics.
- Add full Alembic migrations and background metric aggregation for a scaled deployment.
- Appointment scheduling must also account for arrival variance, goods/document readiness, and physical processing capacity.
- Integration with weighing, ERP or yard hardware remains a later decision based on evidence.

## Demo walkthrough
1. Coordinator creates inbound appointment.
2. Gate operator checks in truck.
3. Supervisor places truck on hold (e.g. documents pending), then marks ready.
4. Supervisor assigns a compatible free dock and starts service.
5. Supervisor completes service, releasing dock.
6. Gate operator records exit.
7. Manager inspects immutable events and summary metrics.
8. Show invalid transition and attempted duplicate assignment are rejected by API.
