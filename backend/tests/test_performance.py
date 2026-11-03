"""Guard the SQL patterns that previously made routine clicks sluggish."""
from sqlalchemy import event
from test_operations import client, eng, auth, book


def capture_reads(work):
    statements = []
    def before_execute(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)
    event.listen(eng, 'before_cursor_execute', before_execute)
    try:
        result = work()
    finally:
        event.remove(eng, 'before_cursor_execute', before_execute)
    return result, statements


def test_visit_collection_uses_bounded_queries():
    for index in range(5):
        assert book(f'PERF-TRUCK-{index}').status_code == 201
    headers = auth('Priya Shah')
    response, reads = capture_reads(lambda: client.get('/api/v1/visits', headers=headers))
    assert response.status_code == 200
    assert len(response.json()) >= 5
    assert len(reads) <= 3, f'Visits must not run one query per truck: {len(reads)}'


def test_issues_list_is_batched():
    headers = auth('Priya Shah')
    response, reads = capture_reads(lambda: client.get('/api/v1/issues?status=all', headers=headers))
    assert response.status_code == 200
    assert len(reads) <= 2, f'Issue list must join truck records in bulk: {len(reads)}'


def test_checklist_update_does_not_refetch_saved_rows():
    vid = book('PERF-CHECK-1').json()['id']
    headers = auth('Sam Okafor')
    response, reads = capture_reads(lambda: client.post(
        f'/api/v1/visits/{vid}/readiness/purchase_order',
        headers=headers, json={'done': True}))
    assert response.status_code == 200
    assert response.json()['checks'][0]['done'] is True
    assert len(reads) <= 3, f'Checklist save must return in-memory committed state: {len(reads)}'


def test_truck_issue_panel_loads_only_its_own_records():
    from test_operations import client
    first = book('PERF-ISSUE-1').json()['id']
    second = book('PERF-ISSUE-2').json()['id']
    headers = auth('Maya Chen')
    created = client.post(f'/api/v1/visits/{first}/issues', headers=headers, json={
        'code': 'documents_missing', 'description': 'Delivery note not present',
        'owner': 'Gate lead', 'severity': 'high', 'blocking': True,
    })
    assert created.status_code == 201, created.text
    one = client.get(f'/api/v1/visits/{first}/issues', headers=headers)
    two = client.get(f'/api/v1/visits/{second}/issues', headers=headers)
    assert one.status_code == two.status_code == 200
    assert any(i['id'] == created.json()['id'] for i in one.json())
    assert two.json() == []
    missing = client.get('/api/v1/visits/no-such-visit/issues', headers=headers)
    assert missing.status_code == 404


def test_board_returns_visits_docks_and_metrics_in_one_request():
    vid = book('PERF-BOARD-1').json()['id']
    headers = auth('Priya Shah')
    response, reads = capture_reads(lambda: client.get('/api/v1/board', headers=headers))
    assert response.status_code == 200
    body = response.json()
    assert any(v['id'] == vid for v in body['visits'])
    assert body['docks'] and 'on_site' in body['metrics']
    assert len(reads) <= 7, f'Board must stay a fixed number of queries: {len(reads)}'


def test_cancelled_appointments_are_not_counted_on_site():
    headers = auth('Priya Shah')
    before = client.get('/api/v1/metrics', headers=headers).json()['on_site']
    vid = book('PERF-CANCEL-1').json()['id']
    assert client.post(f'/api/v1/visits/{vid}/cancel', headers=headers,
                       json={'reason': 'Carrier withdrew the booking'}).status_code == 200
    assert client.get('/api/v1/metrics', headers=headers).json()['on_site'] == before


def test_capacity_planner_does_not_query_per_hour():
    from datetime import datetime, timedelta, timezone
    day = datetime.now(timezone.utc) + timedelta(days=1)
    while day.weekday() >= 6:
        day += timedelta(days=1)
    slot = day.replace(hour=4, minute=30, second=0, microsecond=0)  # 10:00 IST
    booked = client.post('/api/v1/visits', headers=auth('Maya Chen'), json={
        'truck_plate': 'PERF-SLOT-1', 'driver': 'Test Driver', 'company': 'Test Logistics',
        'direction': 'inbound', 'cargo': 'Steel coils', 'scheduled_at': slot.isoformat()})
    assert booked.status_code == 201, booked.text
    headers = auth('Maya Chen')
    response, reads = capture_reads(lambda: client.get(
        f'/api/v1/planning/slots?day={day.date().isoformat()}&direction=inbound', headers=headers))
    assert response.status_code == 200
    ten = next(s for s in response.json()['slots'] if 'T10:00' in s['start_at'])
    assert ten['booked'] >= 1
    assert len(reads) <= 3, f'Planner must count all hours in one query: {len(reads)}'


def test_readiness_responses_carry_the_visit_version():
    vid = book('PERF-VERSION-1').json()['id']
    headers = auth('Sam Okafor')
    first = client.get(f'/api/v1/visits/{vid}/readiness', headers=headers).json()
    saved = client.post(f"/api/v1/visits/{vid}/readiness/{first['checks'][0]['code']}",
                        headers=headers, json={'done': True}).json()
    assert saved['version'] == first['version'] + 1
    assert client.get(f'/api/v1/visits/{vid}', headers=headers).json()['visit']['version'] == saved['version']
