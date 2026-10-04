"""
Notifications Routes for Ekagra Platform.

Endpoints:
- GET  /notifications: List current user's notifications (ordered most recent first)
- POST /notifications/{id}/read: Mark a notification as read
- POST /notifications/read-all: Mark all notifications as read
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from middleware.auth_middleware import verify_token
from services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponseItem(BaseModel):
    id: str
    user_id: str
    message: str
    is_read: bool
    created_at: str


class NotificationsListResponse(BaseModel):
    notifications: List[NotificationResponseItem]
    unread_count: int


@router.get(
    "",
    response_model=NotificationsListResponse,
    summary="List all notifications for the authenticated user",
    response_description="Array of user notifications and unread badge count",
)
async def list_notifications(user: dict = Depends(verify_token)):
    """
    Return all notifications for the authenticated user, ordered most recent first.
    Includes the total unread count for badge indicators.
    """
    try:
        user_id = user["auth_id"]
        rows = get_user_notifications(user_id)
        unread = sum(1 for n in rows if not n.get("is_read"))

        items = [
            NotificationResponseItem(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                message=str(r["message"]),
                is_read=bool(r.get("is_read", False)),
                created_at=str(r.get("created_at", "")),
            )
            for r in rows
        ]

        return NotificationsListResponse(
            notifications=items,
            unread_count=unread,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notifications: {str(e)}",
        )


@router.post(
    "/{notification_id}/read",
    summary="Mark a specific notification as read",
)
async def mark_read(
    notification_id: str,
    user: dict = Depends(verify_token),
):
    """
    Mark a notification as read for the authenticated user.
    """
    user_id = user["auth_id"]
    success = mark_notification_read(notification_id, user_id)
    return {"message": "Notification marked as read.", "notification_id": notification_id, "success": success}


@router.post(
    "/read-all",
    summary="Mark all notifications as read",
)
async def mark_all_read(user: dict = Depends(verify_token)):
    """
    Mark all unread notifications as read for the authenticated user.
    """
    user_id = user["auth_id"]
    count = mark_all_notifications_read(user_id)
    return {"message": f"{count} notifications marked as read.", "updated_count": count}
