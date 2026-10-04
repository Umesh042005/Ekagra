"""
Session Schemas for Ekagra Platform.

Defines industry-standard Pydantic models for request bodies and response
payloads, enforcing:
- Minimum future scheduling window (at least 30 minutes in the future)
- Strict duration boundaries
- Privacy enforcement at the schema layer (coach details omitted for student motivation views)
"""

from datetime import datetime, date, time, timedelta, timezone
import re
from typing import List, Optional, Union, Literal, Annotated
from pydantic import BaseModel, Field, field_validator


# ── REQUEST MODELS ────────────────────────────────────────────────────────────

class BookStudySessionRequest(BaseModel):
    """
    Request payload for booking a 1:1 study session between a coach and a student.
    """
    student_id: str = Field(..., description="UUID of the student")
    scheduled_at: datetime = Field(..., description="Session start time (ISO 8601), at least 30 min in the future")
    duration_minutes: int = Field(default=45, ge=15, le=360, description="Session duration in minutes (15 to 360)")
    topic: Optional[str] = Field(default=None, max_length=255, description="Subject or focus area")
    session_title: Optional[str] = Field(default=None, max_length=255, description="Custom title for the session")

    @field_validator("scheduled_at")
    @classmethod
    def validate_future_time(cls, v: datetime) -> datetime:
        now_utc = datetime.now(timezone.utc)
        target = v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        # Allow a slight 30-second clock skew margin
        if target < now_utc + timedelta(minutes=29, seconds=30):
            raise ValueError("scheduled_at must be at least 30 minutes in the future.")
        return target


class BookMotivationSeriesRequest(BaseModel):
    """
    Request payload for booking a multi-session recurring motivation series with coach rotation.
    """
    student_id: str = Field(..., description="UUID of the student")
    start_date: date = Field(..., description="First session date (YYYY-MM-DD)")
    time_of_day: str = Field(..., description="Time in HH:MM 24-hour format, in IST (e.g., '19:00')")
    number_of_sessions: Optional[int] = Field(default=None, ge=1, le=60, description="Stop after this many sessions (1-60). Omit for an ongoing series with no end.")
    coach_ids: List[str] = Field(..., min_length=1, description="List of coach UUIDs rotating through the series")
    session_title: str = Field(default="Evening Reflection Session", min_length=1, max_length=255, description="Title for all sessions in series")
    duration_minutes: int = Field(default=45, ge=15, le=360, description="Session duration in minutes (15 to 360)")

    @field_validator("time_of_day")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        pattern = r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$"
        if not re.match(pattern, v.strip()):
            raise ValueError("time_of_day must be in 'HH:MM' 24-hour format (e.g., '19:00').")
        return v.strip()

    @field_validator("coach_ids")
    @classmethod
    def validate_coach_ids(cls, v: List[str]) -> List[str]:
        cleaned = [cid.strip() for cid in v if cid.strip()]
        if not cleaned:
            raise ValueError("coach_ids list must contain at least one valid coach UUID.")
        return cleaned


class RescheduleSessionRequest(BaseModel):
    """
    Request payload for rescheduling an existing session.
    """
    new_scheduled_at: datetime = Field(..., description="New session start time (ISO 8601), at least 30 min in future")
    new_duration_minutes: Optional[int] = Field(default=None, ge=15, le=360, description="Optional updated duration")

    @field_validator("new_scheduled_at")
    @classmethod
    def validate_future_time(cls, v: datetime) -> datetime:
        now_utc = datetime.now(timezone.utc)
        target = v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        if target < now_utc + timedelta(minutes=29, seconds=30):
            raise ValueError("new_scheduled_at must be at least 30 minutes in the future.")
        return target


# ── RESPONSE MODELS (PART 5: SCHEMA-LEVEL PRIVACY ENFORCEMENT) ────────────────

class StudentMotivationSessionResponse(BaseModel):
    """
    Student view of a motivation session.
    CRITICAL PRIVACY REQUIREMENT:
    Coach identity (coach_id, coach_name, email) is STRICTLY OMITTED at the schema level.
    Only essential session parameters and the warm title are exposed to the student.
    """
    id: str
    scheduled_at: datetime
    duration_minutes: int
    zoom_link: Optional[str] = None
    status: str
    session_type: Literal["motivation"] = "motivation"
    session_title: Optional[str] = None
    recurrence_group_id: Optional[str] = None


class StudentStudySessionResponse(BaseModel):
    """
    Student view of a 1:1 study session.
    Includes coach identity because the student directly booked with their assigned coach.
    """
    id: str
    scheduled_at: datetime
    duration_minutes: int
    zoom_link: Optional[str] = None
    status: str
    session_type: Literal["study"] = "study"
    session_title: Optional[str] = None
    topic: Optional[str] = None
    coach_id: str
    coach_name: Optional[str] = None


# Discriminated union for student session lists
StudentSessionItem = Annotated[
    Union[StudentStudySessionResponse, StudentMotivationSessionResponse],
    Field(discriminator="session_type")
]


class StudentUpcomingResponse(BaseModel):
    """
    Response for student upcoming sessions.
    Includes rolling weekly scope items and warm empty-state message if empty.
    """
    sessions: List[StudentSessionItem]
    message: Optional[str] = None


class StudentCompletedResponse(BaseModel):
    """
    Response for student completed session history.
    """
    sessions: List[StudentSessionItem]


class CoachSessionResponse(BaseModel):
    """
    Coach view of any session (study or motivation).
    Coaches only see sessions where they themselves are assigned, with full details.
    """
    id: str
    student_id: str
    student_name: Optional[str] = None
    coach_id: str
    coach_name: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int
    zoom_link: Optional[str] = None
    status: str
    session_type: str
    session_title: Optional[str] = None
    topic: Optional[str] = None
    recurrence_group_id: Optional[str] = None


class CoachUpcomingResponse(BaseModel):
    """
    Response for coach upcoming sessions.
    Includes rolling weekly scope items and warm empty-state message if empty.
    """
    sessions: List[CoachSessionResponse]
    message: Optional[str] = None


class CoachCompletedResponse(BaseModel):
    """
    Response for coach completed session history.
    """
    sessions: List[CoachSessionResponse]


class MotivationSeriesResponse(BaseModel):
    """
    Response returned after successfully creating an atomic recurring motivation series.
    """
    message: str
    recurrence_group_id: str
    session_title: str
    zoom_link: str
    total_sessions: int  # sessions booked now (an ongoing series keeps adding more)
    ongoing: bool = False
    sessions: List[CoachSessionResponse]


class SeriesResponse(BaseModel):
    """
    A recurring motivation series (the rule), as shown on the mentor's series list.
    """
    id: str
    student_id: str
    student_name: Optional[str] = None
    session_title: str
    time_of_day: str  # HH:MM, IST
    interval_days: int
    duration_minutes: int
    start_date: date
    max_sessions: Optional[int] = None  # None = ongoing
    status: Literal["active", "paused", "ended"]
    mentor_names: List[str] = []
    next_session_at: Optional[datetime] = None


class ThisWeekProgress(BaseModel):
    upcoming_study_sessions: int = 0
    upcoming_motivation_sessions: int = 0
    completed_study_sessions: int = 0
    completed_motivation_sessions: int = 0


class OverallProgress(BaseModel):
    total_study_sessions: int = 0
    total_motivation_sessions: int = 0
    current_streak: int = 0


class ProgressResponse(BaseModel):
    """
    Two-section progress response:
    - this_week: Rolling 7-day window counts for upcoming and completed sessions
    - overall: All-time totals and current streak
    """
    this_week: ThisWeekProgress
    overall: OverallProgress
    # Optional flat compatibility fields
    completed_study_sessions: Optional[int] = None
    completed_motivation_sessions: Optional[int] = None
    upcoming_study_sessions: Optional[int] = None
    upcoming_motivation_sessions: Optional[int] = None
    current_streak: Optional[int] = None


class StudentUserResponse(BaseModel):
    """
    Student profile item for coach selection dropdowns.
    """
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None


class BookedTimeSlot(BaseModel):
    """
    Booked session slot for student availability calendar.
    """
    id: str
    scheduled_at: datetime
    duration_minutes: int = 45
    status: str
    session_type: Optional[str] = "study"
    session_title: Optional[str] = None
    topic: Optional[str] = None

