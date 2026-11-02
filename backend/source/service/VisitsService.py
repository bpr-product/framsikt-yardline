"""Truck state transitions. Physical occupancy, readiness and open issues remain separate."""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from source.dal.models import Visit, Assignment, Dock, Event
from source.schemas.visit import VisitCreate

def stamp():return datetime.now(timezone.utc)

def record(db,visit,actor,action,note=None):
    db.add(Event(visit_id=visit.id,actor=actor,action=action,note=note))

def detail(db,visit):
    assignment=db.scalar(select(Assignment).where(Assignment.visit_id==visit.id,Assignment.released_at.is_(None)))
    dock=db.get(Dock,assignment.dock_id) if assignment else None
    return {'id':visit.id,'truck_plate':visit.truck_plate,'driver':visit.driver,
        'company':visit.company,'direction':visit.direction,'cargo':visit.cargo,
        'scheduled_at':visit.scheduled_at,'arrival_at':visit.arrival_at,'ready_at':visit.ready_at,
        'service_started_at':visit.service_started_at,'service_finished_at':visit.service_finished_at,
        'departed_at':visit.departed_at,'created_at':visit.created_at,'status':visit.status,
        'hold_reason':visit.hold_reason,'dock':dock.code if dock else None,'version':visit.version}

def check_blockers(db, visit):
    from source.service.IssueService import active_blockers
    blockers=active_blockers(db,visit.id)
    if blockers:
        raise HTTPException(409,'Resolve the open blocking issue before continuing: '+blockers[0].code.replace('_',' '))

def change(db,visit_id,actor,action,note=None,dock_id=None,expected_version=None):
    visit=db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit:raise HTTPException(404,'Truck visit not found')
    if expected_version is not None and visit.version!=expected_version:
        raise HTTPException(409,'This truck was updated by another operator. Refresh the visit before retrying.')
    allowed={'check_in':{'scheduled'},'ready':{'checked_in','on_hold'},'hold':{'checked_in','ready','on_hold'},
             'assign':{'ready'},'start':{'at_dock'},'pause':{'loading'},'resume':{'paused'},
             'finish':{'loading'},'release_dock':{'completed'},'clear':{'completed'},
             'depart':{'completed'},'cancel':{'scheduled'}}
    if visit.status not in allowed.get(action,set()):
        raise HTTPException(409,f'Cannot {action.replace("_"," ")} while truck is {visit.status.replace("_"," ")}')
    when=stamp()
    if action=='check_in':
        visit.status='checked_in';visit.arrival_at=when
    elif action=='ready':
        from source.service.ReadinessService import all_ready
        check_blockers(db,visit)
        if not all_ready(db,visit):raise HTTPException(409,'Readiness checks are incomplete. Confirm each requirement first.')
        visit.status='ready';visit.ready_at=when;visit.hold_reason=None
    elif action=='hold':
        if not note or len(note.strip())<5:raise HTTPException(422,'A meaningful hold reason is required')
        visit.status='on_hold';visit.hold_reason=note.strip()
    elif action=='assign':
        from source.service.ReadinessService import all_ready
        check_blockers(db,visit)
        if not all_ready(db,visit):raise HTTPException(409,'Readiness requirements are incomplete')
        dock=db.scalar(select(Dock).where(Dock.id==dock_id).with_for_update())
        if not dock or not dock.enabled:raise HTTPException(400,'Dock unavailable')
        if dock.direction not in ('both',visit.direction):raise HTTPException(409,'Dock does not support this direction')
        if db.scalar(select(Assignment).where(Assignment.active_dock_id==dock.id)):
            raise HTTPException(409,'Dock is already occupied')
        db.add(Assignment(visit_id=visit.id,dock_id=dock.id,active_dock_id=dock.id,active_visit_id=visit.id))
        visit.status='at_dock'
    elif action=='start':
        from source.service.ReadinessService import all_ready
        check_blockers(db,visit)
        if not all_ready(db,visit):raise HTTPException(409,'Readiness was revoked. Confirm the outstanding requirement before starting.')
        visit.status='loading';visit.service_started_at=when
    elif action=='pause':
        if not note or len(note.strip())<5:raise HTTPException(422,'Explain why service is paused')
        visit.status='paused'
    elif action=='resume':
        check_blockers(db,visit)
        visit.status='loading'
    elif action=='finish':
        visit.status='completed';visit.service_finished_at=when
        # Finishing service never releases the physically occupied dock.
    elif action=='release_dock':
        assignment=db.scalar(select(Assignment).where(Assignment.active_visit_id==visit.id).with_for_update())
        if not assignment:raise HTTPException(409,'No occupied dock to release')
        if not note or len(note.strip())<5:raise HTTPException(422,'Confirm physical departure from the dock')
        assignment.active_dock_id=None;assignment.active_visit_id=None;assignment.released_at=when
    elif action=='clear':
        check_blockers(db,visit)
        active=db.scalar(select(Assignment).where(Assignment.active_visit_id==visit.id))
        if active:raise HTTPException(409,'Truck still occupies the dock. Release it physically first.')
        if not note or len(note.strip())<5:raise HTTPException(422,'Confirm the required exit documents and clearance')
        if db.scalar(select(Event).where(Event.visit_id==visit.id,Event.action=='clearance_confirmed')):
            raise HTTPException(409,'Exit clearance is already confirmed')
        action='clearance_confirmed'
    elif action=='depart':
        if db.scalar(select(Assignment).where(Assignment.active_visit_id==visit.id)):
            raise HTTPException(409,'Release the occupied dock before departure')
        if not db.scalar(select(Event).where(Event.visit_id==visit.id,Event.action=='clearance_confirmed')):
            raise HTTPException(409,'Exit clearance is not confirmed')
        check_blockers(db,visit)
        visit.status='departed';visit.departed_at=when
    elif action=='cancel':
        if not note or len(note.strip())<5:raise HTTPException(422,'Cancellation reason is required')
        visit.status='cancelled'
    visit.version+=1
    record(db,visit,actor,action,note)
    try:db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Another operator has already assigned this dock or truck')
    db.refresh(visit)
    return detail(db,visit)

def create(db,values:VisitCreate,actor:str,walkin:bool=False):
    from source.service.PlanningService import validate_slot, as_utc, lock_capacity
    from source.service.ReadinessService import ensure
    if not walkin and values.scheduled_at:
        lock_capacity(db,values.direction)
        validate_slot(db,values.scheduled_at,values.direction)
    data=values.model_dump()
    if values.scheduled_at:data['scheduled_at']=as_utc(values.scheduled_at)
    visit=Visit(**data)
    if walkin:visit.status='checked_in';visit.arrival_at=stamp()
    db.add(visit);db.flush();ensure(db,visit)
    record(db,visit,actor,'walk_in_checked_in' if walkin else 'scheduled',
           'Unscheduled arrival registered' if walkin else 'Appointment created')
    db.commit();db.refresh(visit)
    return detail(db,visit)

def reschedule(db,visit_id,actor,new_at,reason):
    from source.service.PlanningService import validate_slot,as_utc,lock_capacity
    visit=db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit:raise HTTPException(404,'Truck visit not found')
    if visit.status!='scheduled':raise HTTPException(409,'Only upcoming appointments can be rescheduled')
    lock_capacity(db,visit.direction)
    validate_slot(db,new_at,visit.direction,excluding=visit_id)
    before=visit.scheduled_at;visit.scheduled_at=as_utc(new_at);visit.version+=1
    record(db,visit,actor,'rescheduled',f'{before} -> {visit.scheduled_at}. Reason: {reason}')
    db.commit();db.refresh(visit)
    return detail(db,visit)

def record_outside_arrival(db,visit_id,actor):
    visit=db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit:raise HTTPException(404,'Truck visit not found')
    if visit.status!='scheduled':raise HTTPException(409,'Outside-gate arrival must be recorded before check-in')
    if db.scalar(select(Event).where(Event.visit_id==visit.id,Event.action=='external_arrival')):
        raise HTTPException(409,'Outside-gate arrival already recorded')
    visit.version+=1;record(db,visit,actor,'external_arrival','Observed at factory external gate')
    db.commit();db.refresh(visit)
    return detail(db,visit)
