"""Data-driven policy tests: does not depend on a Neon connection."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from source.service.ScenarioService import ScenarioRequest, ScenarioState, catalogue, evaluate


def result(name,**overrides):
    preset=next(x for x in catalogue() if x['id']==name)
    state={**preset['state'],**overrides}
    return evaluate(ScenarioRequest(scenario_id=name,state=ScenarioState(**state)))


def codes(out):return {f['code'] for f in out['flags']}


def test_catalog_has_multiple_diverse_cases():
    items=catalogue()
    assert len(items)>=14
    assert len({s['id'] for s in items})==len(items)
    assert len({s['category'] for s in items})>=5


def test_2_hour_late_truck_cannot_claim_assigned_dock():
    out=result('late_reallocated')
    assert out['earliest_start_min']==60
    assert 'MISSED_SLOT' in codes(out)
    assert 'DOCK_BUSY' in codes(out)
    assert 'preempt' in out['flags'][0]['reason'].lower()


def test_urgent_truck_requires_human_approval():
    before=result('emergency_priority')
    after=result('emergency_priority',priority_approved=True)
    assert before['status']=='approval_required'
    assert 'URGENT_APPROVAL' in codes(before)
    assert before['earliest_start_min']==175
    assert after['queue_position']==1
    assert after['earliest_start_min']==35  # still cannot interrupt current loading


def test_priority_never_overrides_safety():
    out=result('emergency_priority',priority_approved=True,gate_cleared=False,yard_space=False)
    assert out['status']=='blocked'
    assert 'GATE_VERIFICATION' in codes(out) and 'YARD_FULL' in codes(out)


def test_peak_queue_recalculates_without_side_effect():
    original=result('bunched_arrivals')
    reduced=result('bunched_arrivals',queue_ahead=2)
    assert reduced['earliest_start_min'] < original['earliest_start_min']
    assert reduced['queue_position']==3


def test_goods_readiness_change_updates_estimate():
    original=result('goods_not_ready')
    solved=result('goods_not_ready',goods_ready=True)
    assert original['status']=='blocked'
    assert 'GOODS_NOT_READY' in codes(original)
    assert solved['status']=='eligible'
    assert solved['earliest_start_min']==0


def test_documents_cannot_be_ignored():
    assert 'DOCUMENTS_MISSING' in codes(result('missing_documents'))
    assert result('missing_documents',documents_ready=True)['status']=='eligible'


def test_dock_failure_needs_valid_alternate_or_repair():
    broken=result('dock_breakdown')
    alternative=result('dock_breakdown',alternate_dock_available=True)
    assert broken['status']=='blocked'
    assert broken['earliest_start_min']==240
    assert alternative['earliest_start_min']==0
    assert 'DOCK_OUT_OF_SERVICE' not in codes(alternative)


def test_crew_and_equipment_block_empty_docks():
    assert result('no_crew')['status']=='blocked'
    assert result('equipment_failure')['status']=='blocked'
    assert result('no_crew',crew_ready=True)['earliest_start_min']==0
    assert result('equipment_failure',equipment_ready=True)['earliest_start_min']==0


def test_loading_overrun_cascades_and_alternate_changes_forecast():
    out=result('loading_overrun')
    assert out['earliest_start_min']==255
    alt=result('loading_overrun',alternate_dock_available=True,queue_ahead=0)
    assert alt['earliest_start_min']==0


def test_shift_closure_rolls_to_next_staffed_window():
    out=result('shift_close')
    assert 'SHIFT_WINDOW' in codes(out)
    assert out['earliest_start_min']==750
    ot=result('shift_close',overtime_approved=True)
    assert ot['earliest_start_min']==0


def test_walkin_is_recorded_as_a_review_not_a_guarantee():
    out=result('walk_in')
    assert 'WALK_IN' in codes(out)
    assert out['queue_position']==3


def test_unknown_compatible_dock_must_not_fabricate_eta():
    out=result('wrong_dock')
    assert out['earliest_start_min'] is None
    assert out['status']=='blocked'
    assert result('wrong_dock',alternate_dock_available=True)['earliest_start_min']==0


def test_exit_clearance_is_independent_of_loading_finish():
    out=result('exit_blocked')
    assert out['status']=='exit_blocked'
    assert {'DOCK_STILL_OCCUPIED','EXIT_DOCUMENTS','EXIT_CLEARANCE'}==codes(out)
    after=result('exit_blocked',physically_left_dock=True,documents_ready=True,exit_cleared=True)
    assert after['status']=='cleared_to_depart'


def test_noshow_releases_scheduling_reservation_but_does_not_free_busy_dock():
    out=result('no_show')
    assert 'MISSED_SLOT' in codes(out)
    assert out['earliest_start_min']==135


def test_simultaneous_blockers_are_not_summed():
    out=result('multiple_holds')
    assert out['status']=='blocked'
    assert out['earliest_start_min']==720
    assert len(out['flags'])>=3
    # Longest prerequisite is 680, not 680+590.
    assert 680<out['earliest_start_min']<900


def test_out_of_range_inputs_rejected():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):ScenarioState(queue_ahead=-2)
    with pytest.raises(ValidationError):ScenarioState(service_min=0)
