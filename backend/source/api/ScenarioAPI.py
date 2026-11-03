"""Synthetic interview scenarios: executable policies, no writes to PostgreSQL."""
from fastapi import APIRouter, Depends, HTTPException
from source.service.AuthService import current_user
from source.service.ScenarioService import ScenarioRequest, catalogue, evaluate

router = APIRouter(prefix='/api/v1/scenarios', tags=['Scenario Lab'])

@router.get('')
def list_scenarios(user=Depends(current_user)):
    return {'scenarios': catalogue(), 'data_type': 'synthetic', 'writes_to_database': False}

@router.post('/evaluate')
def evaluate_scenario(payload: ScenarioRequest, user=Depends(current_user)):
    try:
        return evaluate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
