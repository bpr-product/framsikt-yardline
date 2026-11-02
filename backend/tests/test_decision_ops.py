"""Real API vertical-slice regressions (synthetic SQLite database)."""
import pytest
from datetime import datetime, timedelta, timezone
from test_operations import client,auth,book,confirm_ready

SUP=lambda: auth('Sam Okafor')
GATE=lambda: auth('Alex Rivera')
COORD=lambda: auth('Maya Chen')
MGR=lambda: auth('Priya Shah')

def make(number,direction='inbound'):
    return client.post('/api/v1/visits',headers=COORD(),json={
      'truck_plate':number,'driver':'Scenario Driver','company':'Test Carrier','direction':direction,'cargo':'Test pallets'})

def test_outbound_readiness_is_different_and_blocks_dock():
    v=make('TN-OUT-3100','outbound');assert v.status_code==201;vid=v.json()['id']
    checks=client.get(f'/api/v1/visits/{vid}/readiness',headers=SUP()).json()
    assert {x['code'] for x in checks['checks']}=={'goods_picked','goods_staged','shipping_documents'}
    assert client.post(f'/api/v1/visits/{vid}/check-in',headers=GATE()).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=SUP()).status_code==409
    for x in checks['checks']:
        assert client.post(f"/api/v1/visits/{vid}/readiness/{x['code']}",headers=SUP(),json={'done':True}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=SUP()).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/readiness/goods_staged',headers=SUP(),json={'done':False}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/assign',headers=SUP(),json={'dock_id':'dock-b'}).status_code==409


def test_issue_open_resolve_escalate_and_audit():
    v=book('TN-BLK-3200');vid=v.json()['id']
    client.post(f'/api/v1/visits/{vid}/check-in',headers=GATE())
    confirm_ready(vid)
    created=client.post(f'/api/v1/visits/{vid}/issues',headers=COORD(),json={
        'code':'goods_not_ready','description':'Shipment is not staged','owner':'Warehouse lead','severity':'high'})
    assert created.status_code==201, created.text
    issue=created.json();iid=issue['id']
    assert issue['status']=='open' and issue['blocking']
    assert client.post(f'/api/v1/visits/{vid}/issues',headers=COORD(),json={
        'code':'goods_not_ready','description':'Duplicate staging issue','owner':'Warehouse lead'}).status_code==409
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=SUP()).status_code==409
    assert client.post(f'/api/v1/issues/{iid}/escalate',headers=GATE()).status_code==403
    assert client.post(f'/api/v1/issues/{iid}/escalate',headers=MGR()).json()['status']=='escalated'
    assert client.post(f'/api/v1/issues/{iid}/resolve',headers=SUP(),json={'resolution':'Done'}).status_code==422
    result=client.post(f'/api/v1/issues/{iid}/resolve',headers=SUP(),json={'resolution':'Goods staged and verified'})
    assert result.status_code==200 and result.json()['resolved_at']
    assert client.post(f'/api/v1/visits/{vid}/ready',headers=SUP()).status_code==200
    events=client.get(f'/api/v1/visits/{vid}',headers=MGR()).json()['events']
    assert 'issue_opened' in {e['action'] for e in events}
    assert 'issue_resolved' in {e['action'] for e in events}


def test_service_pause_and_dock_stays_occupied_until_released():
    vid=book('TN-PAU-3300').json()['id']
    client.post(f'/api/v1/visits/{vid}/check-in',headers=GATE())
    confirm_ready(vid)
    client.post(f'/api/v1/visits/{vid}/ready',headers=SUP())
    a=client.post(f'/api/v1/visits/{vid}/assign',headers=SUP(),json={'dock_id':'dock-b'})
    assert a.status_code==200,a.text
    assert client.post(f'/api/v1/visits/{vid}/start',headers=SUP()).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/pause',headers=SUP(),json={'reason':'Forklift maintenance required'}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/finish',headers=SUP()).status_code==409
    assert client.post(f'/api/v1/visits/{vid}/resume',headers=SUP()).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/finish',headers=SUP()).status_code==200
    docks=client.get('/api/v1/docks',headers=SUP()).json()
    assert next(d for d in docks if d['id']=='dock-b')['visit_id']==vid
    other=book('TN-WAIT-3301').json()['id']
    client.post(f'/api/v1/visits/{other}/check-in',headers=GATE());confirm_ready(other)
    client.post(f'/api/v1/visits/{other}/ready',headers=SUP())
    assert client.post(f'/api/v1/visits/{other}/assign',headers=SUP(),json={'dock_id':'dock-b'}).status_code==409
    assert client.post(f'/api/v1/visits/{vid}/clearance',headers=GATE(),json={'reason':'Documents approved'}).status_code==409
    assert client.post(f'/api/v1/visits/{vid}/release-dock',headers=SUP(),json={'reason':'Vehicle has left dock-b'}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/clearance',headers=GATE(),json={'reason':'Documents and seals confirmed'}).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/depart',headers=GATE()).status_code==200


def test_smart_recommendation_uses_free_compatible_dock():
    vid=make('TN-Q-3400','outbound').json()['id']
    client.post(f'/api/v1/visits/{vid}/check-in',headers=GATE());confirm_ready(vid)
    client.post(f'/api/v1/visits/{vid}/ready',headers=SUP())
    response=client.get('/api/v1/decisions',headers=MGR())
    assert response.status_code==200
    row=[r for r in response.json()['recommendations'] if r['visit_id']==vid and r['kind']=='free_dock']
    assert row and 'dock-b' in row[0]['evidence']['dock_ids']


def test_date_slot_rejects_unsupported_and_closed_hours():
    one=client.get('/api/v1/planning/slots?day=2026-11-03&direction=outbound',headers=COORD())
    assert one.status_code==200 and len(one.json()['slots'])==10
    closed=client.get('/api/v1/planning/slots?day=2026-11-08&direction=outbound',headers=COORD()).json()
    assert all(not s['available'] for s in closed['slots'])
    booking=make('TN-C-3500')
    assert booking.status_code==201
    sunday=client.post('/api/v1/visits',headers=COORD(),json={
        'truck_plate':'TN-C-3501','driver':'Someone','company':'Test Carrier',
        'direction':'inbound','cargo':'Pallets','scheduled_at':'2026-11-08T06:00:00Z'})
    assert sunday.status_code==422


def test_appointment_capacity_and_reschedule_preserves_history():
    # Two inbound docks in the test setup, one booking per compatible dock/hour.
    slot='2026-11-03T05:30:00+00:00' # 11:00 IST
    visits=[]
    for n in (1,2):
        v=client.post('/api/v1/visits',headers=COORD(),json={
            'truck_plate':f'TN-CAP-360{n}','driver':'Some Driver','company':'Test Carrier',
            'direction':'inbound','cargo':'Pallets','scheduled_at':slot})
        assert v.status_code==201,v.text
        visits.append(v.json()['id'])
    third=client.post('/api/v1/visits',headers=COORD(),json={
        'truck_plate':'TN-CAP-3603','driver':'Some Driver','company':'Test Carrier',
        'direction':'inbound','cargo':'Pallets','scheduled_at':slot})
    assert third.status_code==409
    changed=client.post(f'/api/v1/visits/{visits[0]}/reschedule',headers=COORD(),json={
        'scheduled_at':'2026-11-03T06:30:00Z','reason':'Loading crew will be available later'})
    assert changed.status_code==200
    fourth=client.post('/api/v1/visits',headers=COORD(),json={
        'truck_plate':'TN-CAP-3604','driver':'Some Driver','company':'Test Carrier',
        'direction':'inbound','cargo':'Pallets','scheduled_at':slot})
    assert fourth.status_code==201
    timeline=client.get(f'/api/v1/visits/{visits[0]}',headers=COORD()).json()['events']
    assert 'rescheduled' in {e['action'] for e in timeline}


def test_outside_gate_and_diagnosis_measurement():
    vid=book('TN-TIME-3700').json()['id']
    assert client.post(f'/api/v1/visits/{vid}/outside-arrival',headers=GATE()).status_code==200
    assert client.post(f'/api/v1/visits/{vid}/outside-arrival',headers=GATE()).status_code==409
    client.post(f'/api/v1/visits/{vid}/check-in',headers=GATE())
    diagnosis=client.get(f'/api/v1/visits/{vid}/diagnosis',headers=COORD())
    assert diagnosis.status_code==200
    data=diagnosis.json()
    assert data['total_dwell_min'] is None and data['complete'] is False
    assert data['source']=='external arrival recorded at gate'
    assert any(s['label']=='Outside gate' for s in data['segments'])


def test_protected_actions_and_invalid_reference():
    assert client.get('/api/v1/decisions').status_code==401
    assert client.post('/api/v1/visits/random/issues',headers=GATE(),json={
        'code':'goods_not_ready','description':'Not in readiness','owner':'Warehouse lead'}).status_code==403
    assert client.get('/api/v1/visits/missing/diagnosis',headers=COORD()).status_code==404


def test_manager_analytics_does_not_invent_cost():
    res=client.get('/api/v1/analytics/overview',headers=MGR())
    assert res.status_code==200
    data=res.json()
    assert isinstance(data['active_trucks'],int)
    assert 'requires carrier-specific' in data['cost']
    assert 'p90_min' in data and 'evidence' in data


def test_walkin_and_cancellation():
    r=client.post('/api/v1/visits/walk-in',headers=GATE(),json={
        'truck_plate':'TN-WAL-3900','driver':'Walkin Driver','company':'Test Carrier',
        'direction':'inbound','cargo':'Fastener boxes'})
    assert r.status_code==201 and r.json()['status']=='checked_in'
    v=book('TN-CAN-3901').json()['id']
    assert client.post(f'/api/v1/visits/{v}/cancel',headers=COORD(),json={'reason':'Carrier cancelled the trip'}).status_code==200
    assert client.post(f'/api/v1/visits/{v}/check-in',headers=GATE()).status_code==409
