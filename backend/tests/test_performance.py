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
