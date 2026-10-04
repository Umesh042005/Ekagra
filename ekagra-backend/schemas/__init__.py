"""
Pydantic schemas for Ekagra session and scheduling endpoints.
"""
from .session import (
    BookStudySessionRequest,
    BookMotivationSeriesRequest,
    RescheduleSessionRequest,
    StudentMotivationSessionResponse,
    StudentStudySessionResponse,
    StudentUpcomingResponse,
    StudentCompletedResponse,
    CoachSessionResponse,
    CoachUpcomingResponse,
    CoachCompletedResponse,
    MotivationSeriesResponse,
    ProgressResponse,
    StudentUserResponse,
)

__all__ = [
    "BookStudySessionRequest",
    "BookMotivationSeriesRequest",
    "RescheduleSessionRequest",
    "StudentMotivationSessionResponse",
    "StudentStudySessionResponse",
    "StudentUpcomingResponse",
    "StudentCompletedResponse",
    "CoachSessionResponse",
    "CoachUpcomingResponse",
    "CoachCompletedResponse",
    "MotivationSeriesResponse",
    "ProgressResponse",
    "StudentUserResponse",
]
