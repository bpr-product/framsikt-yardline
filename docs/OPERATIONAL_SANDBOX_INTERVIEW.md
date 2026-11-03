# Yardline Operations Sandbox — decision-led interview demonstration

## What changed

The older Guided Demo clicked through a preset action sequence, and the original Scenario Lab showed simulated recommendations. Both are insufficient to demonstrate how a dispatcher would actually operate the product.

This version is a real **interactive operation simulation** with a general-purpose state engine rather than an authored progression. The user can select any truck, choose an appropriate operating action, choose any dock (including occupied, unsafe, or incompatible ones to test validation), mark readiness, resolve problems, approve priority, reschedule future appointments, advance time, complete service, release bays, and clear departures. Every operation modifies in-memory truck/dock state and recalculates the queue/expected start times for every waiting truck. Switching cases or Reset restores the original fixture.

The sandbox uses **synthetic data and client-side rules**; it does not write to Neon. The standard Yardline screens are the persistent FastAPI + PostgreSQL application. Do not describe the sandbox as an actual industrial optimizer, a multi-user concurrent backend transaction, or proven cost savings.

## What concrete problem does it address?

- Late or no-show truck: avoid forcing a late delivery to wait for its originally occupied dock when another compatible, staffed dock is available. A supervisor can choose Dock 02 and the occupied Dock 01 is protected. The model illustrates a 60-minute reduction in this example.
- Emergency truck: controlled approval changes queue priority, while currently active loading remains untouched. Displays the emergency improvement and waiting-time penalty for existing trucks.
- Goods not staged: a free dock is not actually usable for an unprepared outbound shipment. Readiness and owner-assigned blocker clearance gate physical allocation.
- Dock breakdown: a faulty dock cannot accept trucks. Maintenance verifies a backup first; only then does it enter available capacity.
- Peak-hour bookings: rebook trucks that are still on the road rather than forcing all trucks through the gate at once. Current onsite trucks keep their queue positions.

## 5-minute live demonstration

Open `https://framsikt-yardline.vercel.app/demo?case=late`.

1. Say: "Booked for 10, arrived at 12; Dock 01 still busy until 1. Notice Dock 02 is compatible and free."
2. Select Truck A → **Check in truck** → **Mark ready for dock**. Select **Dock 01** in the dropdown → **Assign**. The system rejects the collision.
3. Select **Dock 02** → **Assign**. The board shows Truck A at Dock 02 and Truck B still loading at Dock 01; the operation-impact tile changes from a 60-minute original-dock wait to 0 for the alternative. Show event history.
4. Switch to **Urgent delivery**. Select the urgent truck; see it behind two waiting trucks. Click **Manager: approve urgent priority**. The queue immediately reorders; the estimated urgent wait falls, while the first standard truck's wait rises. Click the active truck, **Record service completed**, then **Confirm truck physically left dock**. Select the urgent truck again and allocate it.
5. Switch to **Goods not ready** for a quick safety example: stage goods, resolve the blocker, mark ready, then assign.
6. If asked, show Breakdown and Morning rush. Every action works independently; no scripted next-button sequence.

## How the calculation works

A deterministic, simple earliest-compatible-dock heuristic recomputes dock availability from physical occupancy and estimated release, assigns predicted starts in approved queue order, and includes 5 minutes of assumed between-truck dock turnover. When an active truck's predicted release is already overdue, or service has completed but the dock was not physically released, availability becomes *unknown* rather than falsely free.

Priority is considered only if expressly approved. Any physical assignment is rejected unless the truck is ready, documents and goods are complete, no blocking issue is open, it is first in the approved queue, and the selected dock is physically free, operational, and compatible. This is not a guarantee of actual ETA or travel time.

## Architecture

- `ui/src/pages/LiveDemo/opsEngine.ts`: generic in-browser state transitions, queue scheduling, constraints, audit history and operating-impact comparisons.
- `ui/src/pages/LiveDemo/LiveOperationsDemo.tsx`: interactive operator console with selectable trucks/docks, operational actions, and continuously updated wait outcomes.
- `ui/src/pages/LiveDemo/live-operations.css`: workspace styling and responsive layout.
- `ui/scripts/test-operations-sandbox.mjs`: invariant and journey tests.

Route `/demo` stays inside the original Yardline shell. `/scenario-lab` continues to redirect to `/demo`.

## What's still not implemented

An independent persistent demo tenant backed by PostgreSQL, actual multibay/staff/equipment scheduling, real-time carrier updates, and verified cost savings. A real factory implementation would calibrate service times, safety and grace-period policies with site operators; model labor and resource availability; persist scenario-specific reservations, robustly manage concurrency, and measure real pre/post waiting and detention charges.
