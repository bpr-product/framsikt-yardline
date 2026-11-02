# Yardline: Complete factory truck waiting-time solution blueprint

Version: 1.0 | Planning reference | 2 November 2026
Purpose: Framsikt Round 2 engineering-fundamentals interview and implementation plan.
Current application: https://framsikt-yardline.vercel.app
Canonical source: https://github.com/bpr-product/framsikt-yardline

## 0. The product we are actually building

**Product goal:** Reduce preventable truck waiting at a manufacturing site by coordinating carrier appointments, goods/document readiness, gate/yard operations, compatible docks, crew/equipment, loading/unloading, clearance and departure. Record the evidence needed to understand which intervention helped.

**The difference from a tracker:** A tracker records *what happened*. Yardline should also answer *why is this truck waiting, what should happen next, who must act, and what is likely to happen if nobody acts?*

**Decision loop:** Observe -> detect a problem -> identify the responsible owner -> recommend a permissible action -> perform/track that action -> measure its effect.

**Case constraints:** The given 8-, 18- and 48-hour figures have no validated causes. The manufacturer wants improvements but does not want a large investment without evidence. We will develop a focused, low-cost pilot and use synthetic test cases to demonstrate the design; we will not claim observed factory savings.

**Scope:** One factory/plant, inbound and outbound truck visits, four core operational roles, a configurable calendar and 4 example docks. Real carrier integration, IoT sensors, weighbridges, ERP write-back and predictive AI are optional future stages, not prerequisites.

**Limits:** No design can pre-enumerate literally every future manufacturing incident. This document covers major foreseeable operational, data, safety, security and reliability scenarios, with an extensible exception model for new ones.

## 1. The 12 interview questions translated into information requirements

| Interview question | Data we need | Product decision it supports |
|---|---|---|
| 1. What do 8/18/48 hours represent? | Outside-gate arrival, entry, service start/end, exit, source | Separate waiting, productive work and total site dwell |
| 2. All trucks or certain types? | Inbound/outbound, carrier, cargo, vehicle type, visit volume | Segment diagnosis; different inbound/outbound prerequisites |
| 3. How many arrive and when? | Booked ETA, actual arrival by hour/day, late/early variance | Appointment capacity and peak-arrival smoothing |
| 4. What is the complete workflow? | Stage sequence, activity, owner, handoff | Stage state machine and ownership |
| 5. Where is time spent? | Server timestamps, hold intervals, dock movements, service intervals | Bottleneck analysis and long-tail reporting |
| 6. Docks, labor and shifts? | Dock capacity, compatibility, availability, staff/equipment calendar | Feasible time slots and allocation |
| 7. Idle docks while trucks wait? | Occupancy and ready queue at the same time | Detect coordination problems rather than a capacity shortage |
| 8. Appointments or walk-ins? | Slot requests, confirmation, no-shows, walk-ins | Controlled scheduling and exception handling |
| 9. Goods and documents ready? | Readiness checklist per direction, blockers, owners, deadlines | Pre-arrival prevention and gate-to-dock eligibility |
| 10. Nights/weekends? | Site, gate, dock, crew and supplier operating calendars | Avoid closed-hour dispatch and plan shift transitions |
| 11. Records and cost? | Data sources, quality, contract grace periods/rates, invoices | Baseline, detention-risk and credible cost report |
| 12. Target and small pilot? | Current p50/p90, explicit target, pilot cohort, budget/owners | Evaluation design and rollout decision |

If a recruiter cannot answer, say what you would request from factory stakeholders, the reasonable data collection method, and what decisions must wait for evidence. Never substitute an invented factory fact for a question.

## 2. The proposed operating model: people + workflow + automation

### Personas

- **Carrier/driver (lightweight, pilot extension):** Request/confirm slot, provide ETA/reference, receive permitted instructions. May initially communicate through coordinator; no driver account is needed for the first demo.
- **Logistics coordinator:** Plan appointments, validate inbound/outbound load details, reschedule, manage carrier contacts, review capacity, resolve disputes.
- **Warehouse/dispatch lead:** Confirm outbound picking/packing/staging or inbound receipt/crew/equipment readiness; resolve missing items and documents.
- **Gate/security operator:** Record arrival including externally queued vehicle where feasible, validate identity and safety/entry requirements, direct to safe yard zone, record departure.
- **Dock supervisor:** Manage compatibility, available labor/equipment, assignment, physical arrival, service, pause, release, incidents.
- **Factory manager:** Monitor aging queues and costs, assign escalation owners, approve overrides, review bottlenecks and pilot results.
- **System (automations):** Validate scheduling, recompute eligibility, raise alerts, maintain audit events, calculate time/risk, propose safe next actions. Recommendations are explainable; safety-critical actions remain human-approved.

For the interview, present four login roles already present (coordinator/gate/supervisor/manager) and show warehouse readiness as a supervisor/coordinator responsibility until a separate warehouse role is built.

### Golden workflow

Carrier demand or ERP order
  -> appointment request
  -> slot and capacity validation
  -> pre-arrival readiness confirmation
  -> actual arrival / outside-gate record
  -> gate verification and check-in
  -> safe yard placement and queue eligibility
  -> priority-aware compatible dock suggestion
  -> supervisor approves dock and physical movement
  -> pre-service safety checks
  -> load/unload (pause/resume if necessary)
  -> receipt/shipment and document clearance
  -> physically leave dock / release dock
  -> gate exit
  -> automatic time/cost report and root-cause analysis.

Parallel to the journey: holds/problems, owners, reminders, escalations, ETA adjustments, cancellations and auditable overrides. Inbound and outbound share this backbone but have different readiness and completion checklists.

### Core principle

The operator records a *meaningful action* once (e.g., "Goods staged" or "Truck at dock"). The system generates timestamps, events, queue changes and metrics. We should not ask users to manually type arrival, departure and stage-duration numbers unless correcting a record with an auditable reason.

## 3. Design each main flow from input to decision

### Flow A: Appointment planning (prevent bunching)

**Trigger:** Carrier/coordinator wants to send a truck for inbound delivery or outbound collection.

**Inputs:** Plant, direction, shipment/order reference, carrier, vehicle class/size, cargo/handling requirements, preferred arrival window, estimated loading duration, required dock type, hazardous/safety flags, contact, reference documents.

**System action:** Load shift calendar, compatible docks, maintenance reservations, planned workload, crew/equipment constraints, slot buffers and yard limit. Display a capacity heatmap and feasible windows. Estimate service time from configured cargo class or cautious fallback. Display uncertainty, never a promise of exact waiting time.

**Decisions:** If requested time is feasible, confirm it; if not, show 2-3 alternatives or a waitlist. Warn about shift cut-off or absent readiness. Allow authorized override only with recorded reason and capacity-risk indicator. Issue appointment reference and ETA reminder.

**Screen:** `Schedule / New appointment` with available slots, in/out toggle, workload, readiness status, and one clear confirmation action.

**Data/events:** Appointment, service estimate, time window, capacity reservation, change history, notification attempts.

**Exceptions:** duplicate booking, no capacity, dock incompatibility, last-minute change, carrier cancellation, multi-load carrier, hazardous cargo requiring specialist authorization, API retry.

**Success condition:** We avoid avoidable overbooking and can explain why each slot was accepted or rejected.

### Flow B: Pre-arrival preparation (avoid arriving for unready work)

**Trigger:** Appointment confirmed, e.g., one day before and again near the arrival window (interval configurable).

**Outbound inputs:** Pick complete, packed/staged, loading crew available, stock/location confirmed, transport/shipping papers prepared, any dispatch release.

**Inbound inputs:** Expected purchase order / ASN or delivery note, receiving area available, unloading crew and equipment, inspection plan, permitted unloading conditions.

**System action:** Show a per-visit readiness checklist with a responsible person and expected ready time. For failed checks, create a structured blocker and show the carrier/coordinator an at-risk appointment. Recommend delaying dispatch or rescheduling when safe and operationally feasible.

**Decisions:** `Ready for arrival`, `At risk`, or `Blocked - do not dispatch` (policy-driven). Do not automatically cancel or reject a real carrier without the factory's rules; a human confirms external communication.

**Screen:** `Upcoming / Readiness` with actionable checks, owner, remaining time to slot, and risk.

**Events:** readiness_check_completed/failed, block_created/cleared, pre_arrival_notification, rescheduled.

**Success condition:** More trucks arrive at a time when the factory can actually service them.

### Flow C: Arrival and gate (capture outside-gate wait)

**Trigger:** A vehicle approaches or reports arrival.

**Inputs:** Appointment reference, vehicle plate, carrier/driver identity, actual outside-gate timestamp if observable, entry timestamp, basic safety/identity/doc checks, approved parking/yard zone.

**System action:** Match the appointment; flag wrong plate, duplicate active visit, early/late/unplanned arrival, safety hold, or full yard. Give the gate a clear `Admit`, `Wait in designated zone`, `Request coordinator approval`, or `Refuse with documented reason` choice according to site policies. Generate queue position only after eligibility rules are satisfied. Never route a truck into an unsafe/full yard.

**Screen:** `Gate desk` with one-field search/scan, upcoming arrivals, current queue, problems requiring attention, instructions, confirmed action.

**Data/events:** external_arrival_at (source/confidence), gate_check_in_at, location/zone, identity validation, reason for rejection/hold.

**Exceptions:** walk-in, truck too early, too late, wrong plate, missing permit, one trailer with different tractor plate, no yard space, gate closure, offline terminal.

**Success condition:** Reliable entry measurement and safe, fast admission without losing unplanned arrivals.

### Flow D: Yard queue and next action (avoid invisible waiting)

**Trigger:** A visit is checked in or its readiness/priority/dock status changes.

**System action:** Evaluate eligibility: physical location, readiness, safety, document requirements, dock compatibility, available crew/equipment, shift availability. Separate **ready queue**, **blocked queue**, **future appointments**, **at dock**, and **ready to exit**. For each waiting truck show elapsed time, time since last action, main blocker, owner, predicted next actionable milestone and a single recommended action.

**Queue rule:** An explainable policy such as appointment adherence, first-eligible time, duration waited, contractual priority and imminent detention threshold. Use safety and compatibility as hard constraints. Do not blindly use FIFO or prioritize expensive contracts without an agreed policy. A manager override has a reason, permission and audit event.

**Screen:** `Operations command center`, sorted by action urgency not truck registration number.

**Events:** eligible_for_dock, priority_changed, blocker_owner_assigned, recommended_action_acknowledged, queue_override.

**Success condition:** Every aging truck has a visible reason, owner and next action; no ready truck is forgotten while feasible capacity is idle.

### Flow E: Dock / resource allocation (solve assignment conflicts)

**Trigger:** A ready/eligible truck can be served.

**System action:** Calculate dock compatibility (direction, truck size, cargo restrictions, safety equipment, operational state), shift/crew/equipment readiness, physical dock occupancy and other reserved commitments. Recommend feasible docks and show reason for ineligibility. Supervisor confirms an assignment; gate/driver receives movement instructions. Track `assigned` separately from `physically at dock`.

**Backend transaction:** Lock visit and candidate dock rows, re-read conditions, ensure dock and visit have no active assignment, atomically insert assignment and an audit event. Unique constraints prevent duplicate occupancy even under races; retry returns an informative conflict. Reserve exact current capacity, not what the browser last displayed.

**Screen:** `Dock board` with available/occupied/out-of-service, direction compatibility, ETA, crew/equipment and assigned truck.

**Events:** dock_assigned, moved_to_dock, dock_arrival_confirmed, dock_released, assignment_conflict, override_requested.

**Exceptions:** two supervisors race for same dock, dock occupied despite UI "free", incompatible truck, dock in maintenance, truck no-show at assigned bay, missing forklift/crew, unsafe movement, permitted reassignment.

**Important correction to current app:** Finishing loading must not necessarily release the dock: service may finish while the truck remains physically parked at the bay. Dock release occurs when a person confirms physical departure from that dock.

### Flow F: Loading / unloading (distinguish productive service from interruptions)

**Trigger:** Truck physically at dock and site-specific safety checks passed.

**System action:** Supervisor confirms work start. Record service type, crew and equipment if needed. If a problem arises, pause service with a reason/owner; keep occupancy recorded until the vehicle actually leaves. Resume only when the blocker is cleared. If needed, initiate a supervised safe-transfer/reassignment workflow.

**Inbound flow:** unload -> verify against PO/ASN -> record quantity/damage discrepancy -> QC/receiving decision -> confirm relevant receipt and docs (manual pilot check, ERP integration later).

**Outbound flow:** verify staged load -> load -> check quantity / seal / safety -> confirm shipping documents and release.

**Screen:** `Dock work order` with checklist, current timer, Start/Pause/Resume/Complete actions, discrepancy capture and safe dock release action.

**Data/events:** physical service intervals, pause intervals, discrepancy, completion confirmation, actor, timestamp.

**Exceptions:** longer-than-expected service, damage, quantity mismatch, missing pallet, equipment breakdown, crew change, trailer swap, shift handoff, unsafe condition, partial load/unload.

**Success condition:** True productive duration and interrupted duration can be measured separately, and safety/quality checks cannot be skipped through UI/API.

### Flow G: Exit and clearance (solve post-loading waits)

**Trigger:** Service completed.

**System action:** Validate required shipping/receipt/QC/docs and departure authorization. If blocked, create clearance task with owner and time. Once physically clear of dock, release dock. Once exit conditions are satisfied, gate records final departure; automated report updates.

**Screen:** `Ready to depart` and `Exit exceptions`, with checklist and document owner.

**Data/events:** service_completed_at, dock_left_at, paperwork_ready_at, gate_cleared_at, departed_at; distinguish paperwork time from gate queue.

**Exceptions:** missing goods receipt, seal mismatch, unapproved dispatch, quality hold, payment/doc approval, truck cannot move, exit gate closed.

**Success condition:** Completed trucks leave promptly, while releasing dock capacity safely and accurately.

### Flow H: Exceptions, ownership and escalation

**Trigger:** Any unmet prerequisite, inactivity timeout, risk threshold, failed handoff or manual incident.

**System action:** Create a structured exception with category, reason code, affected visit/dock, severity, responsible team/person, opened time, target resolution, current status, evidence and linked actions. An exception can block one action, delay a visit, or require escalation. Notify/re-notify based on configurable rules. Resolve only with recorded outcome and closure time.

**Screen:** `Problems to resolve` with cards `Needs owner`, `Overdue`, `Escalated`, `Resolved`; visit detail shows all active blockers.

**Timing:** The same 90-minute interval cannot be counted twice as 90 minutes of "dock wait" plus 90 minutes of "documents hold" in total wait. Show concurrent causes, and use a documented primary-attribution rule for any single "minutes by cause" chart.

**Success condition:** Issues are acted on and measured, not just recorded as free-text notes.

### Flow I: Real-time operational recommendations

**Examples (rules, not AI):**

- Ready trucks waiting + compatible free dock + crew available -> `Assign dock now`; show impacted truck(s).
- Outbound shipment lacks staging readiness + truck dispatch expected soon -> `Contact shipping lead / reschedule before arrival`.
- Scheduled arrivals exceed service capacity in a 2-hour window -> `Offer alternate slots`.
- A truck is approaching an agreed cost/free-time threshold -> `Escalate to owner`, without claiming exact charges absent contract terms.
- Truck is on hold past site threshold -> `Escalate unresolved issue`.
- Service complete but truck remains at dock -> `Confirm safe clearance and physical dock release`.
- Truck queue grows across a shift boundary -> `Evaluate later slot, overtime or shift plan`.

**Engineering:** Rule evaluator consumes consistent visit, event, appointment, dock, shift and exception state. Each recommendation has a reason, evidence, confidence/limitations, allowed actions, responsible role, generated time, dedupe key and state (open/acknowledged/resolved/dismissed). Recommendations do not secretly mutate critical physical state.

**Screen:** `Next best actions` at top of command center. Every recommendation links to the exact operational action.

### Flow J: Manager diagnosis and pilot measurements

**Input:** Timestamped stages/events, resolved exception intervals, capacity snapshots, appointments, calendars, carrier contract terms (if available).

**System action:** Compute p50/p90/p95 total dwell, pre-service waiting, service time, service interruption, post-service delay, early/late arrival variance, readiness delays, dock idle/occupied time, overdue hold counts, cause distribution and optional detention-risk estimates. Analyze by direction, shift, carrier, cargo class and dock. Always show sample count, time range, completeness and synthetic/real label.

**Recommendation examples:**

- `p90 wait-to-dock high` with `usable dock idle` -> inspect dispatch communication and gate-dock handoff.
- `late goods readiness` dominates outbound waiting -> introduce pre-dispatch readiness gating.
- `arrival volume spikes` with overloaded slots -> test staggered appointments.
- `delays concentrate on Sunday/night` -> review calendar and carrier dispatch rules.
- `high dock occupancy and long service durations` -> evaluate extra shift/equipment only after the low-cost alternatives.

**Screen:** `Delay analysis` -> click a red p90 tail -> individual timeline -> aggregated reason/evidence -> suggested small pilot.

**Success condition:** A manager can identify a likely root cause and select a measurable intervention; charts do not pretend to prove causality without a trial.

## 4. Scenario coverage catalog: detection -> decision -> handling

Legend: P0 = highest-priority interview slice; P1 = pilot depth; P2 = later, contingent on real use. `Detect` describes proposed behavior, not current code. Codes are stable references for testing.

### A. Planning and arrivals

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| A01 | Many trucks booked for the same hour | Slot workload exceeds configured dock/crew capacity | Warn/reject overbook; offer alternative slots; coordinator confirms | P0 |
| A02 | Appointment at shift close/closed day | Site calendar conflicts with expected service duration | Suggest feasible next slot; warn of overnight risk | P0 |
| A03 | Truck arrives early | Actual arrival before grace window | Safe waiting instructions, defer admission/early slot if feasible | P1 |
| A04 | Truck arrives late | Actual arrival after grace window | Re-evaluate capacity, keep actual arrival, reassign slot or accept | P0 |
| A05 | Truck never arrives | Time window passes and no arrival observed | Flag no-show for coordinator, free planned reservation after policy grace | P1 |
| A06 | Unscheduled walk-in | Plate/reference has no confirmed visit | Controlled provisional visit, coordinator review, safe queue/deny | P1 |
| A07 | Carrier cancels | Carrier/coordinator cancels appointment | Free reservation, preserve event history, notify affected team | P1 |
| A08 | Duplicate booking/refresh retry | Same reference/visit request or idempotency key | Return existing booking; no duplicate workload reservation | P0 |
| A09 | ETA changes repeatedly | Updated ETA differs from slot | Reforecast capacity; prompt reschedule, retain ETA history | P1 |
| A10 | Inbound and outbound compete for one bay | Dock only allows certain direction/configuration | Compatibility-aware schedule; no invalid assignment | P0 |

### B. Readiness and documentation

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| B01 | Outbound goods not picked | Pick/stage checklist incomplete near slot | Hold dispatch readiness, assign warehouse owner, recommend later ETA | P0 |
| B02 | Goods picked but not packed/staged | Different checklist items remain incomplete | Block dock-ready; display missing work, estimate readiness | P0 |
| B03 | Inbound ASN/PO reference missing | Mandatory inbound reference not verified | Receiving exception; document request/manual approval path | P1 |
| B04 | Shipping paperwork incomplete | Dispatch docs incomplete at pre-arrival or exit | Open paperwork exception; show responsible owner | P0 |
| B05 | Quantity mismatch | Scan/manual check differs from order/ASN | Discrepancy case; accept partial/hold/return only by policy | P1 |
| B06 | Damaged/unsafe goods | QC or safety rejection | Isolate stock, quality owner decides, preserve dock safety | P1 |
| B07 | Wrong truck / load reference | Plate/reference/driver mismatched | Gate review; reject or correct with authorized audit | P1 |
| B08 | Goods become unready after check-in | Readiness revoked | Recalculate eligibility; hold from any safe stage | P1 |

### C. Gate and yard

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| C01 | Wait starts outside factory | External queue observation / carrier arrival | Record separate external arrival and gate entry | P0 |
| C02 | Gate slow or paperwork queue | Gap between external arrival and gate entry | Show gate-stage aging and staffing hypothesis | P1 |
| C03 | Yard at maximum safe occupancy | Active trucks vs allowed yard zones/spaces | Stop unsafe entry; direct to approved off-site waiting area | P1 |
| C04 | Truck parked in wrong zone | Zone mismatch, verified by gate | Redirect safely and record movement | P2 |
| C05 | Driver requires legal break | Driver/transport reports unavailable | Hold and reschedule with safety constraints; no forced unsafe movement | P1 |
| C06 | Gate device offline | No server acknowledgement / local network loss | Queue signed/intended events locally where safe; reconcile, never fabricate times | P2 |
| C07 | Two visits have the same plate | Plate repeats but different visit windows/loads | Identify by visit/reference + plate; active duplicate warning | P0 |

### D. Dock, crew and equipment

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| D01 | All compatible docks occupied | Live assignments/occupancy | Keep eligible queue, forecast next availability, consider shift options | P0 |
| D02 | Compatible dock free while ready truck waits | Free dock + eligible ready queue + crew available | Surface actionable alert; supervisor assigns | P0 |
| D03 | Dock incompatible with truck/cargo | Size/direction/safety capability mismatch | Remove from eligible dock list; show reason | P0 |
| D04 | Dock empty but no crew | Staffing calendar absent | Do not recommend unsafe/false assignment; ask staffing lead | P1 |
| D05 | No forklift or required equipment | Equipment readiness false | Put resource hold; propose alternate capable dock/equipment | P1 |
| D06 | Dock suddenly breaks | Incident open, dock unavailable | Stop new assignments; pause work, safe relocation if approved | P1 |
| D07 | Two supervisors assign same dock | Simultaneous atomic transactions | One succeeds; other receives 409 and refreshes | P0 |
| D08 | Truck assigned but not physically at dock | Assigned_at exists; dock_arrived_at missing | Separate status, warn after threshold; preserve reservation policy | P0 |
| D09 | Service completed but truck still occupies dock | Service complete; physical exit not confirmed | Keep dock occupied until physical departure | P0 |
| D10 | Dock needs maintenance window | Scheduled unavailability | Remove from booking capacity and assignment | P1 |
| D11 | Assignment needs reassignment | Physical safe status + new compatible dock | Controlled release/reassign with actor, old/new dock, reason | P1 |

### E. Loading, unloading and departure

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| E01 | Service longer than estimate | Actual service minutes above plan | Supervisor alert; adjust downstream ETA, don't falsify appointment | P1 |
| E02 | Operation pauses | Operator reports breakdown/quality/crew | Pause interval, linked issue and owner; resume with permission | P1 |
| E03 | Partial load/unload | Confirmed quantity below expected | Partial completion decision and document update; don't claim full completion | P1 |
| E04 | Inbound inspection finds damage | Quality discrepancy | Separate QC case, decide quarantine/receipt/return | P1 |
| E05 | Finished truck awaits documents | Finish timestamp with incomplete clearance | Alert dispatch/doc team; measure finish-to-release wait | P0 |
| E06 | Truck cleared but gate exit is slow | Clearance done, depart missing | Gate queue alert, aging clock and action owner | P1 |
| E07 | Truck cannot leave physically | Repair/driver/route incident | Safe hold; keep correct dock or yard occupancy, arrange action | P1 |
| E08 | Shift changes during service | Planned shift handoff | Transfer accountable owner, preserve running service interval | P1 |
| E09 | Driver reports wrong load/seal | Check mismatch | Stop departure, reopen issue, appropriate authorised correction | P1 |

### F. Visibility, data and reliability

| Code | Scenario | Detection / evidence | Product response and human action | Priority |
|---|---|---|---|---|
| F01 | Truck waiting with no named owner | Open issue/visit without responsibility | Require owner on delay; escalate after threshold | P0 |
| F02 | Truck waiting too long | Stage age > configurable policy | Alert, assign next action, log acknowledgment | P0 |
| F03 | Long overnight/weekend delay | Stage spans scheduled closure | Flag calendar-related hypothesis, suggest re-plan; distinguish actual cause | P0 |
| F04 | Missing/incorrect timestamp | Gap/inconsistent sequence/manual correction | Data-quality warning; audited correction with reason | P0 |
| F05 | Two blockers overlap | Same time segment has multiple open issues | Record both; attribute total waiting once using primary-cause rules | P1 |
| F06 | UI shows stale dock state | Current version differs from request | Reject stale action/refresh; return current occupancy | P0 |
| F07 | Browser retries failed network action | Repeated idempotency key | Return original outcome and no duplicate event | P0 |
| F08 | Data source conflicts with gate record | ERP/driver/API times differ | Preserve source, flag mismatch and adjudication | P1 |
| F09 | Coordinator overwrites completed visit | Invalid transition / version / permission | Deny mutation; documented audited correction path only | P0 |
| F10 | Detention rate unknown | No contract free time / charge rules | Show hours at risk without invented monetary amount | P0 |
| F11 | Manager tries to optimize without baseline | No reliable comparison data | Show sample and completeness; label effect as unproven | P0 |
| F12 | Operator receives too many duplicate alerts | Repeat same condition | Deduplicate, acknowledge/snooze with audit, escalate changed severity | P1 |
| F13 | Access role lacks permission | Server check blocks action | HTTP 403; UI explains who can perform it | P0 |
| F14 | Unexpected system outage | API/DB health or failed operation | Explicit error, retry-safe actions, manual fallback and reconciliation | P1 |

**Coverage:** 59 enumerated situations across six families. They are design requirements to evaluate and implement in stages, not 59 features currently delivered.

## 5. Root-cause / decision engine: evidence to action

Every rule has: signal -> minimum required data -> interpretation -> recommended action -> evaluation metric. The rule may suggest a cause; it does not assert causality.

| Signal | Evidence required | Candidate explanation | Recommended low-cost intervention | What proves it helps |
|---|---|---|---|---|
| Peak-hour scheduled arrivals exceed feasible workload | Arrivals/appointment durations + dock/crew calendar | Overbooking or arrival bunching | Stagger appointments, buffers, rescheduling | p90 wait-to-dock; on-time service |
| Free compatible docks while eligible trucks idle | Dock occupancy + eligibility + staffing | Handoff/visibility failure | Shared queue and assignment prompts | Idle-ready overlap minutes |
| Outbound readiness repeatedly late | Arrival vs goods staged timestamp | Production/picking/staging mismatch | Pre-dispatch readiness gate | Wait caused by goods readiness |
| Finished service but clearance late | Service finish + docs ready + exit | Paperwork/approvals | Prepare documents earlier; clearance owner | Finish-to-exit p90 |
| Problems cluster at shift cut-offs | Visit stage intervals + operating calendar | Shift/calendar mismatch | Adjust carrier ETA, staffed late window | Overnight/closed-hour wait |
| Docks nearly always occupied, no idle-compatible capacity | Occupancy, crew and durations | Physical resource constraint | Stagger work, temporarily extend shift; capital case only with evidence | Queue p90, utilization and cost |
| Service duration varies heavily by cargo | Cargo class + historical service | Slot duration assumptions wrong | Class-specific service estimates and buffer | Slot adherence and delay variance |
| Repeated network failures or stale data | Client/server telemetry and request ids | System reliability issue | Polling, idempotency, robust refresh and offline policy | Failed operations, retry duplication |

Start with deterministic rules. Machine learning is optional only after we have sufficient trustworthy events, a target decision, labels and a baseline; it is not needed to show engineering fundamentals.

## 6. Data strategy: obtain the data without making staff type every timestamp

### Existing sources to request

| Source | Likely usable data | What it cannot guarantee |
|---|---|---|
| Gate register / security entry | Arrival, plate, entry/exit, carrier | Waiting outside gate, dock time, reason |
| ERP / purchase-sales orders | Inbound/outbound references, item readiness, receipts, shipment | Actual yard/dock movement without integration |
| WMS / dispatch records | Pick/pack/staged, ship, receive, QC actions | Carrier arrival and wait at gate |
| Carrier communication | Requested slots, ETA changes, issue reports | Consistent audited event time |
| Dock supervisor log | Dock assignment, crew and service estimates | Accurate timestamps unless captured in workflow |
| Staff/shift calendar | Open hours and working capacity | Real unplanned absences/breakdowns |
| Carrier invoices/contracts | Free time, detention terms, actual invoices | Which stage and department caused delay |

### New events we capture in Yardline

- Appointment requested/confirmed/rescheduled/cancelled; original ETA and updates.
- Outside-gate arrival observation, actual gate entry, yard zone changes.
- Readiness checklist item updated; readiness lost/recovered.
- Blocker opened, assigned, escalated, cleared, with reason code.
- Dock assigned, physically reached, service started/paused/resumed/finished, physically left.
- Documents cleared, exit authorized, gate exit.
- Dock/crew/equipment availability changes and shift boundaries.
- Recommendation generated/acknowledged/actioned and whether problem persisted.

### Audit and data-quality rules

1. Every event records server UTC time, actor/user ID (or system), visit ID, event type, source and actor-entered note when meaningful.
2. Keep `observed_at` and `recorded_at` if an event is imported or backfilled. Historical entry does not masquerade as a live timestamp.
3. An audited correction is a new correction event referencing the old event. Do not silently rewrite history.
4. State snapshots make the UI fast, while immutable events preserve what happened.
5. Reject impossible chronology (departure before arrival, service before dock arrival, end before start) or send to explicit review.
6. Data completeness is a first-class metric: a missing timestamp creates `unknown`, not an invented zero-minute duration.
7. Multiple blockers can be active simultaneously. Total unique blocked time must be calculated as the union of intervals; category attribution uses one documented policy.
8. A vehicle plate is not a unique visit key: the same truck may make several visits on one day.

## 7. Recommended domain/data model, version 2

The actual app currently has `users`, `docks`, `visits`, `assignments` and `events`. Keep these as the initial core and evolve them via migrations, not manual destructive replacement.

| Entity | Purpose | Key fields / relationships |
|---|---|---|
| `plants` | Support one plant now, more later | plant ID, name, timezone, calendar, yard limit |
| `visits` | One physical truck visit | ID, plant, direction, carrier/plate, stage, key UTC milestone times, current version |
| `appointments` | Planned workload/slot | visit, start/end, estimated service minutes, status, dock requirements, source |
| `appointment_history` | Audited changes and no-show | appointment, old/new window, reason, actor |
| `load_references` | Inbound PO/ASN or outbound order/shipment | visit, reference, quantity, handling type |
| `readiness_checks` | Parallel prerequisites, not giant status field | visit, type, required, status, owner, checked_at, evidence |
| `docks` | Physical capacity and capabilities | plant, direction, size, equipment flags, state, enabled |
| `dock_unavailability` | Maintenance/incident/shift | dock, reason, start/end, actor |
| `dock_assignments` | Physical allocation and history | visit, dock, assigned_at, arrived_at, left_at, released_at, uniqueness |
| `resource_availability` | Staffing/handling capability | dock/shift/equipment group, availability windows |
| `queue_entries` (optional) | Persist an explainable queue decision | visit, eligibility time, priority, explanation, last evaluated |
| `visit_events` | Append-only audit and chronology | visit, actor, type, stage, occurred_at, recorded_at, source, correlation ID |
| `exceptions` | Problem ownership | visit, code, category, severity, owner, opened/closed, status, due_at |
| `exception_events` | Holds, handoffs and escalation history | exception, old/new status, actor, action/time |
| `service_intervals` | Processing and pause segments | visit, dock assignment, start/end, state, pause reason |
| `yard_positions` (optional) | Safe waiting location history | visit, zone, entered/left, capacity |
| `clearance_checks` | Shipment/receipt and gate-release prerequisites | visit, type, required, completed_at, approver |
| `notification_outbox` | Reliable, deduped user/carrier alerts | channel, recipient, event type, dedupe key, attempt/status |
| `carrier_contracts` | Optional financial measurement | carrier, free time, billable basis, rate, rounding, effective dates |
| `recommendations` | Explainable operating actions | visit/dock, rule, evidence, assigned role, status, acknowledged_at |
| `idempotency_keys` | Retry safety | user/route/key, payload hash, response state, expiry |
| `pilot_cohorts` | Controlled before/after analysis | site/shift/cargo cohort, baseline/pilot period, policy/version |

We can defer many tables in an interview-quality build; the key first additions are **appointments, readiness_checks, exceptions, service/dock movement timestamps, and an alert/recommendation view**.

### Model state separately to avoid impossible combinations

- `visit_stage`: scheduled / arrived / checked_in / in_yard / at_dock / in_service / service_complete / exit_cleared / departed / cancelled.
- `appointment_status`: requested / confirmed / rescheduled / no_show / cancelled.
- `readiness_state`: ready / at_risk / blocked (derived from checklist).
- `exception_status`: open / acknowledged / investigating / resolved / cancelled.
- `dock_state`: available / reserved / occupied / out_of_service, but only one compatible active physical occupancy.

`ON_HOLD` should no longer erase the truck's physical stage. A truck can be physically **at dock** while service is **paused due to equipment** and has a **documentation blocker**. Each dimension remains accurate.

The appointment is a planning reservation, not the same as physical dock occupancy.

## 8. Permission model

| Action | Coordinator | Gate | Supervisor | Manager |
|---|---|---|---|---|
| Create/reschedule/cancel appointment | Yes | No | View | Yes |
| Check in, external wait, yard entry/exit | View | Yes | View | Yes |
| Confirm readiness | Yes (assigned tasks) | View | Yes | Yes |
| Assign/reassign/disable dock | View | No | Yes | Yes |
| Start/pause/resume/finish service | View | No | Yes | Yes |
| Clear documents/approve shipment | Assigned permission only | No | Assigned permission only | Yes |
| Resolve exception | Assigned owner or responsible role | Assigned gate issues | Assigned dock issues | Yes |
| Override priority or safety-related action | No | No | Limited, with reason | Explicit policy only |
| View manager KPIs/cost and pilot metrics | Limited | Limited | Limited | Yes |

Safety-critical steps must require proper authorization and, where policy demands, a separate physical or supervisory confirmation. Demonstration roles do not substitute for real SSO or personal identity in a production factory.

## 9. Suggested screens and their primary job

### 01. Operations command center - the first page

Header: `Trucks on-site`, `waiting above target`, `open blockers`, `usable docks free`, `cost at risk (only if terms known)`, `next 2 hours arrivals`.

Main section 1: **What needs attention now?** Cards explain problem, duration, owner, next action, evidence. Example: `TRK-204 / Waiting 2h 18m / Goods not staged / Owner: Shipping / Action: Open readiness task`.

Main section 2: **Live flow**: Arriving soon | At gate | Waiting and ready | Blocked | At dock | Ready to exit. Each card shows age/next action rather than a plain status.

Main section 3: **Dock board mini-view**: 4 bays, real occupancy, eligible queue, service/clearance ETA and out-of-service markers.

Interactions: click incident -> visit detail and action; click free compatible dock -> assignment approval; click at-risk arrival -> reschedule. Last-updated indicator, no fake live badge.

### 02. Schedule / capacity planner

Calendar/list, inbound/outbound toggles, capacity heatmap by hour, staff shift and planned work minutes, add booking wizard, alternatives when full, late/no-show actions, readiness risk filter.

### 03. Gate desk

Fast plate/reference search, expected arrivals, walk-in exception, identity/doc safety checks, `Record outside arrival` when observable, check-in, safe yard instruction, exit confirmation. Large touch targets and keyboard access.

### 04. Readiness board

Upcoming outbound and inbound visits, checklist by stage, accountable team, estimated completion, `at risk` warnings, carrier notification/reschedule decision. Different templates for inbound and outbound.

### 05. Yard and queue

Ready queue, blocked queue, appointment adherence and fairness explanation, elapsed wait, eligible dock list, suggested action, safe yard zone. Visual separation between physically on-site and outside-gate arrivals.

### 06. Dock board / dock work order

Bay cards for compatibility, availability, occupancy and time. Detail shows assigned visit, actual arrival, checklist, start/pause/resume/finish, physical release, incidents and handoff owner.

### 07. Problem desk

Structured active holds by urgency and age, owner, code, opened/target time, action history, escalation, resolve/transfer. Each card has one clear next action.

### 08. Visit detail - "why is this truck waiting?"

Top: `Total dwell`, `time genuinely waiting`, `productive service`, `currently blocked by`, `next action`.

Timeline: outside arrival -> check in -> readiness -> queue -> dock assign -> dock physical arrival -> service with pauses -> documents cleared -> dock release -> exit. Parallel exception bands overlay time, not double-counted.

Action panel: only valid role/stage actions; safe confirmation and explicit error states. Audit drawer shows who did what and when.

### 09. Manager insights

p50/p90/p95, stage duration distributions, top blocking causes and owners, shift/carrier/direction breakdown, capacity mismatch, data completeness, documented operational recommendations, cost at risk (when contract known), pilot baseline comparison.

### 10. Scenario lab (demo-only)

Load *synthetic* cases without altering actual factory data: 8-hour peak queue, 18-hour readiness/shift issue, 48-hour unresolved escalation, free dock with waiting queue, race for same dock. Show detected cause, suggested actions and before/after *scenario logic*, not a claimed real saving.

## 10. Technical architecture (keep it simple and demonstrable)

```
React + TypeScript UI (role-based workflows)
  -> typed API service
FastAPI routers (auth, validation, HTTP)
  -> domain services
     AppointmentService   ReadinessService   QueueService
     DockService          VisitService       ExceptionService
     RecommendationService                 AnalyticsService
  -> DAL / repositories
  -> PostgreSQL: visits + appointments + events + holds + assignments
  -> transactional outbox for alerts (when enabled)
```

- Keep one FastAPI deployment/module boundaries, not microservices. The current repo already uses `source/api`, `source/service`, `source/dal`; expand that convention.
- Use PostgreSQL row locks, database uniqueness constraints and an atomic event/state commit for dock assignments and all transitions.
- Add idempotency keys and optimistic `version` checks to protect retries and stale screens.
- Enforce authentication/authorization and safety/business rules on server, not merely hidden UI buttons.
- Use an explicit migrations framework on a Neon test branch, then safely apply to production. Preserve existing visits/events.
- Poll live state every 5-15 seconds initially, with visible freshness and immediate refresh after mutation. Add SSE/WebSockets only if justified by real operating speed.
- Queue recommendations can be generated per event or through a small scheduled evaluator; dedupe alerts and allow acknowledgment.
- Derive KPIs in backend from event/readiness/exception intervals; avoid inaccurate calculations in React.
- Consider backend region close to the PostgreSQL region after measurement; do not claim unverified latency.
- CI: backend tests, frontend type-check/build, migration check and Playwright critical flows as feasible.

### Proposed API route families (not all implemented)

- `GET/POST /api/v1/appointments`; `POST /appointments/{id}/confirm|reschedule|cancel`; `GET /appointments/capacity`.
- `GET/POST /api/v1/visits`; `/visits/{id}/outside-arrival`; `/check-in`; `/move-to-yard`; `/depart`.
- `/visits/{id}/readiness`; `/visits/{id}/readiness/{check_id}`.
- `/visits/{id}/exceptions`; `/exceptions/{id}/assign|acknowledge|resolve|escalate`.
- `/visits/{id}/assign-dock`; `/dock-arrival`; `/start-service`; `/pause-service`; `/resume-service`; `/finish-service`; `/leave-dock`.
- `/visits/{id}/clearance`; `/docks`; `/docks/{id}/availability`; `/queue`; `/recommendations`.
- `/analytics/waiting`; `/analytics/bottlenecks`; `/analytics/detention-risk`; `/analytics/pilot`.

Suggested mutation contract: `Idempotency-Key` header; optional `If-Match`/expected_version; 409 includes the current state so UI can refresh safely. Decisions require codes and actor/owner; client never invents authoritative timestamps.

## 11. The three main interview stories - realistic fabricated data

These are synthetic examples designed to expose a different root cause. The 8-, 18- and 48-hour values are from the problem statement; the timeline split is invented purely for demonstration.

### Case 1: 8 hours - peak queue and missed usable capacity

- 08:00: truck reaches/checks in at gate.
- 08:20: verified ready.
- 12:00: assigned compatible dock after 3h40m queue.
- 12:30: service begins after 30m movement/positioning.
- 15:30: service complete after 3h productive work.
- 16:00: exits gate after 30m final clearance.
- Total: 8h. Illustrative measured components: 20m initial gate/readiness, 3h40m queue, 30m positioning, 3h service, 30m post-service.
- Decision: if a compatible dock was empty during part of the ready queue, flag a coordination lapse; if no compatible dock was free, flag true shortage/peak bunching instead. The same long queue has different remedies depending on evidence.
- Intervention: shared eligible queue + one-click compatible dock suggestion and appointment staggering if peaks are predictable.
- Demonstrate: Manager timeline -> alert -> supervisor dock assignment -> event history and updated queue.

### Case 2: 18 hours - missed readiness/shift window

- Day 1, 18:00: truck arrives after outbound pick/pack is not ready.
- Day 2, 08:00: goods become staged (14h elapsed, includes non-working time if plant closed).
- Day 2, 08:30: service starts (30m movements/queue).
- Day 2, 11:00: service complete (2h30m).
- Day 2, 12:00: gate exit (1h clearance).
- Total: 18h. Do not interpret the entire 14h as the warehouse actively working or chargeable detention; segment closed hours and applicable contract terms.
- Intervention: pre-arrival readiness checks, at-risk warning and human-approved reschedule before dispatch. If already on-site, assign readiness owner and escalation rather than leave truck invisible.
- Demonstrate: upcoming appointment marked AT RISK -> staged false -> reschedule suggestion -> owner resolves -> stage timeline.

### Case 3: 48 hours - combined unresolved delays

- Monday 09:00: truck checks in.
- Tuesday 05:00: document/quality issue resolved after 20h.
- Tuesday 21:00: compatible dock/crew finally available after additional 16h.
- Wednesday 05:00: physical service completes after 8h.
- Wednesday 09:00: exit/approval clearance completes after further 4h.
- Total: 48h. This illustrates **several causes on one visit**, not a single root-cause assumption.
- Intervention: structured blocker ownership and escalation; appropriate availability/shift planning; document readiness and clearance alerts.
- Demonstrate: 48h visit segmented, severity and elapsed-time warnings, owner handoffs, recommended action and proof of what changed.

**Safety and reality note:** A working factory would have its own legal/safety policies, operating calendars and actual detention agreements. The data above must be labeled `DEMO / SYNTHETIC`. Do not claim a real 48-hour issue has been resolved.

## 12. What each action does to the system (sample vertical slices)

### Example: goods not ready

1. Warehouse marks `picking/staging incomplete` (or the pre-arrival checklist remains incomplete).
2. `ReadinessService` derives not-ready; `ExceptionService` opens/updates `GOODS_NOT_STAGED` with shipping team as owner.
3. `RecommendationService` checks arrival ETA and returns `Contact carrier / consider slot change`, with evidence and a due time.
4. UI shows AT RISK on appointments and a warning in the command center.
5. Coordinator chooses reschedule or acknowledges the risk and explicitly confirms a policy exception.
6. When goods are staged, an event clears the blocker; queue eligibility and slot recommendation are recomputed.
7. Report attributes only real blocked intervals and displays how many visits were at risk before arrival.

### Example: free dock and waiting truck

1. Visit becomes ready and physically eligible for dock.
2. Current dock occupancy, capabilities and crew availability show `D-02 usable and empty`.
3. Rule suggests `Assign D-02 to TRK-204` (not if blocked by safety/shift/equipment).
4. Supervisor confirms; server locks visit+dock and inserts active assignment and event atomically.
5. UI updates, removing that visit from the ready queue; gate sees movement instruction.
6. If another operator assigned it first, reject the stale action with HTTP 409 and show the new dock state.
7. Track `ready but usable dock idle` minutes to evaluate whether the coordination fix helped.

### Example: loading finished but dock occupied

1. Supervisor records `service_complete`.
2. `DockService` does not free the physical dock automatically.
3. Clearance checks may remain pending; UI says `Service done / truck still at D-02`.
4. Once safe physical movement is confirmed, supervisor records `left_dock`, releasing the active assignment in a transaction.
5. Gate records `departed` later; post-service idle and gate exit time are separately visible.

### Example: 48-hour unresolved hold

1. Hold created with code `DOCUMENT_PENDING`, owner, start timestamp and SLA.
2. Alert at agreed threshold; manager views age and owner.
3. Owner acknowledges, records action and outcome; if unchanged, escalation advances.
4. Next shift receives handoff. Alert is deduped, not regenerated endlessly.
5. Once resolved, event closes interval; visit returns to operationally eligible stage, not an incorrect status fabricated by clearing hold.
6. Manager sees actual held duration and any other simultaneous blockers; total wait is not double-counted.

## 13. KPI, analytics and economics definitions

### Time metrics

- `Gate-to-exit turnaround = actual_gate_exit_at - actual_gate_entry_at`.
- `Outside-gate delay = gate_entry_at - observable_external_arrival_at`; keep absent/unknown explicit.
- `Wait-to-dock = physical_dock_arrival_at - gate_entry_at` (includes gate/yard/queue stages, label it honestly).
- `Ready-queue wait = physical_dock_arrival_at - first_eligible_at`, subtract periods of later ineligibility only if accurately captured.
- `Productive service = sum(unpaused loading/unloading intervals)`.
- `At-dock pre-service wait = first_service_start - physical_dock_arrival_at`.
- `Post-service site dwell = gate_exit_at - service_complete_at` (may include dock and yard clearance).
- `Total on-site nonproductive time` needs explicit business definitions; not simply all time not in a single service interval unless the process model validates that assumption.
- `Exception duration = resolved_at - opened_at`, but this is problem-open duration, not automatically attributed unique truck waiting time.
- `Aging = now - applicable last milestone`, refreshed using reliable server time.
- Percentiles `p50`, `p90`, `p95` on completed visits with valid timestamps and shown sample size; also report currently active trucks as censored/in-progress, not zero waits.

### Financial model

```
Eligible time = carrier-contract-defined time basis
Billable time = max(0, eligible time - contractual free time)
Estimated charge = carrier-specific billable units * contract rate
```

Rounding and exceptions depend on contract; invoice-based actuals are separate from estimates. If we lack contract terms, show **hours at risk**, not made-up currency savings.

### Operational KPIs

On-time appointment arrival, on-time service start, capacity planned vs used, compatible dock idle while ready trucks wait, cause-code occupied minutes, time-to-own/time-to-resolve blocker, no-show rate, appointment adherence, total daily throughput, stage data completeness, and rate of failed/retried API actions.

### Pilot design

1. Baseline: collect comparable normal and peak-day data; record timestamps and per-stage delays.
2. Diagnose: rank dominant causes and choose one cheap intervention.
3. Pilot: one gate/shift/flow or compatible cohort; keep other rules stable when practical.
4. Evaluate: pre-specified primary KPI (e.g. p90 wait-to-dock), secondary KPIs (p50, cost, throughput, exceptions, safety incidents), count and completeness.
5. Compare like-for-like days, cargo mix, volume, shift and season. A before/after chart alone is not causal proof.
6. Decide scale/adjust/stop. A software build is justified by measured operational value, not by its polish.

## 14. Release strategy: build a compelling interview solution without pretending to finish an enterprise WMS

### What actually exists as of last verified state

- [x] React/TypeScript app; four role demos; basic appointment creation.
- [x] Gate check-in, ready, manual hold note, compatible dock assignment, start/finish, gate depart.
- [x] PostgreSQL persistence and timestamped audit events.
- [x] Backend checks role permissions, workflow order, unique active dock assignments.
- [x] Vercel deployed; CI frontend build and four backend tests passed.
- [ ] No real workload-based appointment capacity planner.
- [ ] No pre-arrival readiness checklist with owner and inferred eligibility.
- [ ] No structured blocker intervals/priority/escalation system.
- [ ] No physical dock release separate from service finish.
- [ ] No advanced stage-based time/cost/root-cause insights.
- [ ] No no-show/walk-in/early/late robust state handling.
- [ ] No full live end-to-end production browser-test record, predictive engine or real ERP integration.

### Interview-first vertical slices (ranked)

| Slice | Build outcome | Backend/data work | UI proof | Test / acceptance |
|---|---|---|---|---|
| 0. Protect existing demo | Keep old flow working and preserve Neon | Migration plan, test database branch, regression | Existing flow remains usable | 4 existing backend tests green |
| 1. Explain where 8/18/48h went | Stage interval timeline and long-tail chart | More milestone/events + duration computation | Manager clicks synthetic case, sees breakdown and data source | All intervals sum to total where applicable; missing time flagged |
| 2. Give holds real ownership | Coded reasons, owner, start/resolution, escalation | `exceptions` and event actions | Red at-risk visits have owner and fix CTA | Cannot resolve without actor; intervals accurate; no double count |
| 3. Make readiness actionable | Different in/out checklists + pre-arrival risk | `readiness_checks`, eligibility rules | Outbound truck shows blocked before dispatch | Cannot assign unready truck; clear updates queue |
| 4. Make dock handoff intelligent | Compatible free dock + ready queue -> recommendation | `QueueService`, capacity/compatibility rule | Manager alert `free dock while 3 wait` -> supervisor action | Concurrent assignments safe; explanation correct |
| 5. Prevent avoidable overload | Simple workload-weighted slot view, shift calendar | appointment capacity and calendar | Full hour warns and proposes a later window | Capacity calculations and late/no-show tested |
| 6. Demonstrate safe physical operation | Separate dock movement, service completion and release | dock movement + service interval schema | Dock occupied until vehicle physically leaves | Cannot allocate bay when still physically occupied |
| 7. Summarize improvement | Pilot KPI and cause report, optional financial terms | reporting query/filters | p90 by shift, hold reasons, sample/completeness | Correct p50/p90 on known synthetic fixture |
| 8. Engineering-quality finish | Retry safety, migration, CI and browser QA | idempotency, version, Alembic | Conflicts/retries handled visibly | Postgres concurrent race + Playwright journey |

**First interview-grade release:** slices 1-4 plus existing happy path. Slices 5-8 are excellent follow-ups but should not be claimed as finished before implementation and verification.

### Time-boxed approach

- Before Nov 4: prioritize a small number of complete, testable slices and one clean demonstration. Do not attempt all 59 cases.
- After the interview: build the remaining pilot flows in order of observed operational value.
- Before real customer adoption: genuine identities, security/safety review, user training, retention, monitoring, backup, integration contracts and measured impact.

## 15. Acceptance tests and hard engineering constraints

### Functional tests

- Booking a time slot that exceeds configured capacity warns/rejects, and alternatives are eligible.
- Reschedule preserves original schedule, actor, reason and carrier-notification status.
- Inbound vs outbound checklists differ and control the right action.
- Walk-ins do not corrupt existing appointment reservations.
- A truck with open blocking check cannot become dock-eligible without a permitted override.
- A compatible free dock does not trigger a recommendation if no crew/equipment is available.
- A dock cannot have two active visits under two concurrent PostgreSQL workers.
- Finishing service does not release a physically occupied dock.
- Dock incident blocks further assignment; reassignment preserves physical safety and history.
- Gate departure is denied until required clearance is complete or a policy override is approved.
- One 90-minute overlapping two-reason hold is counted as 90 minutes total blocked time, not 180.
- A 48-hour synthetic case is segmented correctly across calendar boundaries.
- Missing timestamps produce an explicit unknown, not zero or a fabricated duration.

### API/platform tests

- Every mutation enforces role, input validation, valid state transitions and expected visit version.
- Duplicate `POST` with the same idempotency key returns one action and one audit event.
- A stale UI dock assignment returns 409 with current state, not a silent overwrite.
- An exception state change and its audit event commit atomically.
- A failed external notification is retried by an outbox/worker without duplicating the underlying business event.
- API cannot expose cross-role data beyond granted scope. Shared PIN accounts are demo only.
- Synthetic/reset tools are disabled in real production or isolated to a known demo tenant.
- App still loads and errors clearly if the database is down; no false success toast.
- Timezones, cross-midnight shifts, DST for multi-country rollouts and UTC serialization are tested.
- Data exports avoid unnecessary personal data and apply least-privilege access.

## 16. Exact interview walkthrough (10-12 minutes + optional technical discussion)

### Part A - business reasoning (about 2 minutes)

"I'd start with twelve targeted questions about the definition of waiting, arrival volume, the truck process, stage timestamps, dock/staff capacity, appointment rules, readiness, shifts, existing records and cost. Those answers determine whether the real issue is scheduling, preparation, coordination or physical capacity. My system is designed to capture the missing evidence while improving day-to-day execution."

### Part B - the product operating loop (about 2 minutes)

"Yardline is not just an arrival and departure register. It plans work before arrival, verifies readiness, controls safe gate and dock movement, routes blocked work to named owners, and exposes the next action. Each operational action also creates the evidence needed to understand waiting."

### Part C - three synthetic problem stories (about 4-5 minutes)

1. 8-hour truck: visit detail segments wait vs service; queue detects idle compatible dock and shows assignment action.
2. 18-hour truck: pre-arrival goods-not-ready checklist prevents wasted journey or escalates a late truck to a named owner.
3. 48-hour truck: multiple blocker intervals and shift/calendar constraints are visible with escalation, not a single generic status.

At each story show `signal -> decision -> responsible action -> measurable result`, not just click-through CRUD.

### Part D - engineering fundamentals (about 2-3 minutes)

- SQL schema separates visit, schedule, physical dock occupancy, events and exceptions.
- FastAPI enforces state machine and roles; frontend actions are not the security boundary.
- Transactions + unique active dock constraints prevent conflicts. Show a rejected double assignment and explain database authority.
- Audit captures actor/time and reasons; idempotency/version are planned until implemented.
- Explain what is built vs on roadmap; show green CI and synthetic data label.

### Part E - outcome and investment judgment (about 1 minute)

"I would pilot on one shift, measure p50/p90 waiting and chargeable detention using real contract terms, compare like for like and scale only if the operational outcome justifies it. If the data shows every dock is genuinely saturated, my recommendations change to staffing, equipment or capacity; a dashboard cannot create a new dock."

## 17. Things NOT to claim in the interview

- That all 59 scenarios are implemented.
- That the company truly has 4 docks or the 8/18/48 case causes are known.
- That Yardline has measured cost savings or real reduction of 48-hour waits.
- That a free-text hold is equivalent to a reason-coded duration analytics engine.
- That all dock concurrency races have been tested in live PostgreSQL; the verified automated tests used SQLite and sequential requests.
- That Vercel deployment protection permits independent browser verification from the assistant's connector; it previously returned 403.
- That machine learning is behind current recommendations, or that external ERP data is already integrated.
- That a dock is physically free merely because software shows `service finished`.
- That contracted detention is always billed from gate arrival with a universal 2-hour grace period; use the actual contract.

## 18. Sources and what they are used for

**User-provided material:** Framsikt hiring email (case and interview objective); original `Truck Waiting Time - Approach` slides; existing 2026-11-02 master context; current GitHub code as verified on 2026-11-02. These define the case and what exists.

**Industry references for plausible workflow design, not evidence about this particular factory:**

- Microsoft Dynamics 365 appointment setup: https://github.com/MicrosoftDocs/Dynamics-365-Unified-Operations-Public/blob/main/articles/supply-chain/transportation/tasks/set-up-appointment-load.md (inbound/outbound appointments tied to load and available capacity).
- Infor WMS receiving workflow: https://docs.infor.com/wms/11.5.x/en-us/sceolh/oke1612894153945.html (ASN/receipt, paperwork, unloading, discrepancy, posting).
- U.S. Federal Motor Carrier Safety Administration: https://www.fmcsa.dot.gov/research-and-analysis/impact-driver-detention-time-safety-and-operations (difference between detention/waiting and ordinary loading/unloading, safety relevance).
- U.S. Government Accountability Office: https://www.gao.gov/assets/a315300.html (examples of causes: facility limitations, goods not ready, scheduling and paperwork).

## 19. Our next implementation conversation

Review and approve this flow in this order:

1. **What should the manager see the first moment Yardline opens?** - decide how many trucks are at risk, why, and how the alert leads to action.
2. **What does a truck's 18-hour timeline look like?** - define stage durations and exact owners.
3. **What happens when goods are not ready?** - implement the first full blocker, action and resolution path.
4. **What happens when a dock becomes available?** - implement eligibility, recommendation and safe assignment.
5. **What does the pilot measure?** - stage p90, completion and cost terms.

Do not build 59 workflows at once. Make one convincing, accurate vertical slice: **observe -> detect -> assign -> fix -> verify -> measure**. Then add the other scenario families using the same reusable services and UI patterns.
