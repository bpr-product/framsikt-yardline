from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class VisitCreate(BaseModel):
    truck_plate: str = Field(min_length=4,max_length=30)
    driver: str = Field(min_length=2,max_length=80)
    company: str = Field(min_length=2,max_length=100)
    direction: Literal['inbound','outbound']
    cargo: str = Field(min_length=2,max_length=120)
    scheduled_at: datetime | None = None

class HoldRequest(BaseModel):
    reason: str = Field(min_length=5,max_length=500)

class AssignRequest(BaseModel):
    dock_id: str

class LoginRequest(BaseModel):
    name: str
    pin: str
