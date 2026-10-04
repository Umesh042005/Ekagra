"""
Student Routes for Ekagra Platform.

Endpoints:
- GET /student/profile: Profile information for authenticated student.
- GET /student/sessions/upcoming: Rolling weekly upcoming sessions (with privacy protection).
- GET /student/sessions/completed: Historical completed sessions.
- GET /student/progress: All-time session metrics and attendance streak.

CRITICAL PRIVACY IMPLEMENTATION (PART 5):
For motivation sessions (session_type='motivation'), coach identity (coach_id, coach_name)
is STRICTLY EXCLUDED at the schema level via StudentMotivationSessionResponse.
For study sessions (session_type='study'), coach identity is preserved.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status

from middleware.auth_middleware import require_role
from database import supabase
from services.session_service import (
    update_expired_sessions,
    get_student_progress,
    get_user_name_lookup,
)
from services.scheduling_service import parse_session_datetime
from schemas.session import (
    StudentUpcomingResponse,
    StudentCompletedResponse,
    StudentStudySessionResponse,
    StudentMotivationSessionResponse,
    StudentSessionItem,
    ProgressResponse,
)

router = APIRouter(prefix="/student", tags=["Student"])


@router.get(
    "/profile",
    summary="Get student profile",
    response_description="Profile row for the authenticated student",
)
async def get_student_profile(user: dict = Depends(require_role("student"))):
    """
    Return the logged-in student's profile from the `users` table.
    Protected — only accessible by users with the 'student' role.
    """
    try:
        response = (
            supabase.table("users")
            .select("*")
            .eq("id", user["auth_id"])
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found.",
            )

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}",
        )


@router.get(
    "/sessions/upcoming",
    response_model=StudentUpcomingResponse,
    summary="Get student upcoming sessions within rolling window",
    response_description="Upcoming sessions within weekly window with coach identity hidden for motivation sessions",
)
async def get_upcoming_sessions(
    scope: str = Query("all", pattern="^(next|week|month|all|all_upcoming)$", description="Scope: 'next' (single soonest per type for Home), 'week', 'month', or 'all'/'all_upcoming'"),
    user: dict = Depends(require_role("student")),
):
    """
    Return upcoming sessions for the logged-in student.
    
    Features:
    - If scope='next': returns only the SINGLE soonest upcoming session per session_type
      (at most 2 items: 1 study + 1 motivation) for the Home screen summary card.
    - If scope='week': limits to rolling 7-day window.
    - If scope='all' or 'all_upcoming': returns complete series for the Sessions page.
    - PRIVACY: Hides coach identity for motivation sessions at the schema level.
    """
    # 1. Update any expired sessions to completed status
    update_expired_sessions()

    now_utc = datetime.now(timezone.utc)

    # 2. Determine window cutoff based on scope parameter
    if scope == "week":
        upper_bound = now_utc + timedelta(days=7)
    elif scope == "month":
        upper_bound = now_utc + timedelta(days=30)
    else:
        upper_bound = None

    try:
        query = (
            supabase.table("sessions")
            .select("*")
            .eq("student_id", user["auth_id"])
            .eq("status", "upcoming")
            .gte("scheduled_at", now_utc.isoformat())
            .order("scheduled_at", desc=False)
        )

        if upper_bound:
            query = query.lte("scheduled_at", upper_bound.isoformat())

        response = query.execute()
        raw_sessions: List[Dict[str, Any]] = response.data or []

        # If scope == 'next', take only the single soonest study + single soonest motivation session
        if scope == "next":
            next_study = None
            next_moti = None
            for s in raw_sessions:
                stype = s.get("session_type") or "study"
                if stype == "study" and next_study is None:
                    next_study = s
                elif stype == "motivation" and next_moti is None:
                    next_moti = s
                if next_study and next_moti:
                    break
            picked = [s for s in [next_study, next_moti] if s is not None]
            picked.sort(key=lambda s: s.get("scheduled_at", ""))
            raw_sessions = picked

        # Collect coach IDs for 1:1 study sessions to resolve coach names
        coach_ids = [
            s.get("coach_id")
            for s in raw_sessions
            if (s.get("session_type") or "study") == "study" and s.get("coach_id")
        ]
        coach_names = get_user_name_lookup(coach_ids)

        # 3. Transform to privacy-preserving Pydantic items
        formatted_sessions: List[StudentSessionItem] = []
        for s in raw_sessions:
            stype = s.get("session_type") or "study"
            dt = parse_session_datetime(s["scheduled_at"])
            duration = int(s.get("duration_minutes") or 45)

            if stype == "motivation":
                # PRIVACY ENFORCEMENT: Coach identity fields are strictly absent
                item = StudentMotivationSessionResponse(
                    id=str(s["id"]),
                    scheduled_at=dt,
                    duration_minutes=duration,
                    zoom_link=s.get("zoom_link"),
                    status=s.get("status", "upcoming"),
                    session_type="motivation",
                    session_title=s.get("session_title") or "Evening Reflection Session",
                    recurrence_group_id=str(s["recurrence_group_id"]) if s.get("recurrence_group_id") else None,
                )
            else:
                # 1:1 Study session includes coach information
                cid = str(s.get("coach_id", ""))
                item = StudentStudySessionResponse(
                    id=str(s["id"]),
                    scheduled_at=dt,
                    duration_minutes=duration,
                    zoom_link=s.get("zoom_link"),
                    status=s.get("status", "upcoming"),
                    session_type="study",
                    session_title=s.get("session_title"),
                    topic=s.get("topic"),
                    coach_id=cid,
                    coach_name=coach_names.get(cid),
                )
            formatted_sessions.append(item)

        empty_message = None
        if not formatted_sessions:
            if scope == "week":
                empty_message = "No sessions this week. Your mentor will schedule your next one soon!"
            elif scope == "month":
                empty_message = "No sessions scheduled for this month yet. Check back soon!"
            else:
                empty_message = "You have no upcoming sessions scheduled."

        return StudentUpcomingResponse(
            sessions=formatted_sessions,
            message=empty_message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching upcoming sessions: {str(e)}",
        )


@router.get(
    "/sessions/completed",
    response_model=StudentCompletedResponse,
    summary="Get student completed session history",
    response_description="All historical completed sessions (ordered most recent first)",
)
async def get_completed_sessions(user: dict = Depends(require_role("student"))):
    """
    Return all completed sessions for the logged-in student.
    
    Features:
    - Runs status update before querying.
    - Ordered by scheduled_at descending (most recent first).
    - PRIVACY: Motivation sessions mask coach identity at the schema layer.
    """
    update_expired_sessions()

    try:
        response = (
            supabase.table("sessions")
            .select("*")
            .eq("student_id", user["auth_id"])
            .eq("status", "completed")
            .order("scheduled_at", desc=True)
            .execute()
        )

        raw_sessions: List[Dict[str, Any]] = response.data or []

        coach_ids = [
            s.get("coach_id")
            for s in raw_sessions
            if (s.get("session_type") or "study") == "study" and s.get("coach_id")
        ]
        coach_names = get_user_name_lookup(coach_ids)

        formatted_sessions: List[StudentSessionItem] = []
        for s in raw_sessions:
            stype = s.get("session_type") or "study"
            dt = parse_session_datetime(s["scheduled_at"])
            duration = int(s.get("duration_minutes") or 45)

            if stype == "motivation":
                item = StudentMotivationSessionResponse(
                    id=str(s["id"]),
                    scheduled_at=dt,
                    duration_minutes=duration,
                    zoom_link=s.get("zoom_link"),
                    status="completed",
                    session_type="motivation",
                    session_title=s.get("session_title") or "Evening Reflection Session",
                    recurrence_group_id=str(s["recurrence_group_id"]) if s.get("recurrence_group_id") else None,
                )
            else:
                cid = str(s.get("coach_id", ""))
                item = StudentStudySessionResponse(
                    id=str(s["id"]),
                    scheduled_at=dt,
                    duration_minutes=duration,
                    zoom_link=s.get("zoom_link"),
                    status="completed",
                    session_type="study",
                    session_title=s.get("session_title"),
                    topic=s.get("topic"),
                    coach_id=cid,
                    coach_name=coach_names.get(cid),
                )
            formatted_sessions.append(item)

        return StudentCompletedResponse(sessions=formatted_sessions)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching completed sessions: {str(e)}",
        )


@router.get(
    "/progress",
    response_model=ProgressResponse,
    summary="Get student all-time session progress and streak",
    response_description="All-time session counts and consecutive completed attendance streak",
)
async def get_student_progress_metrics(user: dict = Depends(require_role("student"))):
    """
    Return all-time session metrics and attendance streak for the logged-in student.
    
    Includes:
    - completed_study_sessions
    - completed_motivation_sessions
    - upcoming_study_sessions
    - upcoming_motivation_sessions
    - current_streak (consecutive completed sessions without a missed/cancelled session)
    """
    try:
        metrics = get_student_progress(user["auth_id"])
        return ProgressResponse(**metrics)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating progress: {str(e)}",
        )
