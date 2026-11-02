from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class ReadinessUpdate(BaseModel):
    done:bool

class IssueCreate(BaseModel):
    code: Literal['goods_not_ready','documents_missing','dock_unavailable','crew_unavailable',
                  'equipment_breakdown','quality_discrepancy','gate_verification','driver_unavailable','clearance_pending','other']
    description:str=Field(min_length=5,max_length=800)
    owner:str=Field(min_length=2,max_length=80)
    severity:Literal['low','medium','high','critical']='medium'
    blocking:bool=True

class IssueResolve(BaseModel):
    resolution:str=Field(min_length=5,max_length=800)

class ReasonNote(BaseModel):
    reason:str=Field(min_length=5,max_length=500)
    expected_version:int|None=None

class Reschedule(BaseModel):
    scheduled_at:datetime
    reason:str=Field(min_length=5,max_length=300)

class ActionVersion(BaseModel):
    expected_version:int|None=None
