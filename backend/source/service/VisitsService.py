from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from source.dal.models import Visit, Assignment, Dock, Event
from source.schemas.visit import VisitCreate

def stamp():
    return datetime.now(timezone.utc)

def record(db, visit, actor, action, note=None):
    db.add(Event(visit_id=visit.id, actor=actor, action=action, note=note))

def detail(db, visit):
    assignment = db.scalar(select(Assignment).where(Assignment.visit_id == visit.id,Assignment.released_at.is_(None)))
    dock = db.get(Dock, assignment.dock_id) if assignment else None
    return {'id':visit.id,'truck_plate':visit.truck_plate,'driver':visit.driver,'company':visit.company,'direction':visit.direction,'cargo':visit.cargo,'scheduled_at':visit.scheduled_at,'arrival_at':visit.arrival_at,'ready_at':visit.ready_at,'service_started_at':visit.service_started_at,'service_finished_at':visit.service_finished_at,'departed_at':visit.departed_at,'created_at':visit.created_at,'status':visit.status,'hold_reason':visit.hold_reason,'dock':dock.code if dock else None,'version':visit.version}

def change(db, visit_id, actor, action, note=None, dock_id=None):
    visit = db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit: raise HTTPException(404,'Truck visit not found')
    allowed = {'check_in':{'scheduled'},'ready':{'checked_in','on_hold'},'hold':{'checked_in','ready','on_hold'},'assign':{'ready'},'start':{'at_dock'},'finish':{'loading'},'depart':{'completed'}}
    if visit.status not in allowed.get(action,set()):
        raise HTTPException(409, f'Cannot {action.replace("_"," ")} while truck is {visit.status.replace("_"," ")}')
    when = stamp()
    if action=='check_in':visit.status='checked_in';visit.arrival_at=when
    elif action=='ready':visit.status='ready';visit.ready_at=when;visit.hold_reason=None
    elif action=='hold':
        if not note or len(note.strip())<5: raise HTTPException(422,'A meaningful hold reason is required')
        visit.status='on_hold';visit.hold_reason=note.strip()
    elif action=='assign':
        dock = db.scalar(select(Dock).where(Dock.id==dock_id).with_for_update())
        if not dock or not dock.enabled:raise HTTPException(400,'Dock unavailable')
        if dock.direction not in ('both',visit.direction):raise HTTPException(409,'Dock does not support this direction')
        if db.scalar(select(Assignment).where(Assignment.active_dock_id==dock.id)):
            raise HTTPException(409,'Dock is already occupied')
        db.add(Assignment(visit_id=visit.id,dock_id=dock.id,active_dock_id=dock.id,active_visit_id=visit.id))
        visit.status='at_dock'
    elif action=='start':visit.status='loading';visit.service_started_at=when
    elif action=='finish':
        visit.status='completed';visit.service_finished_at=when
        assignment=db.scalar(select(Assignment).where(Assignment.active_visit_id==visit.id))
        if assignment: assignment.active_dock_id=None;assignment.active_visit_id=None;assignment.released_at=when
    elif action=='depart':visit.status='departed';visit.departed_at=when
    visit.version += 1
    record(db,visit,actor,action,note)
    try:db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'Another operator has already assigned this dock or truck')
    db.refresh(visit)
    return detail(db,visit)

def create(db, values:VisitCreate,actor:str):
    visit=Visit(**values.model_dump())
    db.add(visit);db.flush();record(db,visit,actor,'scheduled','Appointment created');db.commit();db.refresh(visit)
    return detail(db,visit)
