"""
Zoom Service — Meeting Link Generation

Currently returns a hardcoded placeholder link.
Designed so the internal logic can be swapped with real Zoom API calls
(Server-to-Server OAuth) without changing the function signature.
"""


def generate_zoom_link(session_data: dict) -> str:
    """
    Generate a Zoom meeting link for a session.

    Args:
        session_data: A dict containing session details, e.g.:
            {
                "session_id": "...",
                "student_id": "...",
                "coach_id": "...",
                "scheduled_at": "...",
            }

    Returns:
        A Zoom meeting URL string.
    """

    # ──────────────────────────────────────────────────────────────────
    # FUTURE: Replace the placeholder below with real Zoom API logic.
    #
    # Steps to integrate Zoom Server-to-Server OAuth:
    #
    # 1. Create a Server-to-Server OAuth app in the Zoom Marketplace:
    #    https://marketplace.zoom.us/
    #
    # 2. Store credentials in environment variables:
    #    ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
    #
    # 3. Obtain an access token:
    #    POST https://zoom.us/oauth/token?grant_type=account_credentials
    #         &account_id={ZOOM_ACCOUNT_ID}
    #    Headers: Authorization: Basic base64(client_id:client_secret)
    #
    # 4. Create a meeting:
    #    POST https://api.zoom.us/v2/users/me/meetings
    #    Headers: Authorization: Bearer {access_token}
    #    Body: {
    #        "topic": f"Ekagra Session — {session_data.get('session_id')}",
    #        "type": 2,  # Scheduled meeting
    #        "start_time": session_data.get("scheduled_at"),
    #        "duration": 60,
    #        "timezone": "UTC",
    #        "settings": {
    #            "join_before_host": True,
    #            "waiting_room": False,
    #        }
    #    }
    #
    # 5. Return response_json["join_url"]
    # ──────────────────────────────────────────────────────────────────

    # Placeholder — static link for development / testing
    return "https://zoom.us/j/000000000"
