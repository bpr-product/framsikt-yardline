"""Side-effect-free, explainable operations scenarios for the engineering interview.

No live database records are read or changed. These are synthetic, editable inputs.
The result is an evidence-based *planning suggestion*, not automated dispatch.
"""
from typing import Literal
from pydantic import BaseModel, Field


class ScenarioState(BaseModel):
    late_by_min: int = Field(default=0, ge=0, le=2880)
    booked_slot_reused: bool = False
    dock_busy_for_min: int = Field(default=0, ge=0, le=2880)
    queue_ahead: int = Field(default=0, ge=0, le=30)
    service_min: int = Field(default=90, ge=15, le=600)
    shift_left_min: int = Field(default=480, ge=0, le=1440)
    next_shift_in_min: int = Field(default=840, ge=0, le=2880)
    urgent: bool = False
    priority_approved: bool = False
    overtime_approved: bool = False
    goods_ready: bool = True
    goods_ready_in_min: int = Field(default=180, ge=0, le=2880)
    documents_ready: bool = True
    documents_ready_in_min: int = Field(default=60, ge=0, le=2880)
    crew_ready: bool = True
    crew_ready_in_min: int = Field(default=120, ge=0, le=2880)
    equipment_ready: bool = True
    equipment_ready_in_min: int = Field(default=90, ge=0, le=2880)
    dock_operational: bool = True
    dock_repair_in_min: int = Field(default=240, ge=0, le=2880)
    compatible_dock: bool = True
    alternate_dock_available: bool = False
    gate_cleared: bool = True
    gate_clear_in_min: int = Field(default=30, ge=0, le=2880)
    yard_space: bool = True
    yard_space_in_min: int = Field(default=45, ge=0, le=2880)
    walk_in: bool = False
    loading_complete: bool = False
    physically_left_dock: bool = False
    exit_cleared: bool = False


class ScenarioRequest(BaseModel):
    scenario_id: str = Field(min_length=2, max_length=64)
    state: ScenarioState


SCENARIOS = [
    {"id": "late_reallocated", "title": "Late truck loses its slot", "category": "Arrival & dispatch", "code": "A04", "question": "A truck booked at 10:00 arrives at 12:00. Another truck holds the dock until 13:00. Who goes next?", "hypothesis": "The original appointment no longer guarantees immediate dock access after the grace period.", "state": {"late_by_min": 120, "booked_slot_reused": True, "dock_busy_for_min": 60, "queue_ahead": 0, "service_min": 90}},
    {"id": "emergency_priority", "title": "Urgent delivery joins a full queue", "category": "Arrival & dispatch", "code": "A10", "question": "An urgent component is required for production. Can it jump two waiting trucks?", "hypothesis": "Priority should change only after a manager validates urgency and sees the impact.", "state": {"urgent": True, "priority_approved": False, "dock_busy_for_min": 35, "queue_ahead": 2, "service_min": 70}},
    {"id": "bunched_arrivals", "title": "Six arrivals at the same hour", "category": "Scheduling", "code": "A01", "question": "Morning arrivals exceed dock processing capacity and create a long queue.", "hypothesis": "Stagger appointments based on realistic service duration and total compatible resources.", "state": {"queue_ahead": 5, "dock_busy_for_min": 40, "service_min": 70}},
    {"id": "goods_not_ready", "title": "Collection before goods are ready", "category": "Readiness", "code": "B01", "question": "A collection truck arrives while the warehouse is still picking goods.", "hypothesis": "Confirm preparation before dispatch and assign an accountable readiness owner.", "state": {"goods_ready": False, "goods_ready_in_min": 180, "service_min": 75}},
    {"id": "missing_documents", "title": "Missing shipping documents", "category": "Readiness", "code": "B04", "question": "The truck and dock are ready, but dispatch paperwork is incomplete.", "hypothesis": "Make document readiness a precondition and raise an exception before a wasted arrival.", "state": {"documents_ready": False, "documents_ready_in_min": 65}},
    {"id": "dock_breakdown", "title": "Dock taken out of service", "category": "Docks & resources", "code": "D06", "question": "The planned dock fails while trucks are approaching.", "hypothesis": "Withdraw unsafe capacity and search for a compatible alternative before rescheduling.", "state": {"dock_operational": False, "dock_repair_in_min": 240, "dock_busy_for_min": 0}},
    {"id": "no_crew", "title": "Dock free, but nobody can unload", "category": "Docks & resources", "code": "D04", "question": "A dock is empty but the handling crew is unavailable.", "hypothesis": "A free dock is not usable unless its required people and equipment are available.", "state": {"crew_ready": False, "crew_ready_in_min": 130}},
    {"id": "equipment_failure", "title": "Forklift failure during preparation", "category": "Docks & resources", "code": "D05", "question": "The truck is ready but the only approved forklift cannot work.", "hypothesis": "Keep the bay safe, escalate to maintenance and consider another capable resource.", "state": {"equipment_ready": False, "equipment_ready_in_min": 85}},
    {"id": "loading_overrun", "title": "Previous truck takes three extra hours", "category": "Docks & resources", "code": "E01", "question": "Loading overruns the planned service window and affects downstream bookings.", "hypothesis": "Update estimated dock release and alert impacted trucks; do not pretend the bay is free.", "state": {"dock_busy_for_min": 180, "queue_ahead": 1, "service_min": 75}},
    {"id": "shift_close", "title": "Truck misses the last shift window", "category": "Shifts & exceptions", "code": "F03", "question": "Only 30 minutes remain on shift, but unloading requires 90 minutes.", "hypothesis": "Offer the next staffed window unless overtime is expressly authorized.", "state": {"shift_left_min": 30, "next_shift_in_min": 750, "service_min": 90}},
    {"id": "walk_in", "title": "Truck arrives without an appointment", "category": "Arrival & dispatch", "code": "A06", "question": "An unscheduled truck arrives while two other trucks are already queued.", "hypothesis": "Record the walk-in, verify prerequisites and place it in an accountable queue.", "state": {"walk_in": True, "dock_busy_for_min": 30, "queue_ahead": 2}},
    {"id": "gate_yard", "title": "Gate paperwork and safe yard full", "category": "Gate & safety", "code": "C03", "question": "The gate cannot clear the driver and the yard is at safe capacity.", "hypothesis": "Do not admit the truck into an unsafe yard; route to approved holding and escalate.", "state": {"gate_cleared": False, "gate_clear_in_min": 35, "yard_space": False, "yard_space_in_min": 60}},
    {"id": "wrong_dock", "title": "The available dock is incompatible", "category": "Gate & safety", "code": "D03", "question": "The next dock is physically free but cannot safely handle the vehicle/cargo.", "hypothesis": "Dock compatibility is a hard gate, not an optional sorting preference.", "state": {"compatible_dock": False, "dock_busy_for_min": 0, "queue_ahead": 0}},
    {"id": "exit_blocked", "title": "Loading complete, paperwork delayed", "category": "Completion & exit", "code": "E05", "question": "The work is finished, but the truck remains at the dock and cannot leave.", "hypothesis": "Separate productive completion, physical dock release, document clearance and gate departure.", "state": {"loading_complete": True, "physically_left_dock": False, "exit_cleared": False, "documents_ready": False, "documents_ready_in_min": 100, "service_min": 90}},
    {"id": "no_show", "title": "Booked truck never appears", "category": "Scheduling", "code": "A05", "question": "A truck is 90 minutes overdue; can its unused reservation be offered to another carrier?", "hypothesis": "After an agreed grace period, release unused scheduling capacity, never occupied physical dock capacity.", "state": {"late_by_min": 90, "booked_slot_reused": True, "queue_ahead": 1, "dock_busy_for_min": 45}},
    {"id": "multiple_holds", "title": "Several blockers stack up overnight", "category": "Shifts & exceptions", "code": "F05", "question": "Goods, paperwork and dock availability all fail; the next staffed shift is much later.", "hypothesis": "Track parallel causes separately and avoid double-counting overlapping wait time.", "state": {"goods_ready": False, "goods_ready_in_min": 680, "documents_ready": False, "documents_ready_in_min": 590, "dock_busy_for_min": 540, "shift_left_min": 70, "next_shift_in_min": 720, "service_min": 120}}
]


def catalogue():
    """Includes defaults so the UI can load every case without backend writes."""
    return [
        {**{k:v for k,v in item.items() if k != 'state'}, 'state': ScenarioState(**item['state']).model_dump()}
        for item in SCENARIOS
    ]


def flag(code: str, title: str, reason: str, owner: str, action_id: str | None = None, label: str | None = None, changes: dict | None = None, delay: int = 0):
    return {'code':code,'title':title,'reason':reason,'owner':owner,'delay_min':delay,'action':
        ({'id':action_id,'label':label,'changes':changes or {}} if action_id else None)}


def evaluate(request: ScenarioRequest) -> dict:
    s=request.state
    if request.scenario_id not in {x['id'] for x in SCENARIOS}:
        raise ValueError('Unknown scenario identifier')
    issues=[]
    trace=[]
    def add(*args,**kwargs):issues.append(flag(*args,**kwargs))

    if s.loading_complete:
        trace.append('Work has finished: check real bay occupancy and exit clearance, not loading capacity.')
        if not s.physically_left_dock:
            add('DOCK_STILL_OCCUPIED','Completed truck still at dock',
                'Finishing work does not release the physical bay. Confirm safe departure from the dock first.',
                'Dock supervisor','release_bay','Confirm physical move-out',{'physically_left_dock':True})
        if not s.documents_ready:
            add('EXIT_DOCUMENTS','Exit documents missing',
                'A departed/cleared status is forbidden until the dispatch or receiving team completes documentation.',
                'Dispatch lead','complete_docs','Confirm documentation',{'documents_ready':True},s.documents_ready_in_min)
        if not s.exit_cleared:
            add('EXIT_CLEARANCE','Final clearance is not confirmed',
                'Gate exit requires a separate safety/document clearance approval.',
                'Gate / dispatch','confirm_exit','Confirm authorized clearance',{'exit_cleared':True})
        can_depart=s.physically_left_dock and s.documents_ready and s.exit_cleared
        return {'scenario_id':request.scenario_id,'status':'cleared_to_depart' if can_depart else 'exit_blocked',
                'headline':'Ready to leave the site' if can_depart else 'Service complete, departure blocked',
                'earliest_start_min':None,'estimated_delay_min':0 if can_depart else None,
                'estimated_finish_min':None,'queue_position':0,'flags':issues,'decision_trace':trace,
                'recommended_owner':issues[0]['owner'] if issues else 'Gate operator',
                'recommended_action':issues[0]['title'] if issues else 'Record physical gate departure',
                'outcome':'Do not mark departed or available until the physical/safety conditions are satisfied.' if not can_depart else 'Site exit can now be recorded by the gate operator.',
                'messages':['No real shipment or bay state has been modified.'], 'assumptions':['All scenario inputs are synthetic; external paperwork systems are not connected.']}

    # Guardrails are evaluated before queue priority or efficiency.
    if not s.gate_cleared:
        add('GATE_VERIFICATION','Gate verification pending','Do not admit or dispatch to a bay without the required gate check.','Gate operator','verify_gate','Complete gate verification',{'gate_cleared':True},s.gate_clear_in_min)
    if not s.yard_space:
        add('YARD_FULL','No safe yard position','Keep vehicle in a designated approved holding area; do not exceed site occupancy.','Gate operator','free_yard','Confirm safe yard space',{'yard_space':True},s.yard_space_in_min)
    if not s.compatible_dock and not s.alternate_dock_available:
        add('DOCK_INCOMPATIBLE','No compatible dock','The free bay cannot be used for this truck; find a certified compatible alternative.','Dock supervisor','alternate_bay','Use verified compatible alternate',{'alternate_dock_available':True})
    if not s.dock_operational and not s.alternate_dock_available:
        add('DOCK_OUT_OF_SERVICE','Dock not operational','Do not assign to a broken or unsafe bay; use an approved alternate or wait for repair.','Dock supervisor','repair_bay','Confirm dock repaired',{'dock_operational':True},s.dock_repair_in_min)
    if not s.goods_ready:
        add('GOODS_NOT_READY','Goods are not staged','Shipment must be staged before work starts; notify carrier before dispatch when possible.','Warehouse lead','goods_staged','Confirm goods are staged',{'goods_ready':True},s.goods_ready_in_min)
    if not s.documents_ready:
        add('DOCUMENTS_MISSING','Required documents missing','Prepare relevant dispatch/receipt documents before work or clearance.','Dispatch lead','documents_ready','Confirm documents are ready',{'documents_ready':True},s.documents_ready_in_min)
    if not s.crew_ready:
        add('NO_CREW','Loading crew unavailable','An empty dock does not provide capacity unless approved operators are present.','Shift supervisor','crew_confirmed','Confirm handling crew available',{'crew_ready':True},s.crew_ready_in_min)
    if not s.equipment_ready:
        add('NO_EQUIPMENT','Equipment unavailable','Verify forklift/crane/handling equipment before assigning a bay.','Maintenance lead','equipment_restored','Confirm equipment available',{'equipment_ready':True},s.equipment_ready_in_min)

    if s.late_by_min>45:
        trace.append(f'Truck is {s.late_by_min} min late, beyond the illustrative 45-min grace period.')
        if s.booked_slot_reused:
            add('MISSED_SLOT','Original reservation is no longer available',
                'The old appointment does not override physically occupied capacity. Replan the arrival without preempting current service.',
                'Logistics coordinator','rebook','Reconfirm updated arrival plan',{'booked_slot_reused':False})
        else:
            trace.append('Booking must still be rechecked against current capacity; it is not guaranteed by the old slot.')
    if s.walk_in:
        add('WALK_IN','Unscheduled truck','Verify shipment/reference and apply the same safety and queue rules as booked visits.','Gate / coordinator')
    if s.urgent:
        if not s.priority_approved:
            add('URGENT_APPROVAL','Urgent-priority request pending approval',
                'Validate the operational impact before overtaking waiting bookings. Loading in progress is never preempted automatically.',
                'Factory manager','approve_priority','Approve urgent priority',{'priority_approved':True})
        else:
            trace.append('Manager approved priority: truck may move ahead of other waiting trucks, not interrupt active loading.')

    # A verified, staffed compatible alternate can provide zero-busy time. This is a
    # simplified one-bay queue model for teaching, not a plant optimizer.
    dock_delay = 0 if s.alternate_dock_available else s.dock_busy_for_min
    if not s.dock_operational and not s.alternate_dock_available:
        dock_delay=max(dock_delay,s.dock_repair_in_min)
    queue_ahead = 0 if s.urgent and s.priority_approved else s.queue_ahead
    queue_delay = queue_ahead * s.service_min
    if queue_ahead:
        add('QUEUE_PRESSURE','Work already queued ahead',
            f'{queue_ahead} truck(s) ahead, about {queue_delay} min of assumed work at one compatible bay.',
            'Logistics coordinator','stagger_bookings','Model staggered bookings',{'queue_ahead':max(0,queue_ahead-1)})
    if dock_delay:
        add('DOCK_BUSY','Dock will not be free immediately',
            f'Current estimate is {dock_delay} min until a suitable bay becomes free. Never preempt active work.',
            'Dock supervisor','free_alternate','Model available alternate dock',{'alternate_dock_available':True},dock_delay)

    prereq_delays=[0]
    if not s.gate_cleared: prereq_delays.append(s.gate_clear_in_min)
    if not s.yard_space: prereq_delays.append(s.yard_space_in_min)
    if not s.goods_ready: prereq_delays.append(s.goods_ready_in_min)
    if not s.documents_ready: prereq_delays.append(s.documents_ready_in_min)
    if not s.crew_ready: prereq_delays.append(s.crew_ready_in_min)
    if not s.equipment_ready: prereq_delays.append(s.equipment_ready_in_min)
    prerequisites=max(prereq_delays)
    earliest=max(prerequisites,dock_delay+queue_delay)
    if s.shift_left_min<earliest+s.service_min:
        if s.overtime_approved:
            trace.append('Authorized staffed overtime explicitly permits this job to continue past normal shift end.')
        else:
            add('SHIFT_WINDOW','Insufficient staffed shift remaining',
                f'This job needs {s.service_min} min but only {s.shift_left_min} min remain. Rebook to a staffed window.',
                'Shift supervisor','overtime','Approve staffed overtime (simulation)',{'overtime_approved':True},max(s.next_shift_in_min-s.shift_left_min,0))
            earliest=max(earliest,s.next_shift_in_min)

    # An unverified compatible bay has an unknown recovery time; don't invent one.
    uncertain=not s.compatible_dock and not s.alternate_dock_available
    if uncertain:
        estimate=None
        trace.append('No verified compatible bay: a feasible service time cannot be calculated yet.')
    else:
        estimate=earliest
    if s.late_by_min>45:
        trace.append('Plan the truck against actual capacity; the missed slot has no special hold on the dock.')
    trace.append(f'Ready inputs: gate={s.gate_cleared}, goods={s.goods_ready}, docs={s.documents_ready}, crew={s.crew_ready}, equipment={s.equipment_ready}.')
    trace.append(f'Calculated: latest prerequisite ETA {prerequisites} min; compatible dock {dock_delay} min + queued work {queue_delay} min.')
    if s.shift_left_min<earliest+s.service_min and not s.overtime_approved:
        trace.append('Estimated start crosses the configured shift boundary; next shift was considered.')

    safety_block=any(f['code'] in ('GATE_VERIFICATION','YARD_FULL','DOCK_INCOMPATIBLE','DOCK_OUT_OF_SERVICE') for f in issues)
    readiness_block=any(f['code'] in ('GOODS_NOT_READY','DOCUMENTS_MISSING','NO_CREW','NO_EQUIPMENT') for f in issues)
    current='blocked' if safety_block or readiness_block else 'at_risk' if issues else 'eligible'
    if s.urgent and not s.priority_approved:
        current='approval_required' if not safety_block and not readiness_block else current
    owner=issues[0]['owner'] if issues else 'Dock supervisor'
    action=issues[0]['title'] if issues else 'Confirm safe compatible dock assignment'
    impact='Use a coordinator-approved new slot and communicate with all affected carriers.' if s.late_by_min>45 or s.queue_ahead else 'Keep the next operational milestone visible and re-evaluate after any new event.'
    return {'scenario_id':request.scenario_id,'status':current,
        'headline':{'blocked':'Truck blocked by an operational prerequisite','at_risk':'Schedule or capacity risk needs coordination','eligible':'Truck can be considered for assignment','approval_required':'Urgent request needs manager decision'}[current],
        'earliest_start_min':estimate,'estimated_delay_min':estimate,'estimated_finish_min':estimate+s.service_min if estimate is not None else None,
        'queue_position':queue_ahead+1,'flags':issues,'decision_trace':trace,
        'recommended_owner':owner,'recommended_action':action,
        'outcome':impact,
        'messages':['Human staff must verify physical safety, truck identity and real availability before acting.',
                    'This evaluation made no changes to real appointments, bays or Neon data.'],
        'assumptions':['One compatible bay and serial work for the illustrative queue estimate.',
                       'Arrival delays are elapsed minutes relative to the missed booking, not a GPS observation.',
                       'Reported resource/repair ETAs and staffed next-shift time are illustrative.',
                       'The 45-minute grace period and urgency policy are hypothetical; configure with the factory.']}
