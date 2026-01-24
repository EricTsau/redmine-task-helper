"""
通用 AI Copilot API Router
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.dependencies import get_current_user
from app.models import User
from app.services.copilot_service import CopilotService

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


class CopilotChatRequest(BaseModel):
    """Copilot 對話請求"""
    context_type: str  # "gitlab_dashboard" | "task_workbench" | "ai_summary"
    message: str
    context_data: Dict[str, Any] = {}
    conversation_history: Optional[List[Dict]] = None


class CopilotChatResponse(BaseModel):
    """Copilot 對話回應"""
    response: str


@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(
    request: CopilotChatRequest,
    current_user: User = Depends(get_current_user)
):
    """
    通用 AI Copilot 對話 endpoint
    
    支援的 context_type:
    - gitlab_dashboard: GitLab 儀表板 (傳入 commits, MRs, KPI)
    - task_workbench: 任務工作台 (傳入 tasks, selected_task)
    - ai_summary: 工作總結頁面 (傳入 report_content)
    """
    try:
        service = CopilotService(user_id=current_user.id)
        result = await service.chat(
            context_type=request.context_type,
            message=request.message,
            context_data=request.context_data,
            conversation_history=request.conversation_history
        )
        return CopilotChatResponse(response=result["response"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
