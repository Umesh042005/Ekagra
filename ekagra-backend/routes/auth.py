import os
import uuid
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel, EmailStr
from database import supabase, get_auth_client
from middleware.auth_middleware import verify_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Pydantic request models ──────────────────────────────────────────

class SignupRequest(BaseModel):
    """Request body for user registration."""
    email: EmailStr
    password: str
    name: str
    role: str = "student"  # Public signup is students-only; mentors are created via create_mentor.py


class LoginRequest(BaseModel):
    """Request body for user login."""
    email: EmailStr
    password: str


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    """
    Register a new student.
    1. Rejects any role other than 'student' — mentor accounts are created
       by the admin with `python create_mentor.py` and never via public signup.
    2. Creates the user in Supabase Auth.
    3. Inserts a matching row in the public `users` table with their role.
    Returns the new user's id and email on success.
    """
    if payload.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can sign up. Mentor accounts are created by the Ekagra team.",
        )

    try:
        # Step 1: Create user in Supabase Auth (using isolated auth client)
        auth_client = get_auth_client()
        auth_response = auth_client.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
        })

        user = auth_response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signup failed — Supabase did not return a user. "
                       "The email may already be registered.",
            )

        # Step 2: Insert a profile row in the public `users` table
        supabase.table("users").insert({
            "id": str(user.id),
            "name": payload.name,
            "email": payload.email,
            "role": payload.role,
        }).execute()

        return {
            "message": "User created successfully.",
            "user_id": str(user.id),
            "email": payload.email,
            "role": payload.role,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup error: {str(e)}",
        )


@router.post("/login")
async def login(payload: LoginRequest):
    """
    Authenticate an existing user.
    Returns the Supabase access_token and the user's role so the
    frontend can redirect to the correct dashboard (student vs coach).
    """
    try:
        # Sign in with Supabase Auth (using isolated auth client)
        auth_client = get_auth_client()
        auth_response = auth_client.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })

        session = auth_response.session
        user = auth_response.user

        if session is None or user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Fetch the user's role from the `users` table
        profile_response = (
            supabase.table("users")
            .select("*")
            .eq("id", str(user.id))
            .single()
            .execute()
        )

        if profile_response.data and profile_response.data.get("is_active", True) is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact the Ekagra team.",
            )

        role = profile_response.data.get("role") if profile_response.data else None
        avatar_url = profile_response.data.get("avatar_url") if profile_response.data else None

        return {
            "access_token": session.access_token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "email": user.email,
            "role": role,
            "avatar_url": avatar_url,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Supabase rejects banned (deactivated) users before we see their profile
        if "banned" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact the Ekagra team.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login failed: {str(e)}",
        )


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(verify_token),
):
    """
    Upload a user profile avatar image.
    
    Validations:
    - Supported formats: JPEG, PNG, WebP
    - Max size: 5MB
    
    Actions:
    - Stores file in Supabase Storage bucket 'avatars'
    - Retrieves public URL
    - Updates public.users with avatar_url
    - Returns avatar_url to client
    """
    # 1. Validate content type and extension
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    content_type = file.content_type or ""
    
    filename = file.filename or "avatar.jpg"
    ext = os.path.splitext(filename)[1].lower()
    
    if content_type not in allowed_types and ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only JPG, PNG, and WebP files are supported.",
        )

    # 2. Read file content and validate size (max 5MB)
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    max_size_bytes = 5 * 1024 * 1024  # 5MB
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size exceeds 5MB limit. Please select a smaller file.",
        )

    # Standardize content-type
    if not content_type or content_type not in allowed_types:
        content_type = "image/png" if ext == ".png" else "image/webp" if ext == ".webp" else "image/jpeg"

    # 3. Upload to Supabase Storage
    user_id = str(user.get("id") or user.get("auth_id") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID could not be identified from authentication token.",
        )
    file_key = f"{uuid.uuid4().hex[:12]}{ext or '.jpg'}"
    storage_path = f"{user_id}/{file_key}"

    print(f"[upload-avatar] Extracted user_id: {user_id}")
    print(f"[upload-avatar] Storage destination path: avatars/{storage_path}")

    try:
        supabase.storage.from_("avatars").upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        print(f"[upload-avatar] File uploaded to Supabase Storage successfully.")
    except Exception as e:
        print(f"[upload-avatar] Storage upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image to storage: {str(e)}",
        )

    # 4. Generate public URL
    public_url = supabase.storage.from_("avatars").get_public_url(storage_path)
    print(f"[upload-avatar] Generated public_url: {public_url}")

    # 5. Update user row in database
    print(f"============================================================")
    print(f"[DEBUG upload-avatar] Target user_id: {user_id!r} (type: {type(user_id).__name__})")
    print(f"[DEBUG upload-avatar] Full user payload from token: {user}")
    print(f"[DEBUG upload-avatar] user.get('id'): {user.get('id')!r}, user.get('auth_id'): {user.get('auth_id')!r}")
    print(f"[DEBUG upload-avatar] Executing UPDATE users SET avatar_url='{public_url}' WHERE id='{user_id}'...")
    print(f"============================================================")
    try:
        update_res = (
            supabase.table("users")
            .update({"avatar_url": public_url})
            .eq("id", user_id)
            .select()
            .execute()
        )
        print(f"[upload-avatar] Database UPDATE query executed. Result data: {update_res.data}")

        # Check if rows were returned or verify with follow-up query
        if not update_res.data:
            print(f"[upload-avatar] update_res.data is empty despite .select(). Running verification query for user_id={user_id}...")
            verify_res = (
                supabase.table("users")
                .select("avatar_url")
                .eq("id", user_id)
                .execute()
            )
            saved_url = verify_res.data[0].get("avatar_url") if verify_res.data else None
            if saved_url == public_url:
                print(f"[upload-avatar] Verification confirmed: avatar_url matches {public_url} in database.")
            else:
                # Attempt fallback with auth_id if distinct
                auth_id = str(user.get("auth_id") or "")
                fallback_success = False
                if auth_id and auth_id != user_id:
                    print(f"[upload-avatar] Fallback attempt with auth_id={auth_id}...")
                    fallback_res = (
                        supabase.table("users")
                        .update({"avatar_url": public_url})
                        .eq("id", auth_id)
                        .select()
                        .execute()
                    )
                    if fallback_res.data:
                        fallback_success = True
                    else:
                        verify_auth = (
                            supabase.table("users")
                            .select("avatar_url")
                            .eq("id", auth_id)
                            .execute()
                        )
                        if verify_auth.data and verify_auth.data[0].get("avatar_url") == public_url:
                            fallback_success = True

                if not fallback_success:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to update avatar: database record could not be confirmed for user {user_id}.",
                    )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[upload-avatar] ERROR updating avatar_url on users table: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating profile photo: {str(e)}",
        )

    print(f"[upload-avatar] Profile photo persisted successfully for user {user_id}!")
    return {
        "message": "Profile photo uploaded successfully.",
        "avatar_url": public_url,
    }
