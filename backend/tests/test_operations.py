import os
os.environ['DATABASE_URL']='sqlite://'
os.environ['SESSION_SECRET']='test-secret'
os.environ['DEMO_ACCESS_PIN']='123456'
from sqlalchemy.pool import StaticPool
from source.dal.db_session import Base,engine
from source.dal import db_session
from source.dal.models import Dock
from source.api.AppAPI import app
from fastapi.testclient import TestClient

# Override the shared engine for an in-memory test database.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
eng=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
Session=sessionmaker(bind=eng,expire_on_commit=False)
Base.metadata.create_all(eng)
with Session() as db:
    db.add_all([Dock(id='dock-a',code='D-A',direction='both'),Dock(id='dock-b',code='D-B',direction='both')]);db.commit()
from source.dal.db_session import get_db
def override_db():
    with Session() as session:yield session
app.dependency_overrides[get_db]=override_db
client=TestClient(app)
def auth(name):
    r=client.post('/api/v1/auth/login',json={'name':name,'pin':'123456'})
    return {'Authorization':'Bearer '+r.json()['token']}
def book(number):
    return client.post('/api/v1/visits',headers=auth('Maya Chen'),json={'truck_plate':number,'driver':'Test Driver','company':'Test Logistics','direction':'inbound','cargo':'Steel coils'})
def test_full_workflow_and_audit():
    v=book('TN-10-AB-1111');assert v.status_code==201
    vid=v.json()['id']
    assert client.post(f'/api/v1/visits/{vid}/check-in',headers=auth('Alex Rivera')).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=auth('Sam Okafor')).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/assign',headers=auth('Sam Okafor'),json={'dock_id':'dock-a'}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/start',headers=auth('Sam Okafor')).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/finish',headers=auth('Sam Okafor')).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/depart',headers=auth('Alex Rivera')).status_code==200
    result=client.get(f'/api/v1/visits/{vid}',headers=auth('Priya Shah')).json()
    assert result['visit']['status']=='departed'
    assert len(result['events'])==7
    assert client.get('/api/v1/docks',headers=auth('Priya Shah')).json()[0]['visit_id'] is None

def test_invalid_transition_and_permissions():
    v=book('TN-10-CD-2222');vid=v.json()['id']
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=auth('Sam Okafor')).status_code==409
    assert client.post(f'/api/v1/visits/{vid}/check-in',headers=auth('Maya Chen')).status_code==403

def test_double_booking():
    a=book('TN-10-XX-3001').json()['id'];b=book('TN-10-XX-3002').json()['id']
    for v in [a,b]:
        client.post(f'/api/v1/visits/{v}/check-in',headers=auth('Alex Rivera'))
        client.post(f'/api/v1/visits/{v}/ready',headers=auth('Sam Okafor'))
    assert client.post(f'/api/v1/visits/{a}/assign',headers=auth('Sam Okafor'),json={'dock_id':'dock-a'}).status_code==200
    assert client.post(f'/api/v1/visits/{b}/assign',headers=auth('Sam Okafor'),json={'dock_id':'dock-a'}).status_code==409


def test_cloud_auth_fails_closed(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.delenv('DEMO_ACCESS_PIN', raising=False)
    missing_pin = client.post('/api/v1/auth/login', json={'name': 'Priya Shah', 'pin': ''})
    assert missing_pin.status_code == 503
    monkeypatch.setenv('DEMO_ACCESS_PIN', '123456')
    monkeypatch.delenv('SESSION_SECRET', raising=False)
    missing_signing_secret = client.post('/api/v1/auth/login', json={'name': 'Priya Shah', 'pin': '123456'})
    assert missing_signing_secret.status_code == 503
