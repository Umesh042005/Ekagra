"""
Scheduling Service — Single Source of Truth for Time Conflict Detection.

Provides robust, mathematical interval overlap detection to prevent double-booking
for both students and coaches across 1:1 study sessions and recurring motivation series.

Interval Overlap Rule:
Two sessions [S1, E1) and [S2, E2) overlap if and only if:
    S1 < E2  AND  S2 < E1
This strictly allows seamless back-to-back scheduling (e.g., 10:00-10:45 followed by 10:45-11:30)
while immediately flagging partial or complete clashes (e.g., 10:00-10:45 and 10:30-11:15).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any, List
from database import supabase


IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def normalize_to_utc(dt: datetime) -> datetime:
    """
    Ensure datetime is timezone-aware and normalized to UTC for consistent comparisons.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_session_datetime(val: Any) -> datetime:
    """
    Parse an ISO timestamp string or datetime object into a UTC timezone-aware datetime.
    """
    if isinstance(val, datetime):
        return normalize_to_utc(val)
    if isinstance(val, str):
        # Handles standard ISO 8601 strings (e.g. 2026-09-28T10:00:00+00:00 or 2026-09-28T10:00:00)
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        return normalize_to_utc(dt)
    raise ValueError(f"Unable to parse datetime from {val}")


def format_datetime_for_display(val: Any) -> str:
    """
    Format a datetime (ISO string or datetime object) into user's local time (IST)
    e.g. 'Mon, 28 Sep at 08:00 AM'
    """
    dt = parse_session_datetime(val)
    local_dt = dt.astimezone(IST_TIMEZONE)
    return local_dt.strftime('%a, %d %b at %I:%M %p')


def check_time_conflict(
    person_id: str,
    role: str,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_session_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Check if a person (student or coach) has an overlapping session during
    the proposed [scheduled_at, scheduled_at + duration_minutes) window.

    Args:
        person_id: UUID string of the student or coach.
        role: 'student' or 'coach'.
        scheduled_at: Proposed start datetime.
        duration_minutes: Proposed duration in minutes.
        exclude_session_id: Optional session ID to omit (used during rescheduling).

    Returns:
        The conflicting session dictionary if an overlap exists, or None if free.
    """
    cand_start = normalize_to_utc(scheduled_at)
    cand_end = cand_start + timedelta(minutes=duration_minutes)

    # Determine database column based on user role
    role_column = "student_id" if role == "student" else "coach_id"

    # Query active/non-cancelled sessions within a 24-hour buffer around the proposed time
    # This limits network payload while guaranteeing all potential overlapping sessions are evaluated.
    search_start = (cand_start - timedelta(days=1)).isoformat()
    search_end = (cand_end + timedelta(days=1)).isoformat()

    try:
        query = (
            supabase.table("sessions")
            .select("*")
            .eq(role_column, person_id)
            .neq("status", "cancelled")
            .gte("scheduled_at", search_start)
            .lte("scheduled_at", search_end)
        )

        response = query.execute()
        sessions: List[Dict[str, Any]] = response.data or []

    except Exception:
        # Fallback query if range filtering encounters format issues
        response = (
            supabase.table("sessions")
            .select("*")
            .eq(role_column, person_id)
            .neq("status", "cancelled")
            .execute()
        )
        sessions = response.data or []

    # Check each candidate for interval overlap: S1 < E2 and S2 < E1
    for existing in sessions:
        if exclude_session_id and str(existing.get("id")) == str(exclude_session_id):
            continue

        try:
            existing_start = parse_session_datetime(existing["scheduled_at"])
            existing_duration = int(existing.get("duration_minutes") or 45)
            existing_end = existing_start + timedelta(minutes=existing_duration)

            # Strict interval overlap check (half-open [start, end))
            if cand_start < existing_end and existing_start < cand_end:
                return existing

        except Exception:
            continue

    return None


def check_both_parties_conflict(
    student_id: str,
    coach_id: str,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_session_id: Optional[str] = None,
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Single source of truth to check both student and coach availability.

    Returns:
        (has_conflict, unavailable_party, conflicting_session)
        - If conflict for student: (True, "student", session_data)
        - If conflict for coach:   (True, "coach", session_data)
        - If clear:               (False, None, None)
    """
    # 1. Check student schedule
    student_conflict = check_time_conflict(
        person_id=student_id,
        role="student",
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        exclude_session_id=exclude_session_id,
    )
    if student_conflict:
        return True, "student", student_conflict

    # 2. Check coach schedule
    coach_conflict = check_time_conflict(
        person_id=coach_id,
        role="coach",
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        exclude_session_id=exclude_session_id,
    )
    if coach_conflict:
        return True, "coach", coach_conflict

    return False, None, None
