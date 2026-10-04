"""
Chat Service — Ekagra assistant (students & mentors).

PRIVACY MODEL (the important part)
----------------------------------
The AI model is never trusted to keep secrets. Instead, the backend decides
which data the model is allowed to see BEFORE calling it:

    logged-in user (from the auth token)
        → build_context(user, question)   # loads ONLY data this user may see
        → system prompt + question → AI provider → reply

- Student: only their own sessions and progress. Mentor identity stays hidden
  for meditation (motivation) sessions, same rule as the student API.
- Mentor:  their own schedule, plus the data of students they are allowed to
  see (allowed_students_for_mentor) whose names appear in the question.

If another student's data is never loaded, no prompt trick can leak it.

PROVIDER
--------
Any Ollama-style chat API (default: Ollama Cloud, https://ollama.com/api/chat).
Configured via .env: AI_API_URL, AI_API_KEY, AI_MODEL.
Without AI_API_KEY the service runs in DEMO MODE: no AI call is made and the
reply shows exactly which data would have been sent — useful for development.
"""

import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

import httpx

from database import supabase
from services.scheduling_service import format_datetime_for_display
from services.session_service import (
    get_coach_progress,
    get_student_progress,
    get_user_name_lookup,
)

AI_API_URL = os.getenv("AI_API_URL", "https://ollama.com/api/chat")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "")
AI_TIMEOUT_SECONDS = 60

UPCOMING_LIMIT = 10
COMPLETED_LIMIT = 5
MAX_STUDENTS_PER_QUESTION = 3
MAX_HISTORY_MESSAGES = 6

# Simple per-user limit so one person can't burn the monthly AI credits.
# In-memory: fine for a single backend process; use Redis if you run several.
RATE_LIMIT_MESSAGES = 20
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_recent_requests: Dict[str, Deque[float]] = defaultdict(deque)


class ChatRateLimited(Exception):
    pass


class ChatProviderError(Exception):
    pass


def is_ai_configured() -> bool:
    return bool(AI_API_KEY and AI_MODEL)


# ── Rate limiting ─────────────────────────────────────────────────────────────

def check_rate_limit(user_id: str, now: Optional[float] = None) -> None:
    now = now if now is not None else time.monotonic()
    window = _recent_requests[user_id]
    while window and now - window[0] > RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= RATE_LIMIT_MESSAGES:
        raise ChatRateLimited(
            f"You've reached the limit of {RATE_LIMIT_MESSAGES} messages per hour. Please try again later."
        )
    window.append(now)


# ── Data loading (the permission boundary) ────────────────────────────────────

def fetch_student_sessions(student_id: str) -> Dict[str, List[Dict[str, Any]]]:
    """Upcoming + recent completed sessions of ONE student."""
    now_iso = datetime.now(timezone.utc).isoformat()
    upcoming = (
        supabase.table("sessions").select("*")
        .eq("student_id", student_id).eq("status", "upcoming")
        .gte("scheduled_at", now_iso).order("scheduled_at").limit(UPCOMING_LIMIT)
        .execute()
    ).data or []
    completed = (
        supabase.table("sessions").select("*")
        .eq("student_id", student_id).eq("status", "completed")
        .order("scheduled_at", desc=True).limit(COMPLETED_LIMIT)
        .execute()
    ).data or []
    return {"upcoming": upcoming, "completed": completed}


def fetch_mentor_sessions(mentor_id: str) -> List[Dict[str, Any]]:
    """Upcoming sessions assigned to ONE mentor."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return (
        supabase.table("sessions").select("*")
        .eq("coach_id", mentor_id).eq("status", "upcoming")
        .gte("scheduled_at", now_iso).order("scheduled_at").limit(UPCOMING_LIMIT)
        .execute()
    ).data or []


def allowed_students_for_mentor(mentor: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Students this mentor may see — the same rule as GET /coach/students.
    When organizations are added, filter by the mentor's organization HERE
    and the chatbot automatically follows it.
    """
    return (
        supabase.table("users").select("id, name")
        .eq("role", "student").order("name")
        .execute()
    ).data or []


def find_mentioned_students(question: str, students: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Students (from the allowed list only) whose full or first name appears in the question."""
    text = question.lower()
    found: List[Dict[str, Any]] = []
    for student in students:
        name = (student.get("name") or "").strip().lower()
        if not name:
            continue
        first = name.split()[0]
        if re.search(rf"\b{re.escape(name)}\b", text) or re.search(rf"\b{re.escape(first)}\b", text):
            found.append(student)
        if len(found) >= MAX_STUDENTS_PER_QUESTION:
            break
    return found


# ── Formatting data as plain text for the model ───────────────────────────────

def _session_line(s: Dict[str, Any], names: Dict[str, str], show_motivation_mentor: bool,
                  student_name: Optional[str] = None, show_study_mentor: bool = True) -> str:
    when = format_datetime_for_display(s["scheduled_at"])
    minutes = int(s.get("duration_minutes") or 45)
    if (s.get("session_type") or "study") == "motivation":
        line = f"- {when} IST, {minutes} min, Meditation: {s.get('session_title') or 'Reflection Session'}"
        if show_motivation_mentor and s.get("coach_id"):
            line += f" (mentor: {names.get(str(s['coach_id']), 'Mentor')})"
    else:
        title = s.get("session_title") or "1:1 Study Session"
        line = f"- {when} IST, {minutes} min, Study: {title}"
        if s.get("topic"):
            line += f" (topic: {s['topic']})"
        if show_study_mentor and s.get("coach_id"):
            line += f" with mentor {names.get(str(s['coach_id']), 'Mentor')}"
    if student_name:
        line += f" — student: {student_name}"
    return line


def _progress_lines(progress: Dict[str, Any]) -> List[str]:
    overall = progress.get("overall", {}) or {}
    week = progress.get("this_week", {}) or {}
    return [
        f"- Total completed study sessions: {overall.get('total_study_sessions', 0)}",
        f"- Total completed meditation sessions: {overall.get('total_motivation_sessions', 0)}",
        f"- Current streak: {overall.get('current_streak', 0)}",
        f"- This week: {week.get('completed_study_sessions', 0)} study and "
        f"{week.get('completed_motivation_sessions', 0)} meditation sessions completed",
    ]


def _student_block(student_id: str, show_motivation_mentor: bool) -> List[str]:
    data = fetch_student_sessions(student_id)
    all_rows = data["upcoming"] + data["completed"]
    names = get_user_name_lookup([str(s["coach_id"]) for s in all_rows if s.get("coach_id")])

    lines = ["Upcoming sessions:"]
    lines += [_session_line(s, names, show_motivation_mentor) for s in data["upcoming"]] or ["- none scheduled"]
    lines.append("Recently completed sessions:")
    lines += [_session_line(s, names, show_motivation_mentor) for s in data["completed"]] or ["- none yet"]
    lines.append("Progress:")
    lines += _progress_lines(get_student_progress(student_id))
    return lines


# ── Context per role ──────────────────────────────────────────────────────────

def build_context(user: Dict[str, Any], question: str) -> str:
    """Return ONLY the data this user is allowed to see, as plain text."""
    role = user.get("role")
    name = user.get("name") or "User"

    if role == "student":
        lines = [f"The user is a student named {name}. This is ONLY their own data."]
        lines += _student_block(user["auth_id"], show_motivation_mentor=False)
        return "\n".join(lines)

    if role == "coach":
        mentor_id = user["auth_id"]
        own = fetch_mentor_sessions(mentor_id)
        names = get_user_name_lookup([str(s["student_id"]) for s in own if s.get("student_id")])
        lines = [f"The user is a mentor named {name}.", "Your upcoming sessions:"]
        lines += [
            _session_line(s, {}, False, student_name=names.get(str(s.get("student_id")), "Student"),
                          show_study_mentor=False)
            for s in own
        ] or ["- none scheduled"]
        lines.append("Your progress:")
        lines += _progress_lines(get_coach_progress(mentor_id))

        allowed = allowed_students_for_mentor(user)
        lines.append("Students you can see: " + (", ".join(s["name"] for s in allowed[:50] if s.get("name")) or "none"))
        for student in find_mentioned_students(question, allowed):
            lines.append(f"\nData for student {student['name']}:")
            lines += _student_block(str(student["id"]), show_motivation_mentor=True)
        return "\n".join(lines)

    return "This user has no session data available."


def build_system_prompt(context: str) -> str:
    today = format_datetime_for_display(datetime.now(timezone.utc))
    return (
        "You are the Ekagra assistant, helping with study and meditation session schedules.\n"
        "Rules:\n"
        "- Answer ONLY from the DATA section below. Never invent sessions, times or numbers.\n"
        "- If the answer is not in the DATA, say you don't have access to that information.\n"
        "- If asked about another person whose data is not below, politely say you can't share it.\n"
        "- All times are in IST. Keep answers short and friendly.\n"
        f"- Right now it is {today} IST.\n\n"
        f"DATA:\n{context}"
    )


def clean_history(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Keep only recent user/assistant turns; never let the client inject system messages."""
    cleaned = [
        {"role": m["role"], "content": str(m.get("content", ""))[:2000]}
        for m in history
        if isinstance(m, dict) and m.get("role") in ("user", "assistant")
    ]
    return cleaned[-MAX_HISTORY_MESSAGES:]


# ── Provider call ─────────────────────────────────────────────────────────────

async def call_model(messages: List[Dict[str, str]]) -> str:
    """Send a chat request to the configured AI provider (Ollama chat API format)."""
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
            response = await client.post(
                AI_API_URL,
                headers={"Authorization": f"Bearer {AI_API_KEY}"},
                json={"model": AI_MODEL, "messages": messages, "stream": False},
            )
        response.raise_for_status()
        return response.json()["message"]["content"].strip()
    except httpx.HTTPStatusError as e:
        raise ChatProviderError(f"AI provider returned {e.response.status_code}.") from e
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise ChatProviderError("Could not reach the AI provider.") from e


async def answer(user: Dict[str, Any], question: str, history: List[Dict[str, Any]]) -> Dict[str, str]:
    """Main entry point used by POST /chat."""
    check_rate_limit(user["auth_id"])
    context = build_context(user, question)

    if not is_ai_configured():
        return {
            "mode": "demo",
            "reply": (
                "Demo mode — no AI key is set yet, so here is exactly the data the AI "
                "would receive for your question:\n\n" + context
            ),
        }

    messages = [
        {"role": "system", "content": build_system_prompt(context)},
        *clean_history(history),
        {"role": "user", "content": question},
    ]
    return {"mode": "ai", "reply": await call_model(messages)}
