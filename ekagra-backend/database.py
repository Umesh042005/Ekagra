import os
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions

# Load environment variables from .env file
# override=True ensures updated .env values are always picked up on uvicorn --reload
load_dotenv(override=True)

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print(
        "WARNING: SUPABASE_URL or SUPABASE_KEY is missing from the environment. "
        "Please create a .env file based on .env.example before making database requests."
    )

# Dedicated service_role client for database tables & storage
def get_supabase_client() -> Client:
    """
    Returns an initialized Supabase Client instance for database and storage operations.
    The internal auth state change emitters are disconnected so login/signup/user auth
    events can NEVER overwrite the service_role Authorization header or PostgREST credentials.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        # Disconnect auth change listener so user sessions never replace service_role key
        client.auth._state_change_emitters.clear()
    except Exception as e:
        print(f"Warning: could not disconnect auth state emitters: {e}")
    return client


def get_auth_client() -> Client:
    """
    Returns an isolated client instance dedicated to Supabase Auth operations
    (e.g., sign_in_with_password, sign_up, get_user) so user sessions are never
    polluting the global database/storage service_role client.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )
    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )


# Exported singleton instance for database and storage queries (always service_role)
try:
    supabase: Client = get_supabase_client() if (SUPABASE_URL and SUPABASE_KEY) else None  # type: ignore
except Exception as e:
    print(f"Supabase client initialization failed: {e}")
    supabase = None  # type: ignore


def reset_supabase_auth() -> None:
    """
    Ensure the shared Supabase PostgREST client is authenticated using
    the SUPABASE_KEY (service/secret key) rather than any user session JWT.
    """
    if supabase and SUPABASE_KEY:
        auth_header = f"Bearer {SUPABASE_KEY}"
        supabase.options.headers["Authorization"] = auth_header
        supabase.postgrest.auth(SUPABASE_KEY)


