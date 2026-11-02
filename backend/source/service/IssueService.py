"""Structured operational issues with accountable owners, safe resolution and audit."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from source.dal.models import Issue, Visit
from source.service.VisitsService import record

ISSUE_TYPES = {
 'goods_not_ready':('readiness','warehouse','Goods are not ready for the truck'),
 'documents_missing':('documents','dispatch','Required documents are missing'),
 'dock_unavailable':('dock','dock supervisor','Compatible dock is unavailable'),
 'crew_unavailable':('resources','warehouse','Handling crew is unavailable'),
 'equipment_breakdown':('resources','maintenance','Equipment is out of service'),
 'quality_discrepancy':('quality','quality','Quantity or quality issue needs review'),
 'gate_verification':('gate','gate','Gate verification requires follow-up'),
 'driver_unavailable':('transport','coordinator','Driver or vehicle cannot move safely'),
 'clearance_pending':('documents','dispatch','Exit clearance is not complete'),
 'other':('operations','coordinator','Operational issue requires investigation'),
}
SEVERITIES={'low','medium','high','critical'}

def serialize(issue):
    return {'id':issue.id,'visit_id':issue.visit_id,'code':issue.code,'category':issue.category,
        'description':issue.description,'owner':issue.owner,'severity':issue.severity,'blocking':issue.blocking,
        'status':issue.status,'opened_at':issue.opened_at,'resolved_at':issue.resolved_at,
        'escalated_at':issue.escalated_at,'resolution_note':issue.resolution_note}

def create(db,visit_id,actor,code,description,owner,severity='medium',blocking=True):
    visit=db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit:raise HTTPException(404,'Truck visit not found')
    if visit.status in ('departed','cancelled'):raise HTTPException(409,'This visit has ended')
    if code not in ISSUE_TYPES:raise HTTPException(422,'Unknown issue code')
    if severity not in SEVERITIES:raise HTTPException(422,'Unknown severity')
    if not owner.strip():raise HTTPException(422,'Assign a responsible owner')
    duplicate=db.scalar(select(Issue).where(Issue.visit_id==visit_id,Issue.code==code,Issue.status.in_(['open','escalated'])))
    if duplicate:raise HTTPException(409,'This problem is already open. Resolve it instead of duplicating it.')
    category,_,default=ISSUE_TYPES[code]
    issue=Issue(visit_id=visit.id,code=code,category=category,description=description or default,
                owner=owner.strip(),severity=severity,blocking=blocking)
    db.add(issue);db.flush();visit.version+=1
    record(db,visit,actor,'issue_opened',f'{code}: {issue.description} (owner: {owner})')
    db.commit();db.refresh(issue)
    return serialize(issue)

def resolve(db,issue_id,actor,note):
    issue=db.scalar(select(Issue).where(Issue.id==issue_id).with_for_update())
    if not issue:raise HTTPException(404,'Issue not found')
    if issue.status=='resolved':raise HTTPException(409,'Issue already resolved')
    if len(note.strip())<5:raise HTTPException(422,'Add an explanation of how this was resolved')
    visit=db.scalar(select(Visit).where(Visit.id==issue.visit_id).with_for_update())
    issue.status='resolved';issue.resolved_at=datetime.now(timezone.utc);issue.resolution_note=note.strip()
    visit.version+=1
    record(db,visit,actor,'issue_resolved',f'{issue.code}: {note.strip()}')
    db.commit();db.refresh(issue)
    return serialize(issue)

def escalate(db,issue_id,actor):
    issue=db.scalar(select(Issue).where(Issue.id==issue_id).with_for_update())
    if not issue:raise HTTPException(404,'Issue not found')
    if issue.status=='resolved':raise HTTPException(409,'Resolved issues cannot be escalated')
    if issue.status=='escalated':return serialize(issue)
    issue.status='escalated';issue.escalated_at=datetime.now(timezone.utc)
    visit=db.scalar(select(Visit).where(Visit.id==issue.visit_id).with_for_update());visit.version+=1
    record(db,visit,actor,'issue_escalated',f'{issue.code}: escalation requested for {issue.owner}')
    db.commit();db.refresh(issue)
    return serialize(issue)

def active_blockers(db,visit_id):
    return db.scalars(select(Issue).where(Issue.visit_id==visit_id,Issue.blocking.is_(True),Issue.status.in_(['open','escalated']))).all()
