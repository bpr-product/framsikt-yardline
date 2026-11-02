"""Populate synthetic sample appointments (never real factory data)."""
from datetime import datetime,timedelta,timezone
from sqlalchemy import select
from source.dal.db_session import Base,engine,SessionLocal
from source.dal.models import Dock,Visit,Event
from source.service.VisitsService import record

Base.metadata.create_all(engine)
with SessionLocal() as db:
    if not db.scalar(select(Dock.id).limit(1)):
        db.add_all([Dock(code='DOCK-01',direction='inbound'),Dock(code='DOCK-02',direction='outbound'),Dock(code='DOCK-03',direction='both'),Dock(code='DOCK-04',direction='both')]);db.flush()
    if db.scalar(select(Visit.id).limit(1)):
        print('Visits already exist; skipping seed.')
    else:
        start=datetime.now(timezone.utc)
        examples=[('TN 09 AR 2187','Ravi Kumar','Southline Logistics','inbound','Steel coils','scheduled',3),('KA 03 MJ 7843','Anita Rao','Metro Freight','outbound','Finished machine parts','scheduled',1),('TN 22 CS 1139','Mohammed Ali','FleetBridge Transport','inbound','Industrial pumps','scheduled',5),('KA 01 ZX 4903','Kiran Shah','Global Haulage','outbound','Packaged components','scheduled',2),('TN 10 PS 0068','Ganesh Iyer','Southline Logistics','inbound','Raw materials','scheduled',7)]
        for plate,driver,company,direction,cargo,status,hours in examples:
            visit=Visit(truck_plate=plate,driver=driver,company=company,direction=direction,cargo=cargo,status=status,scheduled_at=start+timedelta(hours=hours))
            db.add(visit);db.flush();record(db,visit,'System','scheduled','Synthetic sample appointment')
        db.commit();print(f'Seeded {len(examples)} synthetic appointments.')
