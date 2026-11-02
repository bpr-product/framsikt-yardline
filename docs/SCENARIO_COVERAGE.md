# Blueprint scenario coverage — honest implementation status

Legend: **Core** = backend/UI directly handles primary case (not necessarily every variant); **Partial** = evidence or basic response exists; **Planned** = not implemented.

| Code | Scenario | Status |
|---|---|---|
| A01 | Many trucks booked for the same hour | Core |
| A02 | Appointment at shift close/closed day | Core |
| A03 | Truck arrives early | Partial |
| A04 | Truck arrives late | Core |
| A05 | Truck never arrives | Partial |
| A06 | Unscheduled walk-in | Core |
| A07 | Carrier cancels | Core |
| A08 | Duplicate booking/refresh retry | Partial |
| A09 | ETA changes repeatedly | Partial |
| A10 | Inbound and outbound compete for one bay | Core |
| B01 | Outbound goods not picked | Core |
| B02 | Goods picked but not packed/staged | Core |
| B03 | Inbound ASN/PO reference missing | Partial |
| B04 | Shipping paperwork incomplete | Core |
| B05 | Quantity mismatch | Planned |
| B06 | Damaged/unsafe goods | Planned |
| B07 | Wrong truck / load reference | Partial |
| B08 | Goods become unready after check-in | Partial |
| C01 | Wait starts outside factory | Core |
| C02 | Gate slow or paperwork queue | Planned |
| C03 | Yard at maximum safe occupancy | Planned |
| C04 | Truck parked in wrong zone | Planned |
| C05 | Driver requires legal break | Planned |
| C06 | Gate device offline | Planned |
| C07 | Two visits have the same plate | Partial |
| D01 | All compatible docks occupied | Core |
| D02 | Compatible dock free while ready truck waits | Core |
| D03 | Dock incompatible with truck/cargo | Core |
| D04 | Dock empty but no crew | Planned |
| D05 | No forklift or required equipment | Planned |
| D06 | Dock suddenly breaks | Planned |
| D07 | Two supervisors assign same dock | Core |
| D08 | Truck assigned but not physically at dock | Partial |
| D09 | Service completed but truck still occupies dock | Core |
| D10 | Dock needs maintenance window | Planned |
| D11 | Assignment needs reassignment | Planned |
| E01 | Service longer than estimate | Planned |
| E02 | Operation pauses | Core |
| E03 | Partial load/unload | Planned |
| E04 | Inbound inspection finds damage | Planned |
| E05 | Finished truck awaits documents | Core |
| E06 | Truck cleared but gate exit is slow | Partial |
| E07 | Truck cannot leave physically | Planned |
| E08 | Shift changes during service | Planned |
| E09 | Driver reports wrong load/seal | Planned |
| F01 | Truck waiting with no named owner | Core |
| F02 | Truck waiting too long | Core |
| F03 | Long overnight/weekend delay | Partial |
| F04 | Missing/incorrect timestamp | Core |
| F05 | Two blockers overlap | Partial |
| F06 | UI shows stale dock state | Partial |
| F07 | Browser retries failed network action | Partial |
| F08 | Data source conflicts with gate record | Planned |
| F09 | Coordinator overwrites completed visit | Core |
| F10 | Detention rate unknown | Core |
| F11 | Manager tries to optimize without baseline | Core |
| F12 | Operator receives too many duplicate alerts | Partial |
| F13 | Access role lacks permission | Core |
| F14 | Unexpected system outage | Planned |

See `docs/IMPLEMENTATION_V2.md` for exact endpoint behavior and caveats. A status of Core is not full factory deployment readiness.