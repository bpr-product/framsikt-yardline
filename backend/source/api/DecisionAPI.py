"""V2 capability endpoints. The API, not the frontend, owns all permission rules."""
from datetime import date
from fastapi import APIRouter,Depends,HTTPException,Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from source.dal.db_session import get_db
from source.dal.models import Issue,Visit
from source.service.AuthService import current_user, require
from source.service.ReadinessService import get as readiness, set_check
from source.service.IssueService import create as create_issue,resolve,escalate,serialize, ISSUE_TYPES
from source.service.DecisionService import diagnosis, decisions, analytics
from source.service.PlanningService import slots
from source.service.VisitsService import create as create_visit,change,reschedule,record_outside_arrival
from source.schemas.visit import VisitCreate
from source.schemas.decision import ReadinessUpdate,IssueCreate,IssueResolve,ReasonNote,Reschedule

router=APIRouter(prefix='/api/v1',tags=['Decision operations'])

@router.get('/planning/slots')
def planning(day:date=Query(...),direction:str=Query('outbound'),db:Session=Depends(get_db),user=Depends(current_user)):
    return slots(db,day.isoformat(),direction)

@router.post('/visits/{visit_id}/reschedule')
def reschedule_visit(visit_id:str,p:Reschedule,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','manager')
    return reschedule(db,visit_id,user['name'],p.scheduled_at,p.reason)

@router.post('/visits/walk-in',status_code=201)
def walkin(p:VisitCreate,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'gate','manager')
    if p.scheduled_at is not None:raise HTTPException(422,'Walk-in must not include a scheduled appointment')
    return create_visit(db,p,user['name'],walkin=True)

@router.post('/visits/{visit_id}/outside-arrival')
def outside_arrival(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'gate','manager')
    return record_outside_arrival(db,visit_id,user['name'])

@router.get('/visits/{visit_id}/readiness')
def get_readiness(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    return readiness(db,visit_id)

@router.post('/visits/{visit_id}/readiness/{code}')
def update_readiness(visit_id:str,code:str,p:ReadinessUpdate,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','supervisor','manager')
    return set_check(db,visit_id,code,p.done,user['name'])

@router.get('/issue-types')
def issue_types(user=Depends(current_user)):
    return [{'code':c,'category':a,'default_owner':b,'label':d} for c,(a,b,d) in ISSUE_TYPES.items()]

@router.get('/issues')
def list_issues(status:str='open',db:Session=Depends(get_db),user=Depends(current_user)):
    q=select(Issue).order_by(Issue.opened_at.desc())
    if status=='open':q=q.where(Issue.status.in_(['open','escalated']))
    elif status=='resolved':q=q.where(Issue.status=='resolved')
    elif status!='all':raise HTTPException(422,'Invalid issue status filter')
    rows=db.scalars(q.limit(300)).all()
    result=[]
    for i in rows:
        v=db.get(Visit,i.visit_id)
        d=serialize(i);d['truck_plate']=v.truck_plate if v else 'Unknown truck';d['visit_status']=v.status if v else None
        result.append(d)
    return result

@router.post('/visits/{visit_id}/issues',status_code=201)
def new_issue(visit_id:str,p:IssueCreate,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','supervisor','manager')
    return create_issue(db,visit_id,user['name'],p.code,p.description,p.owner,p.severity,p.blocking)

@router.post('/issues/{issue_id}/resolve')
def resolve_issue(issue_id:str,p:IssueResolve,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','supervisor','manager')
    return resolve(db,issue_id,user['name'],p.resolution)

@router.post('/issues/{issue_id}/escalate')
def escalate_issue(issue_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'manager')
    return escalate(db,issue_id,user['name'])

@router.post('/visits/{visit_id}/pause')
def pause(visit_id:str,p:ReasonNote,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager')
    return change(db,visit_id,user['name'],'pause',note=p.reason,expected_version=p.expected_version)

@router.post('/visits/{visit_id}/resume')
def resume(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager')
    return change(db,visit_id,user['name'],'resume')

@router.post('/visits/{visit_id}/release-dock')
def release(visit_id:str,p:ReasonNote,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'supervisor','manager')
    return change(db,visit_id,user['name'],'release_dock',note=p.reason,expected_version=p.expected_version)

@router.post('/visits/{visit_id}/clearance')
def confirm_clearance(visit_id:str,p:ReasonNote,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','gate','manager')
    return change(db,visit_id,user['name'],'clear',note=p.reason,expected_version=p.expected_version)

@router.post('/visits/{visit_id}/cancel')
def cancel(visit_id:str,p:ReasonNote,db:Session=Depends(get_db),user=Depends(current_user)):
    require(user,'coordinator','manager')
    return change(db,visit_id,user['name'],'cancel',note=p.reason,expected_version=p.expected_version)

@router.get('/decisions')
def get_decisions(db:Session=Depends(get_db),user=Depends(current_user)):
    return {'recommendations':decisions(db),'data_status':'Pilot rules. Availability is based on dock occupancy; staffing not yet integrated.'}

@router.get('/visits/{visit_id}/diagnosis')
def get_diagnosis(visit_id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    visit=db.get(Visit,visit_id)
    if not visit:raise HTTPException(404,'Truck visit not found')
    return diagnosis(db,visit)

@router.get('/analytics/overview')
def get_analytics(db:Session=Depends(get_db),user=Depends(current_user)):
    return analytics(db)
