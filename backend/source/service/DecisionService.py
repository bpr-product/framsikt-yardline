"""Transparent queue rules, interval evidence, and pilot analytics. No claims of verified causality."""
from datetime import datetime, timezone, timedelta
from math import ceil
from statistics import median
from sqlalchemy import select
from source.dal.models import Visit, Dock, Assignment, Issue, ReadinessCheck, Event
from source.service.IssueService import serialize as issue_json
from source.service.PlanningService import SITE_TIMEZONE, is_open


def utc(v):
    if v is None:return None
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


def elapsed(a,b):
    return max(0,round((utc(b)-utc(a)).total_seconds()/60,1)) if a and b else None


def events_for(db, id):
    return db.scalars(select(Event).where(Event.visit_id==id).order_by(Event.at,Event.id)).all()


def diagnosis(db,visit:Visit,now=None):
    now=now or datetime.now(timezone.utc)
    assignment=db.scalar(select(Assignment).where(Assignment.visit_id==visit.id).order_by(Assignment.assigned_at.desc()))
    events=events_for(db,visit.id)
    ext=next((e.at for e in events if e.action=='external_arrival'),None)
    dock_left=next((e.at for e in reversed(events) if e.action=='dock_released'),None)
    if not dock_left and assignment and assignment.released_at:dock_left=assignment.released_at
    issues=db.scalars(select(Issue).where(Issue.visit_id==visit.id).order_by(Issue.opened_at)).all()
    intervals=[]
    def add(label, start, end, kind):
        if start and end and utc(end)>=utc(start):
            intervals.append({'label':label,'minutes':elapsed(start,end),'kind':kind,'from':utc(start),'to':utc(end)})
    add('Outside gate',ext,visit.arrival_at,'waiting')
    add('Gate, verification and preparation',visit.arrival_at,visit.ready_at,'waiting')
    add('Ready queue / dock wait',visit.ready_at,assignment.assigned_at if assignment else None,'waiting')
    add('Dock setup',assignment.assigned_at if assignment else None,visit.service_started_at,'waiting')
    if visit.service_started_at and visit.service_finished_at:
        t_start=utc(visit.service_started_at);t_end=utc(visit.service_finished_at)
        pause=None;cursor=t_start
        for e in events:
            t=utc(e.at)
            if t<t_start or t>t_end:continue
            if e.action=='pause' and pause is None:
                add('Active loading / unloading',cursor,t,'service');pause=t
            elif e.action=='resume' and pause is not None:
                add('Service interrupted',pause,t,'waiting');pause=None;cursor=t
        if pause is not None:add('Service interrupted',pause,t_end,'waiting')
        else:add('Active loading / unloading',cursor,t_end,'service')
    add('Dock release',visit.service_finished_at,dock_left,'waiting')
    add('Gate departure / clearance',dock_left,visit.departed_at,'waiting')
    intervals.sort(key=lambda v:v['from'])
    covered=round(sum(v['minutes'] for v in intervals),1)
    dwell=elapsed(ext or visit.arrival_at,visit.departed_at) if visit.departed_at else None
    issue_list=[]
    for i in issues:
        d=issue_json(i)
        d['duration_min']=elapsed(i.opened_at,i.resolved_at or now)
        issue_list.append(d)
    source='external arrival recorded at gate' if ext else 'gate entry (outside queue unmeasured)'
    return {'visit_id':visit.id,'truck_plate':visit.truck_plate,'status':visit.status,
        'source':source,'total_dwell_min':dwell,'measured_segments_min':covered,
        'waiting_min':round(sum(x['minutes'] for x in intervals if x['kind']=='waiting'),1),
        'service_min':round(sum(x['minutes'] for x in intervals if x['kind']=='service'),1),
        'segments':intervals,'issues':issue_list,
        'complete':dwell is not None and abs(covered-dwell)<=1,
        'explanation':'Durations describe observed intervals; issue durations can overlap and are not added to total dwell. A missing milestone remains unknown.'}


def readiness_map(db,ids):
    if not ids:return {}
    checks=db.scalars(select(ReadinessCheck).where(ReadinessCheck.visit_id.in_(ids))).all()
    result={}
    for c in checks:result.setdefault(c.visit_id,[]).append(c)
    return result


def decisions(db):
    now=datetime.now(timezone.utc)
    visits=db.scalars(select(Visit).where(Visit.status.notin_(['departed','cancelled'])).order_by(Visit.created_at.desc()).limit(300)).all()
    docks=db.scalars(select(Dock).where(Dock.enabled.is_(True))).all()
    occupied={a.dock_id:a.visit_id for a in db.scalars(select(Assignment).where(Assignment.active_dock_id.is_not(None))).all()}
    checks=readiness_map(db,[v.id for v in visits])
    issue_rows=db.scalars(select(Issue).where(Issue.status.in_(['open','escalated']))).all()
    completed_ids=[v.id for v in visits if v.status=='completed']
    clearances=set(db.scalars(select(Event.visit_id).where(Event.action=='clearance_confirmed',
        Event.visit_id.in_(completed_ids))).all()) if completed_ids else set()
    problems={}
    for x in issue_rows:problems.setdefault(x.visit_id,[]).append(x)
    result=[]
    def push(v,kind,priority,title,reason,owner,action=None,metadata=None):
        result.append({'id':v.id+':'+kind,'visit_id':v.id,'truck_plate':v.truck_plate,'direction':v.direction,
            'kind':kind,'priority':priority,'title':title,'reason':reason,'owner':owner,
            'action':action,'evidence':metadata or {},'status':v.status})
    for v in visits:
        open_issues=problems.get(v.id,[])
        blocking=[i for i in open_issues if i.blocking]
        elapsed_min=elapsed(v.arrival_at,now)
        if blocking:
            top=sorted(blocking,key=lambda i:({'critical':0,'high':1,'medium':2,'low':3}[i.severity],utc(i.opened_at)))[0]
            age=elapsed(top.opened_at,now)
            push(v,'blocker',0 if age>120 else 1,'Resolve '+top.code.replace('_',' '),
                f'{top.owner} owns this {top.severity} issue. Open for {round(age)} min.',top.owner,
                'resolve_issue',{'issue_id':top.id,'minutes_open':age,'code':top.code})
        if v.status=='ready' and not blocking:
            required_checks=checks.get(v.id,[])
            if not required_checks or not all(c.done for c in required_checks):
                push(v,'readiness_revoked',1,'Readiness must be reconfirmed',
                     'One or more essential preparation checks are still incomplete.',
                     'Warehouse / dispatch','readiness',{})
                continue
            free=[d for d in docks if d.id not in occupied and d.direction in ('both',v.direction)]
            if free:
                push(v,'free_dock',0 if elapsed_min and elapsed_min>60 else 1,
                     'Compatible dock is available',f'{len(free)} available dock(s) while this ready truck waits.',
                     'Dock supervisor','assign_dock',{'dock_ids':[d.id for d in free], 'dock_codes':[d.code for d in free]})
            else:push(v,'dock_capacity',2,'Truck waiting for dock capacity',
                      'No compatible free dock. Check expected service finish or staffing.','Dock supervisor',None)
        if v.status=='scheduled' and v.scheduled_at:
            delta_min=(utc(v.scheduled_at)-now).total_seconds()/60
            eta=round(delta_min,1) if delta_min>=0 else None
            items=checks.get(v.id,[])
            ready=bool(items) and all(c.done for c in items)
            if eta is not None and eta<120 and not ready:
                push(v,'pre_arrival',1,'Arrival approaching; preparation incomplete',
                     f'Due in {round(eta)} min; {sum(not c.done for c in items)} readiness checks outstanding.' if items else 'Readiness not yet verified',
                     'Warehouse / dispatch','readiness',{'minutes_until_slot':eta})
            if utc(v.scheduled_at)<now-timedelta(minutes=60):
                push(v,'no_show',2,'Truck has missed its appointment',
                     'No gate check-in recorded more than 60 minutes after planned arrival.',
                     'Logistics coordinator','reschedule',{})
            if not is_open(utc(v.scheduled_at).astimezone(SITE_TIMEZONE)):
                push(v,'calendar',1,'Appointment outside pilot hours',
                     'Pilot operating calendar is Mon-Sat, 08:00-18:00 IST.',
                     'Logistics coordinator','reschedule',{})
        if v.status=='completed':
            if any(a==v.id for a in occupied.values()):
                push(v,'dock_occupied_after_service',1,'Truck still occupying its dock',
                     'Service is finished, but physical departure from the bay is not confirmed.',
                     'Dock supervisor','release_dock',{})
            else:
                done=v.id in clearances
                if not done:push(v,'exit_clearance',1,'Exit clearance not confirmed',
                     'Service finished and bay released. Shipping/receiving documents must be confirmed.',
                     'Gate / dispatch','confirm_clearance',{})
                elif elapsed(v.service_finished_at,now) and elapsed(v.service_finished_at,now)>45:
                    push(v,'exit_delay',1,'Cleared truck still on site',
                         'Gate departure is still missing after clearance.', 'Gate operator','depart',{})
        if v.status=='on_hold' and not blocking:
            push(v,'legacy_hold',1,'Truck has a hold without structured owner',
                 v.hold_reason or 'Describe why this visit is blocked and assign an owner.',
                 'Logistics coordinator','open_issue',{})
        if elapsed_min and elapsed_min>120 and v.status not in ('loading','paused') and not blocking:
            push(v,'aging',2,'Truck has been on site over two hours',
                 f'Elapsed on-site time is {round(elapsed_min)} min. Check its current stage and next action.',
                 'Operations coordinator',None,{'onsite_min':elapsed_min})
    return sorted(result,key=lambda x:(x['priority'],x['truck_plate'],x['kind']))


def percentile(values,p):
    if not values:return None
    v=sorted(values)
    return round(v[max(0,ceil(len(v)*p)-1)],1)


def analytics(db):
    visits=db.scalars(select(Visit)).all()
    complete=[v for v in visits if v.arrival_at and v.departed_at]
    dwell=[elapsed(v.arrival_at,v.departed_at) for v in complete]
    issue_rows=db.scalars(select(Issue)).all()
    resolved=[i for i in issue_rows if i.resolved_at]
    issues_by_code={}
    for i in issue_rows:issues_by_code[i.code]=issues_by_code.get(i.code,0)+1
    cohorts={'inbound':[],'outbound':[]}
    for v in complete:cohorts[v.direction].append(elapsed(v.arrival_at,v.departed_at))
    # Only completed valid visits enter turnaround statistics; active visits are separately reported.
    return {'sample_size':len(dwell),'active_trucks':sum(v.status not in ('departed','cancelled','scheduled') for v in visits),
        'p50_min':percentile(dwell,.5),'p90_min':percentile(dwell,.9),'p95_min':percentile(dwell,.95),
        'mean_min':round(sum(dwell)/len(dwell),1) if dwell else None,
        'issue_open':sum(i.status!='resolved' for i in issue_rows),'issue_resolved':len(resolved),
        'mean_issue_resolution_min':round(sum(elapsed(i.opened_at,i.resolved_at) for i in resolved)/len(resolved),1) if resolved else None,
        'top_reasons':[{'code':k,'count':n} for k,n in sorted(issues_by_code.items(),key=lambda x:-x[1])[:8]],
        'cohorts':{k:{'n':len(v),'p50_min':percentile(v,.5),'p90_min':percentile(v,.9)} for k,v in cohorts.items()},
        'evidence':'Synthetic pilot data. No actual carrier detention charge, savings or causal impact has been verified.',
        'cost':'Not calculated: requires carrier-specific free time and tariff terms.'}
