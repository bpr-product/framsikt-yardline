"""Inbound/outbound prerequisites, persisted independently of the visit state."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from source.dal.models import ReadinessCheck, Visit
from source.service.VisitsService import record

CHECKS = {
    'inbound': (
        ('purchase_order', 'PO / delivery reference verified'),
        ('receiving_crew', 'Receiving team available'),
        ('unloading_equipment', 'Safe unloading equipment ready'),
    ),
    'outbound': (
        ('goods_picked', 'Goods picked and confirmed'),
        ('goods_staged', 'Goods packed and staged'),
        ('shipping_documents', 'Shipping reference and paperwork ready'),
    ),
}

def ensure(db, visit: Visit):
    existing = db.scalars(select(ReadinessCheck).where(ReadinessCheck.visit_id == visit.id)).all()
    if existing:
        return existing
    checks = [ReadinessCheck(visit_id=visit.id, code=c, label=l) for c,l in CHECKS[visit.direction]]
    db.add_all(checks)
    db.flush()
    return checks

def serialize(check):
    return {'id':check.id,'visit_id':check.visit_id,'code':check.code,'label':check.label,
            'required':check.required,'done':check.done,'confirmed_at':check.confirmed_at,'confirmed_by':check.confirmed_by}

def summary(visit, checks):
    # version lets the client keep optimistic-concurrency tokens current without refetching the visit.
    return {'visit_id':visit.id,'direction':visit.direction,'version':visit.version,
            'ready':all(not c.required or c.done for c in checks),'checks':[serialize(c) for c in checks]}

def get(db, visit_id):
    visit=db.get(Visit,visit_id)
    if not visit:raise HTTPException(404,'Truck visit not found')
    checks=db.scalars(select(ReadinessCheck).where(ReadinessCheck.visit_id == visit.id)).all()
    if not checks:
        # Only legacy visits without rows need a write; ordinary reads never commit.
        checks=ensure(db,visit)
        db.commit()
    return summary(visit,checks)

def set_check(db, visit_id, code, done, actor):
    visit=db.scalar(select(Visit).where(Visit.id==visit_id).with_for_update())
    if not visit:raise HTTPException(404,'Truck visit not found')
    if visit.status in ('departed','cancelled'):
        raise HTTPException(409,'Completed visits cannot be modified')
    checks=ensure(db,visit)
    item=next((c for c in checks if c.code==code),None)
    if not item:raise HTTPException(404,'Unknown readiness requirement')
    if item.done!=done:
        item.done=done;item.confirmed_at=datetime.now(timezone.utc) if done else None
        item.confirmed_by=actor if done else None
        visit.version+=1
        record(db,visit,actor,'readiness_confirmed' if done else 'readiness_revoked',item.label)
        if not done and visit.status in ('ready','at_dock','loading','paused','completed'):
            # Do not rewrite the physical stage. Supervisor must open an issue to decide safe recovery.
            record(db,visit,'System','readiness_risk','Requirement revoked after dock eligibility')
    # Build the confirmed response from the rows already in this transaction;
    # do not re-fetch all checks and commit a second time for every click.
    response=summary(visit,checks)
    db.commit()
    return response

def all_ready(db,visit):
    checks=ensure(db,visit)
    return all(not c.required or c.done for c in checks)
