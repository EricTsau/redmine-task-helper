"""
AI PM Copilot 路由
提供 AI PRD 對話及任務產生功能
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta

from app.database import get_session
from app.dependencies import get_current_user, get_redmine_service, get_openai_service
from app.models import User, PRDConversation
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.services.workday_calculator import WorkdayCalculator

router = APIRouter(tags=["pm-copilot"])


# ============ Request/Response Models ============

class PRDChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class TaskItem(BaseModel):
    subject: str
    estimated_hours: float
    start_date: str  # YYYY-MM-DD
    due_date: str    # YYYY-MM-DD
    predecessors: List[int] = []  # Task 序號 (1-based index)


class PRDChatResponse(BaseModel):
    conversation_id: int
    ai_message: str
    tasks: List[Dict[str, Any]]
    project_context: Dict[str, Any]


class GenerateTasksRequest(BaseModel):
    conversation_id: int
    parent_task_subject: str
    tasks: List[TaskItem]


class GenerateTasksResponse(BaseModel):
    parent_issue_id: int
    child_issue_ids: List[int]
    status: str


# ============ PRD Chat ============

@router.post("/projects/{project_id}/prd-chat", response_model=PRDChatResponse)
def prd_chat(
    project_id: int,
    request: PRDChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service),
    openai: OpenAIService = Depends(get_openai_service)
):
    """
    AI PRD 對話
    根據使用者輸入，AI 協助拆解 PRD 為任務清單
    """
    # 取得專案資訊
    try:
        projects = redmine.get_my_projects()
        project_info = None
        for p in projects:
            if p.id == project_id:
                project_info = {"id": p.id, "name": p.name}
                break
        if not project_info:
            raise HTTPException(status_code=404, detail="Project not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch project: {str(e)}")
    
    # 取得或建立對話
    conversation = None
    if request.conversation_id:
        conversation = session.exec(
            select(PRDConversation)
            .where(PRDConversation.id == request.conversation_id)
            .where(PRDConversation.owner_id == current_user.id)
        ).first()
    
    if not conversation:
        conversation = PRDConversation(
            owner_id=current_user.id,
            project_id=project_id,
            project_name=project_info["name"],
            messages="[]"
        )
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
    
    # 載入歷史訊息
    messages = json.loads(conversation.messages)
    messages.append({"role": "user", "content": request.message})
    
    # 呼叫 OpenAI 進行 PRD 解析
    try:
        ai_result = openai.parse_prd_to_tasks(messages, project_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")
    
    # 更新對話紀錄
    messages.append({"role": "assistant", "content": ai_result["message"]})
    conversation.messages = json.dumps(messages, ensure_ascii=False)
    if ai_result.get("tasks"):
        conversation.generated_tasks = json.dumps(ai_result["tasks"], ensure_ascii=False)
    conversation.updated_at = datetime.utcnow()
    session.commit()
    
    return PRDChatResponse(
        conversation_id=conversation.id,
        ai_message=ai_result["message"],
        tasks=ai_result.get("tasks", []),
        project_context=project_info
    )


@router.post("/projects/{project_id}/generate-tasks", response_model=GenerateTasksResponse)
def generate_tasks(
    project_id: int,
    request: GenerateTasksRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """
    產生任務到 Redmine
    1. 建立 Parent Task，將 PRD 對話紀錄寫入 Notes
    2. 建立 Sub-tasks
    """
    # 取得對話紀錄
    conversation = session.exec(
        select(PRDConversation)
        .where(PRDConversation.id == request.conversation_id)
        .where(PRDConversation.owner_id == current_user.id)
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # 整理 PRD 對話為 Notes
    messages = json.loads(conversation.messages)
    prd_notes = "## PRD 對話紀錄\n\n"
    for msg in messages:
        role = "使用者" if msg["role"] == "user" else "AI 助手"
        prd_notes += f"**{role}**: {msg['content']}\n\n"
    
    # 建立 Parent Task
    try:
        parent_issue = redmine.create_issue(
            project_id=project_id,
            subject=request.parent_task_subject,
            tracker_id=1,  # Default tracker, 可以後續由 metadata 取得
            description=prd_notes
        )
        parent_issue_id = parent_issue.id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create parent task: {str(e)}")
    
    # 建立 Sub-tasks
    child_issue_ids = []
    issue_id_map = {}  # 用於對應 predecessors
    
    for idx, task in enumerate(request.tasks, 1):
        try:
            child_issue = redmine.create_issue(
                project_id=project_id,
                subject=task.subject,
                tracker_id=1,
                parent_issue_id=parent_issue_id,
                estimated_hours=task.estimated_hours,
                start_date=task.start_date,
                due_date=task.due_date
            )
            child_issue_ids.append(child_issue.id)
            issue_id_map[idx] = child_issue.id
        except Exception as e:
            # 記錄錯誤但繼續處理其他任務
            print(f"Failed to create subtask '{task.subject}': {e}")
    
    # 更新對話狀態
    conversation.status = "synced"
    conversation.updated_at = datetime.utcnow()
    session.commit()
    
    return GenerateTasksResponse(
        parent_issue_id=parent_issue_id,
        child_issue_ids=child_issue_ids,
        status="success"
    )


@router.get("/conversations", response_model=List[Dict[str, Any]])
def list_conversations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得使用者的 PRD 對話歷史"""
    conversations = session.exec(
        select(PRDConversation)
        .where(PRDConversation.owner_id == current_user.id)
        .order_by(PRDConversation.updated_at.desc())
    ).all()
    
    return [
        {
            "id": c.id,
            "project_id": c.project_id,
            "project_name": c.project_name,
            "status": c.status,
            "has_tasks": c.generated_tasks is not None,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat()
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得單一對話詳情"""
    conversation = session.exec(
        select(PRDConversation)
        .where(PRDConversation.id == conversation_id)
        .where(PRDConversation.owner_id == current_user.id)
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": conversation.id,
        "project_id": conversation.project_id,
        "project_name": conversation.project_name,
        "messages": json.loads(conversation.messages),
        "generated_tasks": json.loads(conversation.generated_tasks) if conversation.generated_tasks else [],
        "status": conversation.status,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat()
    }


@router.get("/projects/{project_id}/gantt-data")
def get_gantt_data(
    project_id: int,
    redmine: RedmineService = Depends(get_redmine_service),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user)
):
    """
    取得專案的甘特圖資料
    """
    try:
        issues = redmine.search_issues_advanced(
            project_id=project_id,
            status="open",
            limit=100
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch issues: {str(e)}")
    
    # 計算工作天
    calculator = WorkdayCalculator(session)
    
    gantt_data = []
    for issue in issues:
        start_date = getattr(issue, 'start_date', None)
        due_date = getattr(issue, 'due_date', None)
        
        # 計算工作天數
        working_days = 0
        if start_date and due_date:
            working_days = calculator.get_working_days_between(start_date, due_date)
        
        # 決定顏色 (根據優先級)
        priority_id = issue.priority.id if hasattr(issue, 'priority') else 2
        color = "#3b82f6"  # 預設藍色
        if priority_id >= 4:  # High/Urgent
            color = "#ef4444"  # 紅色
        elif priority_id == 3:  # Normal
            color = "#f59e0b"  # 橘色
        
        gantt_data.append({
            "id": issue.id,
            "subject": issue.subject,
            "start_date": str(start_date) if start_date else None,
            "due_date": str(due_date) if due_date else None,
            "estimated_hours": getattr(issue, 'estimated_hours', None),
            "done_ratio": getattr(issue, 'done_ratio', 0),
            "status": issue.status.name if hasattr(issue, 'status') else "Unknown",
            "priority": issue.priority.name if hasattr(issue, 'priority') else "Normal",
            "parent_id": getattr(issue, 'parent', {}).get('id') if hasattr(issue, 'parent') else None,
            "working_days": working_days,
            "color": color
        })
    
    return {
        "project_id": project_id,
        "tasks": gantt_data
    }
