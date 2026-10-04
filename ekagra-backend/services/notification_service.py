"""
Notification Service for Ekagra Platform.

Handles creation, retrieval, and read status management for in-app user notifications.
Gracefully handles database states and supports fallback storage if the notifications
table is pending migration.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid
from database import supabase

# In-memory fallback cache in case PostgreSQL table migration is pending
_MEMORY_NOTIFICATIONS: List[Dict[str, Any]] = []


def create_notification(user_id: str, message: str) -> Optional[Dict[str, Any]]:
    """
    Create an in-app notification for a student or coach.
    """
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": message,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        res = supabase.table("notifications").insert(row).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        # Fallback to in-memory store if database table has not yet been migrated
        print(f"Notice: notifications table insert fallback: {e}")
        _MEMORY_NOTIFICATIONS.append(row)

    return row


def get_user_notifications(user_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all notifications for a specific user, ordered most recent first.
    """
    try:
        res = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        if res.data is not None:
            return res.data
    except Exception as e:
        print(f"Notice: notifications table query fallback: {e}")

    # Fallback to memory
    user_rows = [n for n in _MEMORY_NOTIFICATIONS if n.get("user_id") == user_id]
    user_rows.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return user_rows


def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """
    Mark a specific notification as read.
    """
    try:
        supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).select().execute()
        return True
    except Exception as e:
        print(f"Notice: notifications update fallback: {e}")

    # Update in memory
    for n in _MEMORY_NOTIFICATIONS:
        if n.get("id") == notification_id and n.get("user_id") == user_id:
            n["is_read"] = True
            return True
    return False


def mark_all_notifications_read(user_id: str) -> int:
    """
    Mark all notifications for a user as read.
    """
    try:
        supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).select().execute()
    except Exception:
        pass

    count = 0
    for n in _MEMORY_NOTIFICATIONS:
        if n.get("user_id") == user_id and not n.get("is_read"):
            n["is_read"] = True
            count += 1
    return count
