"""
Series Service — Ongoing (rolling-window) motivation series.

A row in the `series` table is the recurrence RULE:
    "every <interval_days> days at <time_of_day> IST, starting <start_date>,
     rotating through <coach_ids>, optionally stopping after <max_sessions>".

Concrete `sessions` rows are only created for the next SERIES_WINDOW_DAYS.
`top_up_all_active_series()` runs periodically (see main.py) and extends every
active series so there are always ~2 weeks of sessions booked ahead.

Occurrence #i is fully determined by the rule:
    date   = start_date + i * interval_days   (IST)
    mentor = coach_ids[i % len(coach_ids)]
so rotation stays consistent across pauses, resumes and server restarts.
`next_index` records the next occurrence that has not been processed yet.
"""

import math
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from database import supabase
from services.scheduling_service import (
    IST_TIMEZONE,
    check_time_conflict,
    format_datetime_for_display,
)
from services.notification_service import create_notification


SERIES_WINDOW_DAYS = 14
# Matches the 30-minute minimum lead time enforced for manual bookings
MIN_LEAD_TIME = timedelta(minutes=30)

# (occurrence index, UTC start time, assigned mentor id)
Occurrence = Tuple[int, datetime, str]


# ── Occurrence math ───────────────────────────────────────────────────────────

def _as_date(val: Any) -> date:
    return val if isinstance(val, date) else date.fromisoformat(str(val))


def _as_time(val: Any) -> time:
    if isinstance(val, time):
        return val
    parts = [int(p) for p in str(val).split(":")[:2]]
    return time(hour=parts[0], minute=parts[1])


def occurrence(series: Dict[str, Any], index: int) -> Occurrence:
    """Return (index, UTC start, mentor id) for occurrence #index of a series."""
    session_date = _as_date(series["start_date"]) + timedelta(days=index * int(series["interval_days"]))
    start_utc = datetime.combine(
        session_date, _as_time(series["time_of_day"]), tzinfo=IST_TIMEZONE
    ).astimezone(timezone.utc)
    coach_ids = series["coach_ids"]
    return index, start_utc, str(coach_ids[index % len(coach_ids)])


def first_bookable_index(series: Dict[str, Any], now: Optional[datetime] = None) -> int:
    """Smallest occurrence index that is at least MIN_LEAD_TIME in the future."""
    now = now or datetime.now(timezone.utc)
    earliest = now + MIN_LEAD_TIME
    _, first_start, _ = occurrence(series, 0)
    if first_start >= earliest:
        return 0
    step = timedelta(days=int(series["interval_days"]))
    index = math.ceil((earliest - first_start) / step)
    # Guard against rounding at the boundary
    while occurrence(series, index)[1] < earliest:
        index += 1
    return index


def plan_window(series: Dict[str, Any], now: Optional[datetime] = None) -> Tuple[List[Occurrence], int]:
    """
    List the occurrences from series.next_index that fall inside the rolling
    window, skipping any that are already too close / in the past.

    Returns (occurrences, new_next_index).
    """
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(days=SERIES_WINDOW_DAYS)
    max_sessions = series.get("max_sessions")

    index = max(int(series.get("next_index") or 0), first_bookable_index(series, now))
    planned: List[Occurrence] = []
    while max_sessions is None or index < int(max_sessions):
        occ = occurrence(series, index)
        if occ[1] > horizon:
            break
        planned.append(occ)
        index += 1
    return planned, index


def build_session_row(series: Dict[str, Any], occ: Occurrence) -> Dict[str, Any]:
    _, start_utc, coach_id = occ
    return {
        "id": str(uuid.uuid4()),
        "student_id": series["student_id"],
        "coach_id": coach_id,
        "scheduled_at": start_utc.isoformat(),
        "duration_minutes": int(series["duration_minutes"]),
        "recurrence_group_id": series["id"],
        "session_title": series["session_title"],
        "session_type": "motivation",
        "zoom_link": series.get("zoom_link"),
        "status": "upcoming",
    }


def find_conflict(series: Dict[str, Any], occ: Occurrence) -> Optional[str]:
    """Return 'student' / 'mentor' if that party is busy for this occurrence, else None."""
    _, start_utc, coach_id = occ
    duration = int(series["duration_minutes"])
    if check_time_conflict(series["student_id"], "student", start_utc, duration):
        return "student"
    if check_time_conflict(coach_id, "coach", start_utc, duration):
        return "mentor"
    return None


# ── Rolling top-up (runs periodically) ────────────────────────────────────────

def get_inactive_mentor_ids() -> Set[str]:
    try:
        rows = supabase.table("users").select("*").eq("role", "coach").execute().data or []
    except Exception:
        return set()
    return {str(r["id"]) for r in rows if r.get("is_active", True) is False}


def top_up_series(
    series: Dict[str, Any],
    now: Optional[datetime] = None,
    inactive_mentor_ids: Optional[Set[str]] = None,
) -> int:
    """
    Book any missing sessions for one active series inside the rolling window.

    Unlike the initial booking, a clash here does NOT stop the series: that one
    date is skipped and the mentors are notified. Returns sessions created.
    """
    planned, new_next_index = plan_window(series, now)
    if inactive_mentor_ids is None:
        inactive_mentor_ids = get_inactive_mentor_ids()
    created = 0

    for occ in planned:
        if occ[2] in inactive_mentor_ids:
            clash = "assigned mentor is deactivated"
        else:
            clash = find_conflict(series, occ)
        if clash is None:
            try:
                supabase.table("sessions").insert(build_session_row(series, occ)).execute()
                created += 1
                continue
            except Exception as e:
                # Most likely a concurrent booking hitting the unique slot index
                print(f"[series {series['id']}] insert failed for occurrence {occ[0]}: {e}")
                clash = "slot"

        when = format_datetime_for_display(occ[1])
        message = (
            f"Series '{series['session_title']}': the session on {when} IST was skipped "
            f"because of a scheduling clash ({clash}). The series continues as normal."
        )
        recipients = {occ[2], str(series["created_by"])} - inactive_mentor_ids
        for user_id in recipients:
            create_notification(user_id=user_id, message=message)

    if new_next_index != int(series.get("next_index") or 0):
        supabase.table("series").update({
            "next_index": new_next_index,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", series["id"]).execute()

    return created


def top_up_all_active_series() -> int:
    """Extend every active series. Safe to run repeatedly. Returns sessions created."""
    if supabase is None:
        return 0
    try:
        rows = supabase.table("series").select("*").eq("status", "active").execute().data or []
    except Exception as e:
        print(f"Warning: could not load series for top-up: {e}")
        return 0

    inactive = get_inactive_mentor_ids()
    total = 0
    for series in rows:
        try:
            total += top_up_series(series, inactive_mentor_ids=inactive)
        except Exception as e:
            print(f"Warning: top-up failed for series {series.get('id')}: {e}")
    return total


# ── Pause / resume / end ──────────────────────────────────────────────────────

def delete_future_sessions(series_id: str) -> int:
    """
    Remove not-yet-started sessions of a series. They are deleted (not marked
    cancelled) so that pausing/ending a series does not break the student's streak.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        supabase.table("sessions")
        .delete()
        .eq("recurrence_group_id", series_id)
        .eq("status", "upcoming")
        .gt("scheduled_at", now_iso)
        .execute()
    )
    return len(res.data or [])


def set_series_status(series: Dict[str, Any], new_status: str) -> Dict[str, Any]:
    """Apply pause / resume / end to a series and return the updated row."""
    now = datetime.now(timezone.utc)
    update: Dict[str, Any] = {"status": new_status, "updated_at": now.isoformat()}

    if new_status in ("paused", "ended"):
        delete_future_sessions(series["id"])
        # Rewind so a later resume regenerates from the first future date
        update["next_index"] = first_bookable_index(series, now)
    elif new_status == "active":
        update["next_index"] = first_bookable_index(series, now)

    res = supabase.table("series").update(update).eq("id", series["id"]).execute()
    updated = (res.data or [{**series, **update}])[0]

    if new_status == "active":
        top_up_series(updated, now)
    return updated
