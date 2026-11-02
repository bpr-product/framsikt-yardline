import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from .db_session import Base

def uid():
    return str(uuid.uuid4())
def now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True, default=uid)
    name = Column(String(80), nullable=False)
    role = Column(String(32), nullable=False)
    pin_hash = Column(String(128), nullable=False)

class Dock(Base):
    __tablename__ = 'docks'
    id = Column(String(36), primary_key=True, default=uid)
    code = Column(String(20), unique=True, nullable=False)
    direction = Column(String(16), nullable=False, default='both')
    enabled = Column(Boolean, default=True, nullable=False)

class Visit(Base):
    __tablename__ = 'visits'
    id = Column(String(36), primary_key=True, default=uid)
    truck_plate = Column(String(30), nullable=False)
    driver = Column(String(80), nullable=False)
    company = Column(String(100), nullable=False)
    direction = Column(String(16), nullable=False)
    cargo = Column(String(120), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    arrival_at = Column(DateTime(timezone=True), nullable=True)
    ready_at = Column(DateTime(timezone=True), nullable=True)
    service_started_at = Column(DateTime(timezone=True), nullable=True)
    service_finished_at = Column(DateTime(timezone=True), nullable=True)
    departed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default='scheduled', index=True)
    hold_reason = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now)

class Assignment(Base):
    __tablename__ = 'assignments'
    id = Column(String(36), primary_key=True, default=uid)
    visit_id = Column(String(36), ForeignKey('visits.id'), nullable=False)
    dock_id = Column(String(36), ForeignKey('docks.id'), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=now, nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    active_dock_id = Column(String(36), nullable=True, unique=True)
    active_visit_id = Column(String(36), nullable=True, unique=True)
    __table_args__ = (Index('ix_assignment_dock', 'dock_id'),)

class Event(Base):
    __tablename__ = 'events'
    id = Column(String(36), primary_key=True, default=uid)
    visit_id = Column(String(36), ForeignKey('visits.id'), nullable=False, index=True)
    actor = Column(String(80), nullable=False)
    action = Column(String(40), nullable=False)
    note = Column(Text, nullable=True)
    at = Column(DateTime(timezone=True), default=now, nullable=False)

class Issue(Base):
    """A time-bounded operational blocker without overwriting the truck's physical stage."""
    __tablename__ = 'issues'
    id = Column(String(36), primary_key=True, default=uid)
    visit_id = Column(String(36), ForeignKey('visits.id'), nullable=False, index=True)
    code = Column(String(48), nullable=False)
    category = Column(String(36), nullable=False)
    description = Column(Text, nullable=False)
    owner = Column(String(80), nullable=False)
    severity = Column(String(12), nullable=False, default='medium')
    blocking = Column(Boolean, nullable=False, default=True)
    status = Column(String(20), nullable=False, default='open', index=True)
    opened_at = Column(DateTime(timezone=True), nullable=False, default=now)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)
    __table_args__ = (Index('ix_issue_visit_status', 'visit_id', 'status'),)

class ReadinessCheck(Base):
    __tablename__ = 'readiness_checks'
    id = Column(String(36), primary_key=True, default=uid)
    visit_id = Column(String(36), ForeignKey('visits.id'), nullable=False, index=True)
    code = Column(String(40), nullable=False)
    label = Column(String(120), nullable=False)
    required = Column(Boolean, nullable=False, default=True)
    done = Column(Boolean, nullable=False, default=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(String(80), nullable=True)
    __table_args__ = (UniqueConstraint('visit_id', 'code', name='uq_visit_readiness_code'),)
