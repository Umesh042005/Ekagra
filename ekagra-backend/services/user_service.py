"""
User Service — account creation and activation, shared by the admin panel
and the one-time CLI scripts (create_admin.py / create_mentor.py).

Roles stored in `users.role`: 'student', 'coach' (shown as "Mentor" in the UI), 'admin'.
"""

from typing import Any, Dict

from database import supabase, get_auth_client

# Supabase has no "disable user" flag; a very long ban is the standard way.
_BAN_FOREVER = "876000h"  # ~100 years


class UserServiceError(Exception):
    """Raised with a user-friendly message when account changes fail."""


def is_active(user_row: Dict[str, Any]) -> bool:
    # Rows created before migration 003 have no is_active column → treat as active
    return user_row.get("is_active", True) is not False


def create_user_account(name: str, email: str, password: str, role: str) -> Dict[str, Any]:
    """
    Create a confirmed Supabase Auth user plus the matching `users` profile row.
    The account can log in immediately with the given password.
    """
    if supabase is None:
        raise UserServiceError("Supabase is not configured — check SUPABASE_URL / SUPABASE_KEY in .env.")
    if role not in ("student", "coach", "admin"):
        raise UserServiceError(f"Unknown role '{role}'.")
    if len(password) < 6:
        raise UserServiceError("Password must be at least 6 characters.")

    email = email.strip().lower()
    auth_client = get_auth_client()
    try:
        res = auth_client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
    except Exception as e:
        msg = str(e)
        if "already" in msg.lower() and "registered" in msg.lower():
            raise UserServiceError("An account with this email already exists.")
        raise UserServiceError(f"Could not create login: {msg}")

    user_id = str(res.user.id)
    profile = {"id": user_id, "name": name.strip(), "email": email, "role": role}
    try:
        supabase.table("users").insert(profile).execute()
    except Exception as e:
        # Roll back the auth user so a retry with the same email works
        try:
            auth_client.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise UserServiceError(f"Could not create profile: {e}")

    return profile


def set_user_active(user_id: str, active: bool) -> None:
    """
    Activate / deactivate an account. Deactivation both flags the profile
    (checked by our API on every request) and bans the Supabase Auth user
    (so it cannot log in at all). Nothing is deleted.
    """
    supabase.table("users").update({"is_active": active}).eq("id", user_id).execute()
    get_auth_client().auth.admin.update_user_by_id(
        user_id, {"ban_duration": "none" if active else _BAN_FOREVER}
    )
