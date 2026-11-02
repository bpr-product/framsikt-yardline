"""Conservative, explainable demo capacity plan; NOT a live plant staffing schedule."""
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select
from source.dal.models import Dock, Visit

SITE_TIMEZONE = ZoneInfo('Asia/Kolkata')
OPEN_HOUR=8
CLOSE_HOUR=18


def as_utc(value: datetime):
    if value.tzinfo is None: value=value.replace(tzinfo=SITE_TIMEZONE)
    return value.astimezone(timezone.utc)


def is_open(local):
    # Pilot policy: Mon-Sat, 08:00-18:00. Must be configured from real factory hours.
    return local.weekday()<6 and OPEN_HOUR<=local.hour<CLOSE_HOUR


def capacity(db, direction):
    return len(db.scalars(select(Dock).where(Dock.enabled.is_(True),Dock.direction.in_(['both',direction]))).all())


def hour_bucket(value):
    return as_utc(value).astimezone(SITE_TIMEZONE).replace(minute=0,second=0,microsecond=0)


def lock_capacity(db, direction):
    """Serialize reservations on the eligible dock set in Postgres, then re-read the hour."""
    if db.get_bind().dialect.name=='postgresql':
        db.scalars(select(Dock).where(Dock.enabled.is_(True),
            Dock.direction.in_(['both', direction])).order_by(Dock.id).with_for_update()).all()


def booked_count(db,slot_start,direction,excluding=None):
    # In this pilot, one start per compatible dock/hour; no claim of real throughput.
    a=as_utc(slot_start)
    b=a+timedelta(hours=1)
    q=select(Visit).where(Visit.direction==direction,Visit.scheduled_at>=a,Visit.scheduled_at<b,Visit.status.notin_(['cancelled','departed']))
    if excluding:q=q.where(Visit.id!=excluding)
    return len(db.scalars(q).all())


def validate_slot(db, scheduled_at, direction, excluding=None):
    if scheduled_at is None:return
    local=as_utc(scheduled_at).astimezone(SITE_TIMEZONE)
    if not is_open(local):
        raise HTTPException(422,'Pilot operating hours: Monday-Saturday, 08:00-18:00 IST. Choose an open slot.')
    cap=capacity(db,direction)
    if cap==0:raise HTTPException(409,'No compatible active docks can handle this direction')
    if booked_count(db, hour_bucket(local),direction,excluding)>=cap:
        raise HTTPException(409,'This hour is fully booked for compatible docks. Select another slot.')


def slots(db,day:str,direction:str):
    try:d=date.fromisoformat(day)
    except ValueError:raise HTTPException(422,'Use a date in YYYY-MM-DD format')
    if direction not in ('inbound','outbound'):raise HTTPException(422,'Direction must be inbound or outbound')
    cap=capacity(db,direction)
    rows=[]
    for hour in range(OPEN_HOUR,CLOSE_HOUR):
        local=datetime(d.year,d.month,d.day,hour,tzinfo=SITE_TIMEZONE)
        count=booked_count(db,local,direction)
        rows.append({'start_at':local.isoformat(),'booked':count,'capacity':cap,
                     'available':local.weekday()<6 and count<cap and cap>0,
                     'reason': 'Site closed' if local.weekday()>=6 else 'No compatible docks' if not cap else 'Slot full' if count>=cap else 'Space available'})
    return {'day':day,'direction':direction,'timezone':'Asia/Kolkata',
            'policy':'Illustrative: one service start per eligible dock each hour; Mon-Sat 08:00-18:00',
            'slots':rows}
