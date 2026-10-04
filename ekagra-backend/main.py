import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.student import router as student_router
from routes.coach import router as coach_router
from routes.notifications import router as notifications_router
from routes.admin import router as admin_router
from routes.chat import router as chat_router
from services.series_service import top_up_all_active_series

# How often ongoing series are extended to keep ~2 weeks of sessions booked
SERIES_TOP_UP_INTERVAL_SECONDS = 60 * 60


async def series_top_up_loop() -> None:
    """Background job: keep every active series booked ahead (runs at startup, then hourly)."""
    while True:
        try:
            created = await asyncio.to_thread(top_up_all_active_series)
            if created:
                print(f"[series top-up] booked {created} new session(s)")
        except Exception as e:
            print(f"[series top-up] failed: {e}")
        await asyncio.sleep(SERIES_TOP_UP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(series_top_up_loop())
    yield
    task.cancel()

# ── App initialization ────────────────────────────────────────────────

app = FastAPI(
    title="Ekagra API",
    description="Backend for the Ekagra meditation & coaching platform — "
                "connecting students with coaches.",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
# Allow all origins during development so the React frontend
# (running on a different port) can talk to this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register route modules ───────────────────────────────────────────

app.include_router(auth_router)
app.include_router(student_router)
app.include_router(coach_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(chat_router)


# ── Health check ──────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def health_check():
    """Simple root endpoint to verify the API is running."""
    return {
        "status": "healthy",
        "app": "Ekagra API",
        "version": "0.1.0",
    }
