from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from source.dal.db_session import get_db
from source.dal.models import Visit,Event
from source.service.AuthService import current_user,require
from source.service.VisitsService import create,change,detail,list_visits,list_docks,metrics as board_metrics
from source.schemas.visit import VisitCreate,HoldRequest,AssignRequest

router=APIRouter(prefix='/api/v1',tags=['Operations'])
@router.get('/board')
def board(db:Session=Depends(get_db),user=Depends(current_user)):
    # One round trip for the operator shell instead of three parallel requests.
    return {'visits':list_visits(db),'docks':list_docks(db),'metrics':board_metrics(db)}
@router.get('/visits')
def visits(db:Session=Depends(get_db),user=Depends(current_user)):
    return list_visits(db)
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
    return list_docks(db)
@router.get('/metrics')
def metrics(db:Session=Depends(get_db),user=Depends(current_user)):
    return board_metrics(db)
