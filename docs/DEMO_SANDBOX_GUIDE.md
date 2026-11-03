# Yardline: 5-case guided sandbox for the Framsikt interview

## Purpose

This is a **simulation integrated inside the same Yardline UI**, not a disconnected decision-model form. It is designed to be understood in under 20 seconds: select a factory disruption, view the truck/dock board, click the recommended operational action, watch real in-memory truck/dock state change and the audit trail update, then reset. It never modifies Neon or any live operational record.

## Where to find it

Left sidebar -> Demo mode -> Demo sandbox, or `/demo`. The older `/scenario-lab` URL redirects here. The original 16-scenario engineering lab is retained in source for reference, not promoted as the interview entry point.

## Five reusable scenarios

1. **Late arrival**: Truck A booked at 10 AM arrives at noon. Truck B occupies Dock 01 until 1 PM. Dock 02 is free and compatible. Click *Assign Truck A to Dock 02* and watch Dock 02 become occupied and A enter `at_dock`. Continue through loading, physical dock release and gate departure. Click *Test assigning occupied / unsafe Dock 01* first to demonstrate the rejection.
2. **Urgent delivery**: Critical truck C starts third in queue behind two normal trucks. Dock 01 is actively loading a fourth truck. Manager approves priority, C moves to queue position 1, but active unloading is not interrupted. Supervisor finishes and physically releases the current truck, then assigns C to Dock 01.
3. **Goods not ready**: Outbound truck arrives with a named, blocking warehouse issue. Confirm goods staged, resolve the issue, mark ready, assign Dock 02 and start loading. This demonstrates warehouse accountability and server-like readiness guards.
4. **Dock breakdown**: Dock 01 is unsafe/offline. Dock 03 is a backup awaiting a safety check. Maintenance verifies Dock 03; the supervisor can assign the waiting truck only after verification. Dock 01 remains offline.
5. **Morning rush**: Four trucks are booked for 8 AM, two have arrived and two are still on their way. Rebook the two unarrived trucks for 10 and 11 AM, reducing the overbooked hour from four to two; put the first eligible truck into a free dock. This is a policy demo, not real multibay scheduling optimization.

## Recommended five-minute demonstration

- 0:00-0:20: Open Demo sandbox, show five cases. "I mapped five frequent exceptions and designed a safe operator workflow for each."
- 0:20-1:40: Late arrival. Try Dock 01 to show a protected collision; assign Dock 02; explain a late booking cannot preempt active work.
- 1:40-3:00: Urgent delivery. Approve priority; explain active work continues, then release the dock before reassignment.
- 3:00-4:00: Goods not ready. Resolve the owned blocker, then move to a dock.
- 4:00-5:00: Describe safeguards, real Yardline API/Postgres flows, and that sandbox state is isolated. Mention dock breakdown and peak-hour congestion are also preloaded.

## Honest technical boundary

The demo sandbox is an **in-browser operational-state simulator**. It enforces relevant state guards (compatibility, no double occupancy, physical dock release before departure, manager-approved urgency, readiness and blocker checks) and records actor-labelled events. It does not send API requests and does not persist demo changes. The regular Yardline Gate, Docks, Readiness and Problems screens are the actual persisted FastAPI/Neon workflows; the sandbox is an interview walkthrough that resembles their interface and operational steps. There is no claim of real carrier ETAs, automatic production optimizer, real manager approval workflows, or field-verified cost savings.

## Reset guarantees

Switching scenarios, pressing Reset, or refreshing returns to a fresh isolated seed. The sandbox never imports real trucks or touches the `DATABASE_URL`. No migration or backend configuration is required. This makes repeated demonstrations safe even when using the production Yardline website.
