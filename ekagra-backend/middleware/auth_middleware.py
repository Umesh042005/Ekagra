from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase, get_auth_client

# HTTPBearer extracts the token from the "Authorization: Bearer <token>" header
security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Tier 1 — Token Verification.
    Extracts the JWT from the Authorization header, verifies it against
    Supabase Auth, and returns the decoded user payload.
    Raises 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials

    try:
        # Verify the JWT with Supabase and retrieve the user object via isolated auth client
        user_response = get_auth_client().auth.get_user(token)
        user = user_response.user

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token.",
            )

        # Fetch the user's role from the public `users` table
        profile_response = (
            supabase.table("users")
            .select("*")
            .eq("id", str(user.id))
            .single()
            .execute()
        )

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found in database.",
            )

        # Deactivated accounts lose API access immediately, even with an old token
        if profile_response.data.get("is_active", True) is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact the Ekagra team.",
            )

        # Return a combined dict: Supabase auth id + profile row data
        return {
            "auth_id": str(user.id),
            "email": user.email,
            **profile_response.data,
        }

    except HTTPException:
        raise  # Re-raise our own HTTP exceptions as-is
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
        )


def require_role(role: str):
    """
    Tier 2 — Role-Based Access Control.
    Returns a FastAPI dependency that first verifies the token (Tier 1)
    and then checks if the authenticated user has the required role.
    Raises 403 if the user's role does not match.

    Usage in a route:
        @router.get("/coach/profile")
        async def profile(user: dict = Depends(require_role("coach"))):
            ...
    """

    async def role_checker(
        user: dict = Depends(verify_token),
    ) -> dict:
        if user.get("role") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. This endpoint requires the '{role}' role.",
            )
        return user

    return role_checker
