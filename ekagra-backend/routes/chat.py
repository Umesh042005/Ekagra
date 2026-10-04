"""
Chat Routes for Ekagra Platform.

Endpoints:
- POST /chat: Ask the Ekagra assistant a question (students & mentors only).
- GET  /chat/status: Whether a real AI provider is configured or demo mode is active.

The user's identity always comes from the login token — never from the message —
so a user cannot ask "as" someone else. See services/chat_service.py for the
privacy model.
"""

from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from middleware.auth_middleware import verify_token
from services.chat_service import (
    ChatProviderError,
    ChatRateLimited,
    answer,
    is_ai_configured,
)

router = APIRouter(prefix="/chat", tags=["Chat"])

CHAT_ROLES = ("student", "coach")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    mode: Literal["ai", "demo"]


def _require_chat_role(user: dict) -> None:
    if user.get("role") not in CHAT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The assistant is available for students and mentors only.",
        )


@router.get("/status", summary="Check whether the assistant uses a real AI or demo mode")
async def chat_status(user: dict = Depends(verify_token)):
    _require_chat_role(user)
    return {"mode": "ai" if is_ai_configured() else "demo"}


@router.post("", response_model=ChatResponse, summary="Ask the Ekagra assistant")
async def chat(payload: ChatRequest, user: dict = Depends(verify_token)):
    _require_chat_role(user)
    try:
        result = await answer(
            user,
            payload.message.strip(),
            [m.model_dump() for m in payload.history],
        )
    except ChatRateLimited as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except ChatProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The assistant is temporarily unavailable. {e}",
        )
    return ChatResponse(**result)
