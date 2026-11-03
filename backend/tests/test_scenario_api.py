"""Integration checks for the authenticated, read-only Scenario Lab API."""
from test_operations import client, auth


def test_scenario_catalogue_requires_login_and_has_no_writes():
    assert client.get('/api/v1/scenarios').status_code==401
    response=client.get('/api/v1/scenarios',headers=auth('Priya Shah'))
    assert response.status_code==200
    data=response.json()
    assert data['data_type']=='synthetic' and data['writes_to_database'] is False
    assert len(data['scenarios'])>=14


def test_evaluate_late_truck_against_current_busy_dock():
    headers=auth('Maya Chen')
    catalogue=client.get('/api/v1/scenarios',headers=headers).json()['scenarios']
    case=next(x for x in catalogue if x['id']=='late_reallocated')
    response=client.post('/api/v1/scenarios/evaluate',headers=headers,json={
        'scenario_id':case['id'],'state':case['state']})
    assert response.status_code==200,response.text
    data=response.json()
    assert data['earliest_start_min']==60
    assert any(f['code']=='MISSED_SLOT' for f in data['flags'])
    altered={**case['state'],'alternate_dock_available':True}
    changed=client.post('/api/v1/scenarios/evaluate',headers=headers,json={
        'scenario_id':case['id'],'state':altered})
    assert changed.status_code==200 and changed.json()['earliest_start_min']==0


def test_invalid_scenario_and_input():
    headers=auth('Priya Shah')
    payload={'scenario_id':'unknown-id','state':{}}
    assert client.post('/api/v1/scenarios/evaluate',headers=headers,json=payload).status_code==404
    assert client.post('/api/v1/scenarios/evaluate',headers=headers,json={
        'scenario_id':'late_reallocated','state':{'service_min':0}}).status_code==422
