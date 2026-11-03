# Yardline: rapid scenario-response demonstration

Date: 3 November 2026. Designed for the Framsikt engineering fundamentals case on 4 November, 10:00 IST.

## Engineering objective

The assignment describes truck waits of 8, 18 and 48 hours with no verified underlying causes. We should **not** claim to know the factory's actual root cause. Instead, demonstrate we can translate ambiguous operational problems into precise, testable decisions and protect real physical constraints.

The normal Yardline screens handle persisted truck actions. This new **Scenario Lab** is intentionally different: a **read-only synthetic environment** that exercises decision rules with edited operating conditions. It does not create, move, reschedule or release any real visit/dock in Neon. The UI calls FastAPI rule evaluation after each input change, not a fake hardcoded result.

## 16 operational situations

| Case | Trigger | What the engine decides |
|---|---|---|
| Late delivery replaced by another truck | Two hours late; another truck occupies the original booking | Original slot is not a right to interrupt an occupied bay; recommend the next safe opening or an alternative |
| Urgent/critical load | Urgent truck arrives behind a queue | Manager must approve priority; cannot preempt physically active loading |
| Peak arrivals | Several trucks arrive at once | Recalculate queue and show effects of staggered demand |
| Goods not ready | Outbound picking/staging incomplete | Block dock readiness and assign warehouse owner; try resolving readiness |
| Documents missing | Dispatch paperwork incomplete | Block and route to dispatch lead |
| Dock breakdown | Planned dock cannot be used safely | Exclude broken dock; use certified alternative or estimated repair |
| No crew | Physical dock free, no staff | No usable capacity until crew available |
| Forklift/equipment shortage | Required equipment unavailable | Wait, escalate maintenance, or assign alternate capable resource |
| Loading overrun | Previous operation takes longer than planned | Cascade estimated opening to next vehicle |
| Shift boundary | Too little staffed time to process load | Suggest next staffed shift unless authorized overtime |
| Walk-in | No valid appointment | Require verification and placement in queue under policy |
| Gate and yard congestion | Gate checks missing / yard full | Prioritize safety; do not admit more vehicles into unsafe space |
| Wrong dock | Dock cannot handle vehicle/cargo | Refuse unsafe allocation; do not fabricate exact ETA |
| Loading done but cannot depart | Dock still occupied, documents/clearance outstanding | Require physical bay release, paperwork and gate clearance in order |
| No-show | Carrier never appears in grace period | Release unoccupied reservation under policy; preserve occupied bay |
| Multiple overnight blockers | Goods, docs, dock and shifts combine | Use overlapping prerequisites, show bottlenecks without summing all reason durations |

## Real working interface

Navigation: `Plan & review` -> `Scenario lab`.

- Select any of 16 presets.
- Review the situation and its assumed inputs.
- Adjust late arrival, physical dock occupancy, number of trucks ahead, expected service duration, readiness, safety, staffing, shifts, priority, overtime and alternate capacity.
- The app asks the FastAPI rule engine to recalculate the forecast and decision.
- Click a proposed action (e.g. `Approve urgent priority`, `Confirm goods are staged`, `Model available alternate dock`) and see the estimated change to the feasible start window.
- Decision trace explains hard constraints, current inputs and the recommendation's assumptions.
- The application always says *synthetic; no live writes*.

### Suggested 90-second interview demonstration

1. Start with the original **two-hours-late truck** case. Read aloud: “Booked at 10, arrives at 12, another truck occupies the dock until 1.” The engine shows a 60-minute estimated wait for the old dock. It does **not** claim the late carrier may interrupt ongoing work.
2. Click **Model available alternate dock**. The estimated wait drops to zero *in the model only*. Explain that an actual assignment still needs supervisor safety and compatibility verification.
3. Switch to **Urgent delivery joins a full queue**. Initially urgent priority requires approval and the truck stays behind two waiting trucks. Click **Approve urgent priority**. The proposed wait drops from 175 to 35 minutes but the current truck's 35-minute loading remains protected.
4. Switch to **Collection before goods are ready**. The system blocks work and names the warehouse lead. Click **Confirm goods are staged** and show how the issue clears.
5. If time permits, show a **Dock breakdown** or **Shift boundary** case, then return to the normal Gate / Readiness / Docks screens to demonstrate the actual persisted operations.

## Why this is engineering (not merely a mockup)

- The simulator calls real, typed Python business rules through authenticated FastAPI endpoints.
- Cases share the same configurable input/constraint model, instead of a separate static page for each scenario.
- Physical safety and compatible dock requirements take priority over expedited delivery flags.
- A verified urgent truck may move ahead of a waiting queue only with manager approval; work already at the bay cannot be preempted by a software button.
- Simultaneous delays are modeled as a maximum prerequisite completion time and resource queue time, rather than blindly summing overlapping blockers.
- Unknown dock compatibility results in an unknown ETA, not a fabricated number.
- All routes are **read-only with respect to operational state**; no Neon migration is necessary.
- Tests include late arrivals, urgency, broken docks, crew/equipment shortages, shift boundaries, queue effects, no-shows, paperwork, completion clearance, safety overrides and validation errors.

## Honest scope and technical limitations

- This is a decision-policy sandbox for a **single compatible bay with serial service time**. It is not a mathematical optimization of real multibay factory operations.
- The 45-minute grace period is an illustrative assumption; the factory must provide its policy.
- Shift reopen times, repair estimates, equipment readiness and service durations come from synthetic inputs. Production would require live resources, appointments and historical data.
- 'Try' actions change **only the simulated input state**; they do not notify real carriers, update Neon, create real blockers or move vehicles.
- A full production engine would use persisted dock reservations, resource calendars, visit-level queue eligibility, policy approvals, event streaming, ETA updates and carrier notification. Build these after discovering actual factory constraints.
- For the interview: **define problem -> identify decision -> show one implemented rule -> show measured outcome assumptions -> explain what would need to be true to deploy**.

## Technical files

- `backend/source/service/ScenarioService.py`: presets, Pydantic states, deterministic policy evaluation.
- `backend/source/api/ScenarioAPI.py`: authenticated GET catalogue + POST evaluate.
- `backend/tests/test_scenario_lab.py`: focused rule tests.
- `backend/tests/test_scenario_api.py`: HTTP authorization/validation/integration tests.
- `ui/src/pages/Scenarios/ScenarioLabPage.tsx`: scenario selector, interactive sliders, decision trace and "Try" actions.
- `ui/src/pages/Scenarios/scenario-lab.css`: premium UI scoped styles.
- `ui/src/services/ScenarioService.ts` and `ui/src/types/scenarios.ts`: typed client contracts.
- Existing app changes: `backend/source/api/AppAPI.py`, `ui/src/pages/App.tsx`, `ui/src/constants/navigation.ts`.

## Recommended short explanation

> “I treated this as an uncertain operations problem, not just a CRUD app. I mapped sixteen plausible exceptions: late arrivals, urgent deliveries, queues, readiness, breakdowns, staff and equipment, shift changes, and paperwork. I wrote one explainable rule engine to test how those constraints affect the next feasible dock slot. This lab is synthetic and read-only, while the core Yardline application handles actual persisted truck workflows. That let me demonstrate a broad set of cases quickly, without claiming to have the factory’s real data or having built a full industrial optimizer.”
