import os
from contextlib import asynccontextmanager
from fastapi import FastAPI,Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from source.dal.db_session import Base,engine,SessionLocal
from source.dal.models import Dock
from source.service.AuthService import authenticate,current_user
from source.api.VisitsAPI import router

@asynccontextmanager
async def lifespan(app:FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if not db.scalar(select(Dock.id).limit(1)):
            db.add_all([Dock(code='DOCK-01',direction='inbound'),Dock(code='DOCK-02',direction='outbound'),Dock(code='DOCK-03',direction='both'),Dock(code='DOCK-04',direction='both')]);db.commit()
    yield

app=FastAPI(title='Yardline API',version='1.0.0',lifespan=lifespan)
allowed=os.environ.get('ALLOWED_ORIGINS','http://localhost:5173').split(',')
app.add_middleware(CORSMiddleware,allow_origins=allowed,allow_methods=['GET','POST'],allow_headers=['Authorization','Content-Type'])
app.include_router(router)
class Login(BaseModel):
    name:str
    pin:str
@app.post('/api/v1/auth/login')
def login(body:Login):return authenticate(body.name,body.pin)
@app.get('/api/v1/auth/me')
def me(user=Depends(current_user)):return user
@app.get('/api/health')
def health():return {'status':'ok','environment':'pilot'}
