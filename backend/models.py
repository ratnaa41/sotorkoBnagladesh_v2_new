
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Float,
    Text,
    UniqueConstraint,
    Index,
)

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    preferred_district = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Accident(Base):
    __tablename__ = "accidents"

    id = Column(Integer, primary_key=True, index=True)
    event_date = Column(String(20), nullable=True, index=True)
    event_time = Column(String(20), nullable=True)
    district = Column(String(100), nullable=False, index=True)
    upazila = Column(String(100), nullable=True, index=True)
    road_name = Column(String(200), nullable=True)
    accident_type = Column(String(100), nullable=True)
    vehicles_involved = Column(String(200), nullable=True)
    fatalities = Column(Integer, default=0)
    injuries = Column(Integer, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(100), nullable=True)
    verification_status = Column(String(50), default="unverified")

    title = Column(String(500), nullable=True)
    cause_of_accident = Column(String(500), nullable=True)
    weather_condition = Column(String(100), nullable=True)

    light_condition = Column(String(50), nullable=True)
    road_surface = Column(String(100), nullable=True)
    road_surface_condition = Column(String(100), nullable=True)
    road_class = Column(String(50), nullable=True)
    place_type = Column(String(50), nullable=True)
    junction = Column(String(100), nullable=True)
    traffic_control = Column(String(50), nullable=True)
    severity_score = Column(Integer, nullable=True)
    vehicle_count = Column(Integer, nullable=True)
    coord_is_placeholder = Column(Integer, default=0)
    location_text = Column(String(300), nullable=True)
    data_source = Column(String(30), default="news")

    event_year = Column(Integer, nullable=True, index=True)
    event_month = Column(Integer, nullable=True, index=True)
    event_hour = Column(Integer, nullable=True, index=True)


class SavedLocation(Base):
    __tablename__ = "saved_locations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    label = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    upazila = Column(String(100), nullable=True)
    note = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=False, index=True)
    threshold = Column(Integer, default=50)
    time_window = Column(String(20), default="any")
    cooldown_hours = Column(Integer, default=6)
    daily_cap = Column(Integer, default=3)
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    rule_id = Column(Integer, nullable=False)
    location_id = Column(Integer, nullable=False)
    risk_score = Column(Integer, nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SourceRecord(Base):
    """
    Immutable source-row registry.

    One row per physical CSV row. Duplicate candidates are retained.
    This table is separate from canonical Accident records.
    """

    __tablename__ = "source_records"

    id = Column(Integer, primary_key=True, index=True)

    source_name = Column(String(30), nullable=False, index=True)
    source_file = Column(String(120), nullable=False)
    source_row_number = Column(Integer, nullable=False)

    row_fingerprint = Column(String(64), nullable=False, index=True)
    raw_hash = Column(String(64), nullable=False)
    raw_json = Column(Text, nullable=False)

    source_accident_id = Column(String(120), nullable=True, index=True)
    source_dup_key = Column(String(200), nullable=True, index=True)
    source_url = Column(String(500), nullable=True)

    district_hint = Column(String(100), nullable=True, index=True)
    date_quality = Column(String(30), nullable=False, default="unknown")
    event_year_hint = Column(Integer, nullable=True)
    event_month_hint = Column(Integer, nullable=True)
    hour_quality = Column(String(30), nullable=False, default="unknown")

    coordinate_quality = Column(
        String(30), nullable=False, default="missing"
    )
    latitude_hint = Column(Float, nullable=True)
    longitude_hint = Column(Float, nullable=True)

    verification_status = Column(
        String(30), nullable=False, default="unverified"
    )
    duplicate_group = Column(String(64), nullable=True, index=True)

    imported_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "source_name",
            "source_row_number",
            name="uq_source_record_file_row",
        ),
        Index(
            "ix_source_records_source_fingerprint",
            "source_name",
            "row_fingerprint",
        ),
    )
