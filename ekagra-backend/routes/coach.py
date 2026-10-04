"""
Coach Routes for Ekagra Platform.

Endpoints:
- GET  /coach/profile: Profile information for authenticated coach.
- GET  /coach/students: List all active students for session scheduling.
- POST /coach/sessions/book-study: Book an individual 1:1 study session.
- POST /coach/sessions/book-motivation-series: Start a recurring series (fixed-length or ongoing) with rotating mentors.
- GET  /coach/series: List series this mentor belongs to.
- POST /coach/series/{series_id}/pause|resume|end: Manage an ongoing series.
- GET  /coach/sessions/upcoming: Rolling weekly upcoming sessions assigned to this coach.
- GET  /coach/sessions/completed: Historical completed sessions assigned to this coach.
- GET  /coach/progress: All-time session metrics and attendance streak.
- POST /coach/sessions/{session_id}/cancel: Cancel an upcoming session (frees slot).
- POST /coach/sessions/{session_id}/reschedule: Reschedule a session to a new time window.

COACH ROTATION DEMONSTRATION (PART 4):
When booking a 6-session series with coach_ids = [Coach_A, Coach_B, Coach_C]:
- Session 1 (Day 0): Coach_A (0 % 3 = 0)
- Session 2 (Day 2): Coach_B (1 % 3 = 1)
- Session 3 (Day 4): Coach_C (2 % 3 = 2)
- Session 4 (Day 6): Coach_A (3 % 3 = 0)
- Session 5 (Day 8): Coach_B (4 % 3 = 1)
- Session 6 (Day 10): Coach_C (5 % 3 = 2)
Each session row in the database explicitly stores its assigned coach_id.
Thus, when Coach A queries /coach/sessions/upcoming, they naturally receive ONLY sessions 1 and 4.
"""

from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, List, Dict, Any, Literal
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from middleware.auth_middleware import require_role
from database import supabase
from services.zoom_service import generate_zoom_link
from services.scheduling_service import (
    check_time_conflict,
    check_both_parties_conflict,
    parse_session_datetime,
    normalize_to_utc,
    format_datetime_for_display,
)
from services.session_service import (
    update_expired_sessions,
    get_coach_progress,
    validate_user_role,
    get_user_name_lookup,
    get_student_availability,
)
from services.notification_service import create_notification
from services.series_service import (
    occurrence,
    plan_window,
    find_conflict,
    build_session_row,
    set_series_status,
)
from schemas.session import (
    BookStudySessionRequest,
    BookMotivationSeriesRequest,
    RescheduleSessionRequest,
    CoachSessionResponse,
    CoachUpcomingResponse,
    CoachCompletedResponse,
    MotivationSeriesResponse,
    SeriesResponse,
    ProgressResponse,
    StudentUserResponse,
    BookedTimeSlot,
)

router = APIRouter(prefix="/coach", tags=["Coach"])


# ── PROFILE & STUDENT SELECTION (PART 9) ──────────────────────────────────────

@router.get(
    "/profile",
    summary="Get coach profile",
    response_description="Profile details for authenticated coach",
)
async def get_coach_profile(user: dict = Depends(require_role("coach"))):
    """
    Return the logged-in coach's profile from the `users` table.
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
                detail="Mentor profile not found.",
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
    "/students",
    response_model=List[StudentUserResponse],
    summary="List all students available for coaching",
    response_description="Array of registered students with ID, name, and email",
)
async def list_available_students(user: dict = Depends(require_role("coach"))):
    """
    Return list of all registered users with role='student'.
    Used by coaches to select which student to book a study session or motivation series for.
    """
    try:
        response = (
            supabase.table("users")
            .select("id, name, email, avatar_url")
            .eq("role", "student")
            .order("name", desc=False)
            .execute()
        )
        print(f"============================================================")
        print(f"[DEBUG GET /coach/students] Authenticated coach: {user.get('email')} (id: {user.get('id')})")
        print(f"[DEBUG GET /coach/students] Supabase Authorization header: {supabase.postgrest.headers.get('Authorization', '')[:35]}...")
        print(f"[DEBUG GET /coach/students] Raw Supabase query response.data: {response.data}")
        print(f"[DEBUG GET /coach/students] Count of students returned: {len(response.data) if response.data else 0}")
        print(f"============================================================")
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving students: {str(e)}",
        )


@router.get(
    "/students/{student_id}/availability",
    response_model=List[BookedTimeSlot],
    summary="Get booked time slots for a student in a specific month",
    response_description="Array of booked time slots (scheduled_at, duration_minutes, status, etc.) for that student",
)
async def get_student_monthly_availability_route(
    student_id: str,
    month: Optional[str] = Query(
        None,
        description="Month in YYYY-MM format (e.g. 2026-09). Defaults to current month.",
        pattern=r"^\d{4}-(?:0[1-9]|1[0-2])$",
    ),
    user: dict = Depends(require_role("coach")),
):
    """
    Return all booked session slots for the given student within the specified month.
    Used by coaches to view the student's busy vs. available times in the availability calendar.
    """
    return get_student_availability(student_id=student_id, month_str=month)



@router.get(
    "/coaches",
    response_model=List[StudentUserResponse],
    summary="List all coaches available for rotation",
    response_description="Array of registered coaches with ID, name, and email",
)
async def list_available_coaches(user: dict = Depends(require_role("coach"))):
    """
    Return list of all registered users with role='coach'.
    Used by coaches when selecting multiple rotating coaches for a motivation series.
    """
    try:
        response = (
            supabase.table("users")
            .select("*")
            .eq("role", "coach")
            .order("name", desc=False)
            .execute()
        )
        # Deactivated mentors can't be added to a rotation
        return [
            {"id": r["id"], "name": r.get("name"), "email": r.get("email")}
            for r in (response.data or [])
            if r.get("is_active", True) is not False
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving mentors: {str(e)}",
        )


# ── STUDY SESSION BOOKING (PART 3) ────────────────────────────────────────────

@router.post(
    "/sessions/book-study",
    response_model=CoachSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an individual 1:1 study session",
    response_description="Created 1:1 study session details",
)
async def book_study_session(
    payload: BookStudySessionRequest,
    user: dict = Depends(require_role("coach")),
):
    """
    Book a 1:1 study session for a specific student.

    Production safeguards:
    - Validates student existence and 'student' role.
    - Authenticated coach ID is automatically assigned as coach_id (anti-spoofing).
    - Validates scheduled_at is at least 30 minutes in the future.
    - Pre-validates interval overlaps for both student and coach via check_both_parties_conflict.
    - Catches race-condition database unique constraint violations gracefully with HTTP 409.
    """
    coach_id = user["auth_id"]

    # 1. Verify student exists and has 'student' role
    student_user = validate_user_role(payload.student_id, expected_role="student")

    # 2. Check for time conflicts for both student and coach
    has_conflict, party, conflict_session = check_both_parties_conflict(
        student_id=payload.student_id,
        coach_id=coach_id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
    )
    if has_conflict:
        if party == "student":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The student '{student_user.get('name', 'Student')}' already has a conflicting session scheduled during this time window.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The mentor already has a conflicting session scheduled during this time window.",
            )

    # 3. Generate Zoom link via zoom_service
    session_id_placeholder = str(uuid.uuid4())
    zoom_link = generate_zoom_link({
        "session_id": session_id_placeholder,
        "student_id": payload.student_id,
        "coach_id": coach_id,
        "scheduled_at": payload.scheduled_at.isoformat(),
    })

    # 4. Insert new study session with graceful unique constraint handling
    session_record = {
        "id": session_id_placeholder,
        "student_id": payload.student_id,
        "coach_id": coach_id,
        "scheduled_at": payload.scheduled_at.isoformat(),
        "duration_minutes": payload.duration_minutes,
        "topic": payload.topic,
        "session_title": payload.session_title or (f"1:1 Study: {payload.topic}" if payload.topic else "1:1 Study Session"),
        "session_type": "study",
        "zoom_link": zoom_link,
        "status": "upcoming",
    }

    try:
        res = supabase.table("sessions").insert(session_record).execute()
        created = res.data[0] if res.data else session_record

        # Dispatch in-app notifications
        try:
            formatted_time = format_datetime_for_display(created["scheduled_at"])
            create_notification(
                user_id=str(created["student_id"]),
                message=f"New 1:1 Study Session scheduled with Mentor {user.get('name', 'Mentor')} on {formatted_time}."
            )
            create_notification(
                user_id=coach_id,
                message=f"You scheduled a 1:1 Study Session with {student_user.get('name', 'Student')} on {formatted_time}."
            )
        except Exception:
            pass
    except Exception as e:
        err_msg = str(e).lower()
        if "23505" in err_msg or "unique" in err_msg or "duplicate key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A scheduling conflict occurred due to a concurrent booking. Please choose a different time.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}",
        )

    return CoachSessionResponse(
        id=str(created["id"]),
        student_id=str(created["student_id"]),
        student_name=student_user.get("name"),
        coach_id=str(created["coach_id"]),
        coach_name=user.get("name"),
        scheduled_at=parse_session_datetime(created["scheduled_at"]),
        duration_minutes=int(created.get("duration_minutes") or 45),
        zoom_link=created.get("zoom_link"),
        status=created.get("status", "upcoming"),
        session_type=created.get("session_type", "study"),
        session_title=created.get("session_title"),
        topic=created.get("topic"),
        recurrence_group_id=created.get("recurrence_group_id"),
    )


# ── RECURRING MOTIVATION SERIES BOOKING (PART 4) ──────────────────────────────

@router.post(
    "/sessions/book-motivation-series",
    response_model=MotivationSeriesResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an atomic recurring motivation series with coach rotation",
    response_description="Created motivation series details and assigned schedule",
)
async def book_motivation_series(
    payload: BookMotivationSeriesRequest,
    user: dict = Depends(require_role("coach")),
):
    """
    Book a multi-session recurring motivation series with coach rotation on alternate days.

    Key Production Guarantees:
    - Atomicity: Pre-validates time conflicts for every single session in the series across
      the student and all assigned coaches. If ANY date has a conflict, the entire request
      is rejected with 409 without creating any orphan sessions.
    - Security: The requesting coach MUST be present in coach_ids.
    - Zoom Link: Generates ONE Zoom link upfront and shares it across all series sessions.
    - Recurrence Group: All sessions share the same recurrence_group_id UUID.
    - Rotation: Coach IDs rotate in round-robin fashion (0, 1, 2, 0, 1, 2...).
      Each database row explicitly stores its assigned coach_id, ensuring each coach's
      upcoming view only shows sessions assigned to them.
    """
    requesting_coach_id = user["auth_id"]

    # 1. Validate requesting coach is part of the rotating team
    if requesting_coach_id not in payload.coach_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="As the scheduling mentor, you must include yourself in the mentor rotation list.",
        )

    # 2. Validate student exists
    student_user = validate_user_role(payload.student_id, expected_role="student")

    # 3. Validate all coaches in the rotation exist and have role='coach'
    coach_names: Dict[str, str] = {}
    for cid in payload.coach_ids:
        coach_user = validate_user_role(cid, expected_role="coach")
        coach_names[cid] = coach_user.get("name", "Coach")

    # 4. Build the series rule. time_of_day is IST wall-clock time.
    series_id = str(uuid.uuid4())
    time_parts = [int(p) for p in payload.time_of_day.split(":")[:2]]
    series_rule: Dict[str, Any] = {
        "id": series_id,
        "student_id": payload.student_id,
        "created_by": requesting_coach_id,
        "coach_ids": payload.coach_ids,
        "session_title": payload.session_title,
        "time_of_day": f"{time_parts[0]:02d}:{time_parts[1]:02d}",
        "start_date": payload.start_date.isoformat(),
        "interval_days": 2,  # alternate days
        "duration_minutes": payload.duration_minutes,
        "max_sessions": payload.number_of_sessions,  # None = ongoing
        "status": "active",
        "next_index": 0,
    }

    # 5. The first session must be at least 30 minutes in the future
    now_utc = datetime.now(timezone.utc)
    if occurrence(series_rule, 0)[1] < now_utc + timedelta(minutes=29, seconds=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The first session of the series must be scheduled at least 30 minutes in the future.",
        )

    # Only the rolling window (next ~2 weeks) is booked now; the periodic
    # top-up job keeps extending it. Rotation is round-robin by occurrence index.
    planned_sessions, next_index = plan_window(series_rule, now_utc)
    series_rule["next_index"] = next_index

    # 6. ATOMIC PRE-CHECK: on initial booking any clash rejects the whole series
    for idx, dt, cid in planned_sessions:
        clash = find_conflict(series_rule, (idx, dt, cid))
        if clash == "student":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Student has a scheduling conflict on session #{idx+1} "
                    f"({format_datetime_for_display(dt)} IST). "
                    f"No sessions were created."
                ),
            )
        if clash == "mentor":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Mentor '{coach_names.get(cid, cid)}' has a scheduling conflict on session #{idx+1} "
                    f"({format_datetime_for_display(dt)} IST). "
                    f"No sessions were created."
                ),
            )

    # 7. Generate ONE shared Zoom link for the entire series
    series_rule["zoom_link"] = generate_zoom_link({
        "session_id": series_id,
        "student_id": payload.student_id,
        "series_title": payload.session_title,
        "scheduled_at": planned_sessions[0][1].isoformat(),
    })

    # 8. Save the rule, then the first window of sessions
    try:
        supabase.table("series").insert(series_rule).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save the series (has migrations/002_ongoing_series.sql been run?): {str(e)}",
        )

    batch_records = [build_session_row(series_rule, occ) for occ in planned_sessions]
    try:
        insert_res = supabase.table("sessions").insert(batch_records).execute()
        created_rows = insert_res.data or batch_records
    except Exception as e:
        # Keep it atomic: drop the rule if its sessions could not be created
        try:
            supabase.table("series").delete().eq("id", series_id).execute()
        except Exception:
            pass
        err_msg = str(e).lower()
        if "23505" in err_msg or "unique" in err_msg or "duplicate key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A scheduling conflict occurred due to a concurrent booking. The series was not created.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during series creation: {str(e)}",
        )

    # 9. In-app notifications
    ongoing = payload.number_of_sessions is None
    length_text = "an ongoing" if ongoing else f"a {payload.number_of_sessions}-session"
    try:
        create_notification(
            user_id=payload.student_id,
            message=f"You have been enrolled in {length_text} reflection series '{payload.session_title}' starting {payload.start_date}."
        )
        for cid in payload.coach_ids:
            create_notification(
                user_id=cid,
                message=f"You are assigned to the mentor team for '{payload.session_title}' with student {student_user.get('name', 'Student')}."
            )
    except Exception:
        pass

    # 10. Format and return response
    created_responses: List[CoachSessionResponse] = []
    for row in created_rows:
        row_cid = str(row["coach_id"])
        created_responses.append(
            CoachSessionResponse(
                id=str(row["id"]),
                student_id=str(row["student_id"]),
                student_name=student_user.get("name"),
                coach_id=row_cid,
                coach_name=coach_names.get(row_cid),
                scheduled_at=parse_session_datetime(row["scheduled_at"]),
                duration_minutes=int(row.get("duration_minutes") or 45),
                zoom_link=row.get("zoom_link"),
                status=row.get("status", "upcoming"),
                session_type="motivation",
                session_title=row.get("session_title"),
                topic=row.get("topic"),
                recurrence_group_id=str(row["recurrence_group_id"]),
            )
        )

    if ongoing:
        message = (
            f"Ongoing series created. The next {len(created_responses)} sessions are booked; "
            f"more are added automatically every day."
        )
    else:
        message = f"Successfully scheduled {len(created_responses)} recurring motivation sessions with mentor rotation."

    return MotivationSeriesResponse(
        message=message,
        recurrence_group_id=series_id,
        session_title=payload.session_title,
        zoom_link=series_rule["zoom_link"],
        total_sessions=len(created_responses),
        ongoing=ongoing,
        sessions=created_responses,
    )


# ── SERIES MANAGEMENT (ONGOING SERIES) ────────────────────────────────────────

def _load_series_for_mentor(series_id: str, mentor_id: str) -> Dict[str, Any]:
    """Fetch a series and make sure the mentor is part of its rotation."""
    res = supabase.table("series").select("*").eq("id", series_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")
    series = res.data[0]
    if mentor_id not in [str(c) for c in series.get("coach_ids") or []]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this series' mentor rotation.",
        )
    return series


def _series_to_response(series: Dict[str, Any], names: Dict[str, str]) -> SeriesResponse:
    next_at = None
    try:
        nxt = (
            supabase.table("sessions")
            .select("scheduled_at")
            .eq("recurrence_group_id", series["id"])
            .eq("status", "upcoming")
            .order("scheduled_at")
            .limit(1)
            .execute()
        )
        if nxt.data:
            next_at = parse_session_datetime(nxt.data[0]["scheduled_at"])
    except Exception:
        pass

    return SeriesResponse(
        id=str(series["id"]),
        student_id=str(series["student_id"]),
        student_name=names.get(str(series["student_id"])),
        session_title=series["session_title"],
        time_of_day=str(series["time_of_day"])[:5],
        interval_days=int(series["interval_days"]),
        duration_minutes=int(series["duration_minutes"]),
        start_date=series["start_date"],
        max_sessions=series.get("max_sessions"),
        status=series["status"],
        mentor_names=[names.get(str(c), "Mentor") for c in series.get("coach_ids") or []],
        next_session_at=next_at,
    )


@router.get(
    "/series",
    response_model=List[SeriesResponse],
    summary="List motivation series this mentor is part of",
)
async def list_series(user: dict = Depends(require_role("coach"))):
    try:
        rows = (
            supabase.table("series")
            .select("*")
            .contains("coach_ids", [user["auth_id"]])
            .neq("status", "ended")
            .order("created_at", desc=True)
            .execute()
        ).data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching series: {str(e)}",
        )

    ids = {str(r["student_id"]) for r in rows}
    for r in rows:
        ids.update(str(c) for c in r.get("coach_ids") or [])
    names = get_user_name_lookup(list(ids)) if ids else {}
    return [_series_to_response(r, names) for r in rows]


# action -> (new status, statuses it can be applied from, wording for the student)
_SERIES_ACTIONS = {
    "pause": ("paused", {"active"}, "has been paused"),
    "resume": ("active", {"paused"}, "has been resumed"),
    "end": ("ended", {"active", "paused"}, "has ended"),
}


@router.post(
    "/series/{series_id}/{action}",
    response_model=SeriesResponse,
    summary="Pause, resume or end a motivation series",
)
async def change_series_status(
    series_id: str,
    action: Literal["pause", "resume", "end"],
    user: dict = Depends(require_role("coach")),
):
    series = _load_series_for_mentor(series_id, user["auth_id"])
    new_status, allowed_from, wording = _SERIES_ACTIONS[action]
    if series["status"] not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {action} a series that is {series['status']}.",
        )

    try:
        updated = set_series_status(series, new_status)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update series: {str(e)}",
        )

    try:
        create_notification(
            user_id=str(series["student_id"]),
            message=f"Your reflection series '{series['session_title']}' {wording}.",
        )
    except Exception:
        pass

    ids = [str(series["student_id"])] + [str(c) for c in series.get("coach_ids") or []]
    return _series_to_response(updated, get_user_name_lookup(ids))


# ── COACH SESSION RETRIEVAL (PART 6) ──────────────────────────────────────────

@router.get(
    "/sessions/upcoming",
    response_model=CoachUpcomingResponse,
    summary="Get upcoming sessions assigned to the authenticated coach",
    response_description="Upcoming sessions for this coach within rolling window",
)
async def get_upcoming_sessions(
    scope: str = Query("all", pattern="^(next|week|month|all|all_upcoming)$", description="Scope: 'next' (single soonest per type for Home), 'week', 'month', or 'all'/'all_upcoming'"),
    user: dict = Depends(require_role("coach")),
):
    """
    Return all upcoming sessions where this coach is assigned.
    
    Features:
    - If scope='next': returns only the SINGLE soonest upcoming session per session_type
      (at most 2 items: 1 study + 1 motivation) for the Home screen summary card.
    - If scope='week': limits to rolling 7-day window.
    - If scope='all' or 'all_upcoming': returns complete series for the Sessions page.
    """
    update_expired_sessions()

    coach_id = user["auth_id"]
    now_utc = datetime.now(timezone.utc)

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
            .eq("coach_id", coach_id)
            .eq("status", "upcoming")
            .gte("scheduled_at", now_utc.isoformat())
            .order("scheduled_at", desc=False)
        )

        if upper_bound:
            query = query.lte("scheduled_at", upper_bound.isoformat())

        res = query.execute()
        raw_sessions: List[Dict[str, Any]] = res.data or []

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

        student_ids = [s.get("student_id") for s in raw_sessions if s.get("student_id")]
        student_names = get_user_name_lookup(student_ids)

        formatted_sessions: List[CoachSessionResponse] = []
        for s in raw_sessions:
            sid = str(s.get("student_id", ""))
            formatted_sessions.append(
                CoachSessionResponse(
                    id=str(s["id"]),
                    student_id=sid,
                    student_name=student_names.get(sid),
                    coach_id=coach_id,
                    coach_name=user.get("name"),
                    scheduled_at=parse_session_datetime(s["scheduled_at"]),
                    duration_minutes=int(s.get("duration_minutes") or 45),
                    zoom_link=s.get("zoom_link"),
                    status=s.get("status", "upcoming"),
                    session_type=s.get("session_type") or "study",
                    session_title=s.get("session_title"),
                    topic=s.get("topic"),
                    recurrence_group_id=str(s["recurrence_group_id"]) if s.get("recurrence_group_id") else None,
                )
            )

        empty_message = None
        if not formatted_sessions:
            if scope == "week":
                empty_message = "No sessions this week. You have no upcoming scheduled sessions in this window."
            elif scope == "month":
                empty_message = "No sessions scheduled for this month yet."
            else:
                empty_message = "You have no upcoming scheduled sessions."

        return CoachUpcomingResponse(
            sessions=formatted_sessions,
            message=empty_message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching mentor upcoming sessions: {str(e)}",
        )


@router.get(
    "/sessions/completed",
    response_model=CoachCompletedResponse,
    summary="Get completed sessions history for the coach",
    response_description="All historical completed sessions assigned to this coach",
)
async def get_completed_sessions(user: dict = Depends(require_role("coach"))):
    """
    Return all completed sessions conducted by the logged-in coach,
    ordered by scheduled_at descending (most recent first).
    """
    update_expired_sessions()

    coach_id = user["auth_id"]

    try:
        res = (
            supabase.table("sessions")
            .select("*")
            .eq("coach_id", coach_id)
            .eq("status", "completed")
            .order("scheduled_at", desc=True)
            .execute()
        )
        raw_sessions: List[Dict[str, Any]] = res.data or []

        student_ids = [s.get("student_id") for s in raw_sessions if s.get("student_id")]
        student_names = get_user_name_lookup(student_ids)

        formatted_sessions: List[CoachSessionResponse] = []
        for s in raw_sessions:
            sid = str(s.get("student_id", ""))
            formatted_sessions.append(
                CoachSessionResponse(
                    id=str(s["id"]),
                    student_id=sid,
                    student_name=student_names.get(sid),
                    coach_id=coach_id,
                    coach_name=user.get("name"),
                    scheduled_at=parse_session_datetime(s["scheduled_at"]),
                    duration_minutes=int(s.get("duration_minutes") or 45),
                    zoom_link=s.get("zoom_link"),
                    status="completed",
                    session_type=s.get("session_type") or "study",
                    session_title=s.get("session_title"),
                    topic=s.get("topic"),
                    recurrence_group_id=str(s["recurrence_group_id"]) if s.get("recurrence_group_id") else None,
                )
            )

        return CoachCompletedResponse(sessions=formatted_sessions)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching completed sessions: {str(e)}",
        )


@router.get(
    "/progress",
    response_model=ProgressResponse,
    summary="Get coach all-time session progress and streak",
    response_description="All-time session metrics and consecutive completed streak for this coach",
)
async def get_coach_progress_metrics(user: dict = Depends(require_role("coach"))):
    """
    Return all-time session analytics and streak count for the authenticated coach.
    """
    try:
        metrics = get_coach_progress(user["auth_id"])
        return ProgressResponse(**metrics)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating mentor progress: {str(e)}",
        )


# ── SESSION LIFECYCLE MANAGEMENT (PART 10) ────────────────────────────────────

@router.post(
    "/sessions/{session_id}/cancel",
    summary="Cancel a scheduled session",
    response_description="Confirmation of session cancellation",
)
async def cancel_session(
    session_id: str,
    user: dict = Depends(require_role("coach")),
):
    """
    Cancel an upcoming session and free up the slot for future bookings.
    
    Security: Verifies that the requesting coach owns/is assigned to the session.
    """
    coach_id = user["auth_id"]

    try:
        # 1. Fetch session
        res = (
            supabase.table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = res.data
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    # 2. Ownership check: Must be the assigned coach
    if str(session.get("coach_id")) != coach_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to cancel this session as you are not the assigned mentor.",
        )

    # 3. Check current status
    if session.get("status") == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is already cancelled.",
        )

    if session.get("status") == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a session that has already been completed.",
        )

    # 4. Update status to 'cancelled'
    try:
        supabase.table("sessions").update({"status": "cancelled"}).eq("id", session_id).select().execute()

        # Dispatch notifications
        try:
            formatted_time = format_datetime_for_display(session["scheduled_at"])
            title = session.get("session_title") or session.get("topic") or "Session"
            create_notification(
                user_id=str(session.get("student_id")),
                message=f"Your session '{title}' scheduled for {formatted_time} was cancelled by your mentor."
            )
            create_notification(
                user_id=coach_id,
                message=f"You cancelled the session '{title}' scheduled on {formatted_time}."
            )
        except Exception:
            pass

        return {
            "message": "Session has been successfully cancelled and slot is freed.",
            "session_id": session_id,
            "status": "cancelled",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel session: {str(e)}",
        )


@router.post(
    "/sessions/{session_id}/reschedule",
    response_model=CoachSessionResponse,
    summary="Reschedule a session to a new time window",
    response_description="Updated session details with new scheduled time",
)
async def reschedule_session(
    session_id: str,
    payload: RescheduleSessionRequest,
    user: dict = Depends(require_role("coach")),
):
    """
    Reschedule an existing upcoming session.

    Security & Validation:
    - Coach must be the assigned coach for this session.
    - Session cannot be cancelled or completed.
    - New scheduled_at must be at least 30 minutes in the future.
    - Re-evaluates check_both_parties_conflict for the new time window,
      excluding this session's current slot from causing a self-conflict.
    """
    coach_id = user["auth_id"]

    try:
        res = (
            supabase.table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = res.data
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    # Ownership check
    if str(session.get("coach_id")) != coach_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reschedule this session as you are not the assigned mentor.",
        )

    if session.get("status") in ("cancelled", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reschedule a session with status '{session.get('status')}'.",
        )

    duration = payload.new_duration_minutes or int(session.get("duration_minutes") or 45)

    # Conflict check for new slot, excluding the current session itself
    has_conflict, party, conflict_session = check_both_parties_conflict(
        student_id=str(session["student_id"]),
        coach_id=coach_id,
        scheduled_at=payload.new_scheduled_at,
        duration_minutes=duration,
        exclude_session_id=session_id,
    )
    if has_conflict:
        if party == "student":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The student already has an overlapping session scheduled during the requested new time slot.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The mentor already has an overlapping session scheduled during the requested new time slot.",
            )

    update_payload = {
        "scheduled_at": payload.new_scheduled_at.isoformat(),
        "duration_minutes": duration,
    }

    try:
        up_res = supabase.table("sessions").update(update_payload).eq("id", session_id).select().execute()
        updated = up_res.data[0] if up_res.data else {**session, **update_payload}

        # Dispatch notifications
        try:
            new_time_str = format_datetime_for_display(payload.new_scheduled_at)
            title = session.get("session_title") or session.get("topic") or "Session"
            create_notification(
                user_id=str(session.get("student_id")),
                message=f"Your session '{title}' has been rescheduled to {new_time_str}."
            )
            create_notification(
                user_id=coach_id,
                message=f"You rescheduled the session '{title}' with student to {new_time_str}."
            )
        except Exception:
            pass
    except Exception as e:
        err_msg = str(e).lower()
        if "23505" in err_msg or "unique" in err_msg or "duplicate key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A scheduling conflict occurred due to a concurrent booking. Please choose a different time.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reschedule session: {str(e)}",
        )

    # Fetch student name for response
    student_lookup = get_user_name_lookup([str(updated["student_id"])])

    return CoachSessionResponse(
        id=str(updated["id"]),
        student_id=str(updated["student_id"]),
        student_name=student_lookup.get(str(updated["student_id"])),
        coach_id=coach_id,
        coach_name=user.get("name"),
        scheduled_at=parse_session_datetime(updated["scheduled_at"]),
        duration_minutes=int(updated.get("duration_minutes") or 45),
        zoom_link=updated.get("zoom_link"),
        status=updated.get("status", "upcoming"),
        session_type=updated.get("session_type") or "study",
        session_title=updated.get("session_title"),
        topic=updated.get("topic"),
        recurrence_group_id=str(updated["recurrence_group_id"]) if updated.get("recurrence_group_id") else None,
    )
