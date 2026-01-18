"""
PRD 文件管理 Router
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.dependencies import get_current_user
from app.models import User, PRDDocument

router = APIRouter(prefix="/prd", tags=["prd"])


# ============ Request/Response Models ============

class PRDCreate(BaseModel):
    title: str
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    content: str = ""


class PRDUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


class PRDResponse(BaseModel):
    id: int
    title: str
    project_id: Optional[int]
    project_name: Optional[str]
    content: str
    conversation_history: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PRDListItem(BaseModel):
    id: int
    title: str
    project_id: Optional[int]
    project_name: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ API Endpoints ============

@router.post("", response_model=PRDResponse)
async def create_prd(
    prd: PRDCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """建立新的 PRD 文件"""
    db_prd = PRDDocument(
        owner_id=current_user.id,
        title=prd.title,
        project_id=prd.project_id,
        project_name=prd.project_name,
        content=prd.content,
    )
    session.add(db_prd)
    session.commit()
    session.refresh(db_prd)
    return db_prd


@router.get("", response_model=List[PRDListItem])
async def list_prds(
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """列出使用者的 PRD 文件，可依專案篩選"""
    query = select(PRDDocument).where(PRDDocument.owner_id == current_user.id)
    
    if project_id is not None:
        query = query.where(PRDDocument.project_id == project_id)
    
    query = query.order_by(PRDDocument.updated_at.desc())
    results = session.exec(query).all()
    return results


@router.get("/{prd_id}", response_model=PRDResponse)
async def get_prd(
    prd_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得單一 PRD 文件"""
    prd = session.get(PRDDocument, prd_id)
    if not prd or prd.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="PRD not found")
    return prd


@router.put("/{prd_id}", response_model=PRDResponse)
async def update_prd(
    prd_id: int,
    prd_update: PRDUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """更新 PRD 文件"""
    prd = session.get(PRDDocument, prd_id)
    if not prd or prd.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="PRD not found")
    
    if prd_update.title is not None:
        prd.title = prd_update.title
    if prd_update.content is not None:
        prd.content = prd_update.content
    if prd_update.status is not None:
        prd.status = prd_update.status
    
    prd.updated_at = datetime.utcnow()
    session.add(prd)
    session.commit()
    session.refresh(prd)
    return prd


@router.delete("/{prd_id}")
async def delete_prd(
    prd_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """刪除 PRD 文件"""
    prd = session.get(PRDDocument, prd_id)
    if not prd or prd.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="PRD not found")
    
    session.delete(prd)
    session.commit()
    return {"status": "deleted"}


# ============ AI Features ============

import json
from app.dependencies import get_openai_service
from app.services.openai_service import OpenAIService


class PRDChatRequest(BaseModel):
    message: str


class PRDChatResponse(BaseModel):
    ai_message: str
    updated_content: str


@router.post("/{prd_id}/chat", response_model=PRDChatResponse)
async def prd_chat(
    prd_id: int,
    request: PRDChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    openai: OpenAIService = Depends(get_openai_service)
):
    """
    與 AI 對話討論 PRD，AI 會根據對話更新 PRD 內容
    """
    prd = session.get(PRDDocument, prd_id)
    if not prd or prd.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="PRD not found")
    
    # 載入對話歷史
    conversation: List[dict] = json.loads(prd.conversation_history)
    
    # 加入使用者訊息
    conversation.append({"role": "user", "content": request.message})
    
    # 建構 AI Prompt
    system_prompt = """你是一位資深產品經理，協助使用者撰寫 PRD（產品需求文件）。

根據使用者的對話，持續更新和完善 PRD 文件內容。請使用 Markdown 格式。

當前 PRD 內容：
```markdown
{current_content}
```

請根據使用者的新訊息，回覆兩個部分（用 --- 分隔）：
1. 對使用者的回應和建議
2. 更新後的完整 PRD 內容（Markdown 格式）

格式範例：
我理解您的需求，這是一個很好的想法。我建議我們可以...

---

# PRD 標題

## 1. 目標
...

## 2. 功能需求
...
"""
    
    # 呼叫 AI
    messages = [
        {"role": "system", "content": system_prompt.format(current_content=prd.content or "（尚無內容）")},
    ]
    # 只取最近 10 則對話避免 token 過多
    for msg in conversation[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    try:
        ai_response = await openai.chat_completion(messages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服務錯誤: {str(e)}")
    
    # 解析 AI 回應
    response_parts = ai_response.split("---", 1)
    ai_message = response_parts[0].strip()
    updated_content = response_parts[1].strip() if len(response_parts) > 1 else prd.content
    
    # 儲存對話和更新內容
    conversation.append({"role": "assistant", "content": ai_message})
    prd.conversation_history = json.dumps(conversation, ensure_ascii=False)
    prd.content = updated_content
    prd.updated_at = datetime.utcnow()
    
    session.add(prd)
    session.commit()
    
    return PRDChatResponse(
        ai_message=ai_message,
        updated_content=updated_content
    )


class AIEditRequest(BaseModel):
    selected_text: str
    instruction: str


class AIEditResponse(BaseModel):
    edited_text: str


@router.post("/{prd_id}/ai-edit", response_model=AIEditResponse)
async def prd_ai_edit(
    prd_id: int,
    request: AIEditRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    openai: OpenAIService = Depends(get_openai_service)
):
    """
    AI 局部編輯：選取一段文字，請 AI 根據指示修改
    """
    prd = session.get(PRDDocument, prd_id)
    if not prd or prd.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="PRD not found")
    
    system_prompt = """你是一位資深產品經理，協助使用者編輯 PRD 文件。

使用者選取了一段文字，請根據使用者的指示修改這段文字。
只回傳修改後的文字，不要加任何說明或解釋。
保持 Markdown 格式。"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"原文：\n{request.selected_text}\n\n修改指示：{request.instruction}"}
    ]
    
    try:
        edited_text = await openai.chat_completion(messages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服務錯誤: {str(e)}")
    
    return AIEditResponse(edited_text=edited_text.strip())

