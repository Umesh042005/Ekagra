"""
Admin Routes for Ekagra Platform.

Every endpoint requires role='admin' (checked on the server, not just hidden in the UI).

Endpoints:
- GET  /admin/mentors: All mentors with active/deactivated status and running-series count.
- GET  /admin/students: All students.
- POST /admin/mentors: Create a mentor account (admin chooses the password).
- POST /admin/mentors/{mentor_id}/deactivate: Block a mentor from logging in (nothing is deleted).
- POST /admin/mentors/{mentor_id}/activate: Restore a deactivated mentor.
"""

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from database import supabase
from middleware.auth_middleware import require_role
from services.user_service import (
    UserServiceError,
    create_user_account,
    is_active,
    set_user_active,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateMentorRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class AdminUserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    running_series: int = 0  # mentors only: active/paused series they rotate in


# ── Helpers ───────────────────────────────────────────────────────────────────

def _list_users(role: str) -> List[Dict[str, Any]]:
    try:
        return (
            supabase.table("users").select("*").eq("role", role).order("name").execute()
        ).data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users: {str(e)}",
        )


def _running_series_counts() -> Dict[str, int]:
    """Mentor id -> number of active/paused series they are part of."""
    counts: Dict[str, int] = {}
    try:
        rows = (
            supabase.table("series").select("coach_ids").in_("status", ["active", "paused"]).execute()
        ).data or []
    except Exception:
        return counts
    for row in rows:
        for cid in set(str(c) for c in row.get("coach_ids") or []):
            counts[cid] = counts.get(cid, 0) + 1
    return counts


def _to_response(row: Dict[str, Any], running_series: int = 0) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(row["id"]),
        name=row.get("name") or "",
        email=row.get("email") or "",
        avatar_url=row.get("avatar_url"),
        is_active=is_active(row),
        created_at=str(row["created_at"]) if row.get("created_at") else None,
        running_series=running_series,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/mentors", response_model=List[AdminUserResponse], summary="List all mentors")
async def list_mentors(admin: dict = Depends(require_role("admin"))):
    counts = _running_series_counts()
    return [_to_response(r, counts.get(str(r["id"]), 0)) for r in _list_users("coach")]


@router.get("/students", response_model=List[AdminUserResponse], summary="List all students")
async def list_students(admin: dict = Depends(require_role("admin"))):
    return [_to_response(r) for r in _list_users("student")]


@router.post(
    "/mentors",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a mentor account",
)
async def create_mentor(payload: CreateMentorRequest, admin: dict = Depends(require_role("admin"))):
    try:
        profile = create_user_account(payload.name, payload.email, payload.password, role="coach")
    except UserServiceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _to_response(profile)


@router.post(
    "/mentors/{mentor_id}/{action}",
    response_model=AdminUserResponse,
    summary="Deactivate or re-activate a mentor",
)
async def change_mentor_status(
    mentor_id: str,
    action: Literal["deactivate", "activate"],
    admin: dict = Depends(require_role("admin")),
):
    res = supabase.table("users").select("*").eq("id", mentor_id).limit(1).execute()
    if not res.data or res.data[0].get("role") != "coach":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor not found.")
    mentor = res.data[0]

    try:
        set_user_active(mentor_id, action == "activate")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not {action} mentor: {str(e)}",
        )

    mentor["is_active"] = action == "activate"
    return _to_response(mentor, _running_series_counts().get(mentor_id, 0))
