from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.dependencies import get_current_user, get_openai_service
from app.models import User
from app.services.copilot_service import CopilotService

router = APIRouter()

class CopilotChatRequest(BaseModel):
    context_type: str
    message: str
    context_data: Dict[str, Any] = {}
    conversation_history: Optional[List[Dict]] = None


@router.post("/copilot/stream")
async def copilot_stream(request: CopilotChatRequest, current_user: User = Depends(get_current_user)):
    # Build messages similar to previous copilot router
    try:
        service = CopilotService(user_id=current_user.id)
        openai_service = service.openai_service
        if not openai_service:
            raise HTTPException(status_code=400, detail="OpenAI not configured for user")

        system_prompt = service.SYSTEM_PROMPTS.get(
            request.context_type,
            "你是一個有幫助的助手。請使用繁體中文回答。"
        )

        context_desc = service._build_context_description(request.context_type, request.context_data)

        messages = [
            {"role": "system", "content": f"{system_prompt}\n\n### 當前頁面數據\n{context_desc}"}
        ]

        if request.conversation_history:
            for msg in request.conversation_history[-10:]:
                messages.append(msg)

        messages.append({"role": "user", "content": request.message})

        gen = openai_service.stream_chat(messages, temperature=0.5)
        return StreamingResponse(gen, media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
