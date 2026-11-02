from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from source.dal.db_session import get_db
from source.dal.models import Visit,Dock,Event,Assignment
from source.service.AuthService import current_user,require
from source.service.VisitsService import create,change,detail
from source.schemas.visit import VisitCreate,HoldRequest,AssignRequest

router=APIRouter(prefix='/api/v1',tags=['Operations'])
@router.get('/visits')
def visits(db:Session=Depends(get_db),user=Depends(current_user)):
    rows=db.scalars(select(Visit).order_by(Visit.created_at.desc()).limit(300)).all()
    return [detail(db,v) for v in rows]
@router.post('/visits',status_code=201)
def book(payload:VisitCreate,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','manager');return create(db,payload,user['name'])
@router.get('/visits/{visit_id}')
def visit_detail(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    v=db.get(Visit,visit_id)
    if not v:raise HTTPException(404,'Visit not found')
    events=db.scalars(select(Event).where(Event.visit_id==visit_id).order_by(Event.at)).all()
    return {'visit':detail(db,v),'events':[{'id':e.id,'actor':e.actor,'action':e.action,'note':e.note,'at':e.at} for e in events]}
@router.post('/visits/{visit_id}/check-in')
def checkin(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'gate','manager');return change(db,visit_id,user['name'],'check_in')
@router.post('/visits/{visit_id}/ready')
def ready(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','coordinator','manager');return change(db,visit_id,user['name'],'ready')
@router.post('/visits/{visit_id}/hold')
def hold(visit_id:str,payload:HoldRequest,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','coordinator','manager');return change(db,visit_id,user['name'],'hold',payload.reason)
@router.post('/visits/{visit_id}/assign')
def assign(visit_id:str,payload:AssignRequest,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager');return change(db,visit_id,user['name'],'assign',dock_id=payload.dock_id)
@router.post('/visits/{visit_id}/start')
def start(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager');return change(db,visit_id,user['name'],'start')
@router.post('/visits/{visit_id}/finish')
def finish(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager');return change(db,visit_id,user['name'],'finish')
@router.post('/visits/{visit_id}/depart')
def depart(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'gate','manager');return change(db,visit_id,user['name'],'depart')
@router.get('/docks')
def docks(db:Session=Depends(get_db),user=Depends(current_user)):
    records=db.scalars(select(Dock).order_by(Dock.code)).all()
    assignments=db.scalars(select(Assignment).where(Assignment.active_dock_id.is_not(None))).all()
    occupied={a.dock_id:a.visit_id for a in assignments}
    return [{'id':d.id,'code':d.code,'direction':d.direction,'enabled':d.enabled,'visit_id':occupied.get(d.id)} for d in records]
@router.get('/metrics')
def metrics(db:Session=Depends(get_db),user=Depends(current_user)):
    records=db.scalars(select(Visit)).all()
    occupied=db.scalar(select(func.count()).select_from(Assignment).where(Assignment.active_dock_id.is_not(None)))
    complete=[v for v in records if v.arrival_at and v.departed_at]
    mins=[max(0,(v.departed_at.replace(tzinfo=None)-v.arrival_at.replace(tzinfo=None)).total_seconds()/60) for v in complete]
    return {'scheduled':sum(v.status=='scheduled' for v in records),'on_site':sum(v.status not in ('scheduled','departed') for v in records),'on_hold':sum(v.status=='on_hold' for v in records),'ready':sum(v.status=='ready' for v in records),'occupied_docks':occupied,'completed':len(complete),'avg_turnaround_min':round(sum(mins)/len(mins)) if mins else None,'longest_turnaround_min':round(max(mins)) if mins else None}
