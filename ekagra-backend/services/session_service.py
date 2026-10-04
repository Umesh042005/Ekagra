"""
Session Service — Lifecycle management, auto-status updates, streak calculation,
and user validation for the Ekagra platform.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from database import supabase
from services.scheduling_service import parse_session_datetime, normalize_to_utc


def update_expired_sessions() -> int:
    """
    Checks all sessions with status='upcoming'. If current time has passed
    (scheduled_at + duration_minutes), updates their status to 'completed'.

    Called at the start of every session-fetching route so frontend clients
    always see real-time accurate session statuses.

    Returns:
        Number of sessions transitioned to 'completed'.
    """
    try:
        now_utc = datetime.now(timezone.utc)
        response = (
            supabase.table("sessions")
            .select("id, scheduled_at, duration_minutes, status")
            .eq("status", "upcoming")
            .execute()
        )

        upcoming_sessions: List[Dict[str, Any]] = response.data or []
        expired_ids: List[str] = []

        for s in upcoming_sessions:
            try:
                start_dt = parse_session_datetime(s["scheduled_at"])
                duration = int(s.get("duration_minutes") or 45)
                end_dt = start_dt + timedelta(minutes=duration)

                if end_dt <= now_utc:
                    expired_ids.append(str(s["id"]))
            except Exception:
                continue

        if not expired_ids:
            return 0

        # Batch update expired sessions
        for eid in expired_ids:
            try:
                supabase.table("sessions").update({"status": "completed"}).eq("id", eid).select().execute()
            except Exception as update_err:
                print(f"Warning: Failed to auto-update session {eid}: {update_err}")

        return len(expired_ids)

    except Exception as e:
        print(f"Warning: update_expired_sessions encountered error: {e}")
        return 0


def calculate_streak(sessions: List[Dict[str, Any]]) -> int:
    """
    Calculate the current streak of consecutive completed sessions without a
    missed or cancelled session in between, from session history.

    Rules:
    - Only completed or cancelled/missed sessions are evaluated (future sessions are ignored).
    - Sessions are sorted in reverse chronological order (most recent first).
    - If the most recent completed/cancelled session was cancelled/missed, streak is 0.
    - Each consecutive completed session adds 1 until a cancelled session is encountered.

    Args:
        sessions: List of session records for the user.

    Returns:
        The current streak integer.
    """
    now_utc = datetime.now(timezone.utc)
    past_sessions: List[Dict[str, Any]] = []

    for s in sessions:
        try:
            start_dt = parse_session_datetime(s["scheduled_at"])
            # Consider sessions that have already occurred or have non-upcoming terminal status
            if start_dt <= now_utc or s.get("status") in ("completed", "cancelled", "missed"):
                past_sessions.append((start_dt, s))
        except Exception:
            continue

    # Sort descending by start time (most recent first)
    past_sessions.sort(key=lambda item: item[0], reverse=True)

    streak = 0
    for _, session in past_sessions:
        status_val = session.get("status", "").lower()
        if status_val == "completed":
            streak += 1
        elif status_val in ("cancelled", "missed"):
            # A cancellation or missed session breaks the consecutive streak
            break

    return streak


def get_student_progress(student_id: str) -> Dict[str, Any]:
    """
    Fetch both 'this_week' (rolling 7-day) and 'overall' (all-time) progress metrics
    and streak count for a student.
    """
    update_expired_sessions()

    response = (
        supabase.table("sessions")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )
    all_sessions: List[Dict[str, Any]] = response.data or []

    now_utc = datetime.now(timezone.utc)
    week_ahead = now_utc + timedelta(days=7)
    week_past = now_utc - timedelta(days=7)

    tw_upcoming_study = 0
    tw_upcoming_moti = 0
    tw_completed_study = 0
    tw_completed_moti = 0

    all_completed_study = 0
    all_completed_moti = 0
    all_upcoming_study = 0
    all_upcoming_moti = 0

    for s in all_sessions:
        s_status = s.get("status")
        s_type = s.get("session_type") or "study"
        try:
            s_dt = parse_session_datetime(s.get("scheduled_at"))
        except Exception:
            s_dt = now_utc

        if s_status == "completed":
            if s_type == "study":
                all_completed_study += 1
                if week_past <= s_dt <= now_utc:
                    tw_completed_study += 1
            else:
                all_completed_moti += 1
                if week_past <= s_dt <= now_utc:
                    tw_completed_moti += 1
        elif s_status == "upcoming":
            if s_type == "study":
                all_upcoming_study += 1
                if now_utc <= s_dt <= week_ahead:
                    tw_upcoming_study += 1
            else:
                all_upcoming_moti += 1
                if now_utc <= s_dt <= week_ahead:
                    tw_upcoming_moti += 1

    streak = calculate_streak(all_sessions)

    return {
        "this_week": {
            "upcoming_study_sessions": tw_upcoming_study,
            "upcoming_motivation_sessions": tw_upcoming_moti,
            "completed_study_sessions": tw_completed_study,
            "completed_motivation_sessions": tw_completed_moti,
        },
        "overall": {
            "total_study_sessions": all_completed_study,
            "total_motivation_sessions": all_completed_moti,
            "current_streak": streak,
        },
        "completed_study_sessions": all_completed_study,
        "completed_motivation_sessions": all_completed_moti,
        "upcoming_study_sessions": tw_upcoming_study,
        "upcoming_motivation_sessions": tw_upcoming_moti,
        "current_streak": streak,
    }


def get_coach_progress(coach_id: str) -> Dict[str, Any]:
    """
    Fetch both 'this_week' (rolling 7-day) and 'overall' (all-time) progress metrics
    and streak count for a coach.
    """
    update_expired_sessions()

    response = (
        supabase.table("sessions")
        .select("*")
        .eq("coach_id", coach_id)
        .execute()
    )
    all_sessions: List[Dict[str, Any]] = response.data or []

    now_utc = datetime.now(timezone.utc)
    week_ahead = now_utc + timedelta(days=7)
    week_past = now_utc - timedelta(days=7)

    tw_upcoming_study = 0
    tw_upcoming_moti = 0
    tw_completed_study = 0
    tw_completed_moti = 0

    all_completed_study = 0
    all_completed_moti = 0
    all_upcoming_study = 0
    all_upcoming_moti = 0

    for s in all_sessions:
        s_status = s.get("status")
        s_type = s.get("session_type") or "study"
        try:
            s_dt = parse_session_datetime(s.get("scheduled_at"))
        except Exception:
            s_dt = now_utc

        if s_status == "completed":
            if s_type == "study":
                all_completed_study += 1
                if week_past <= s_dt <= now_utc:
                    tw_completed_study += 1
            else:
                all_completed_moti += 1
                if week_past <= s_dt <= now_utc:
                    tw_completed_moti += 1
        elif s_status == "upcoming":
            if s_type == "study":
                all_upcoming_study += 1
                if now_utc <= s_dt <= week_ahead:
                    tw_upcoming_study += 1
            else:
                all_upcoming_moti += 1
                if now_utc <= s_dt <= week_ahead:
                    tw_upcoming_moti += 1

    streak = calculate_streak(all_sessions)

    return {
        "this_week": {
            "upcoming_study_sessions": tw_upcoming_study,
            "upcoming_motivation_sessions": tw_upcoming_moti,
            "completed_study_sessions": tw_completed_study,
            "completed_motivation_sessions": tw_completed_moti,
        },
        "overall": {
            "total_study_sessions": all_completed_study,
            "total_motivation_sessions": all_completed_moti,
            "current_streak": streak,
        },
        "completed_study_sessions": all_completed_study,
        "completed_motivation_sessions": all_completed_moti,
        "upcoming_study_sessions": tw_upcoming_study,
        "upcoming_motivation_sessions": tw_upcoming_moti,
        "current_streak": streak,
    }


def validate_user_role(user_id: str, expected_role: str) -> Dict[str, Any]:
    """
    Validates that a user exists in the `users` table and matches the expected role.
    Raises 404 if not found or 400 if role mismatch.
    """
    try:
        res = (
            supabase.table("users")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' could not be retrieved: {str(e)}",
        )

    user_data = res.data
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{expected_role.capitalize()} with ID '{user_id}' does not exist.",
        )

    if user_data.get("role") != expected_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{user_data.get('name', user_id)}' has role '{user_data.get('role')}', but '{expected_role}' is required.",
        )

    if user_data.get("is_active", True) is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{user_data.get('name', user_id)}' has been deactivated.",
        )

    return user_data


def get_user_name_lookup(user_ids: List[str]) -> Dict[str, str]:
    """
    Fetch a dictionary mapping user UUID -> display name for a list of user IDs.
    """
    if not user_ids:
        return {}
    try:
        unique_ids = list(set([uid for uid in user_ids if uid]))
        res = (
            supabase.table("users")
            .select("id, name")
            .in_("id", unique_ids)
            .execute()
        )
        return {row["id"]: row.get("name", "Unknown") for row in (res.data or [])}
    except Exception:
        return {}


def get_student_availability(student_id: str, month_str: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns all booked session slots for a student within a specific month (YYYY-MM).
    Used by coaches to inspect busy/available slots in a calendar view.
    """
    import calendar

    # Ensure past sessions are accurately marked completed
    update_expired_sessions()

    # Validate that student exists
    validate_user_role(student_id, "student")

    # Determine target month
    if not month_str:
        now = datetime.now(timezone.utc)
        month_str = f"{now.year:04d}-{now.month:02d}"

    try:
        parts = month_str.split("-")
        year = int(parts[0])
        month = int(parts[1])
        if not (1 <= month <= 12):
            raise ValueError()
        _, last_day = calendar.monthrange(year, month)
        ist = timezone(timedelta(hours=5, minutes=30))
        start_iso = datetime(year, month, 1, 0, 0, 0, tzinfo=ist).astimezone(timezone.utc).isoformat()
        end_iso = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=ist).astimezone(timezone.utc).isoformat()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid month format '{month_str}'. Expected 'YYYY-MM' (e.g. '2026-09').",
        )

    try:
        res = (
            supabase.table("sessions")
            .select("id, scheduled_at, duration_minutes, status, session_type, session_title, topic")
            .eq("student_id", student_id)
            .neq("status", "cancelled")
            .gte("scheduled_at", start_iso)
            .lte("scheduled_at", end_iso)
            .order("scheduled_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving availability for student '{student_id}': {str(e)}",
        )

