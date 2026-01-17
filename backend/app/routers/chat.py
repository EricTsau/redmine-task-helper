from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.services.openai_service import OpenAIService
from app.services.redmine_client import RedmineService
from app.models import TimeEntryExtraction, User, UserSettings
from app.dependencies import get_current_user, get_redmine_service, get_openai_service
from app.database import get_session
from sqlalchemy.orm import Session
from sqlmodel import select

router = APIRouter(tags=["chat"])

class ChatParseRequest(BaseModel):
    message: str

class ChatTimeEntryRequest(BaseModel):
    issue_id: int
    hours: float
    comments: str
    activity_id: int = 9 # Default Development

@router.post("/parse-time-entry", response_model=TimeEntryExtraction)
def parse_time_entry(
    request: ChatParseRequest,
    service: OpenAIService = Depends(get_openai_service)
):
    """
    接收自然語言，使用 OpenAI 解析出工時結構。
    使用儲存在伺服器端的使用者設定。
    """
    try:
        result = service.extract_time_entry(request.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-time-entry")
def submit_time_entry(
    request: ChatTimeEntryRequest,
    redmine: RedmineService = Depends(get_redmine_service)
):
    """
    確認後提交工時到 Redmine。
    使用儲存在伺服器端的使用者設定。
    """
    success = redmine.create_time_entry(
        issue_id=request.issue_id,
        hours=request.hours,
        activity_id=request.activity_id,
        comments=request.comments
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create time entry in Redmine")
    
    return {"status": "success"}
    
@router.post("/message")
def unified_chat(
    request: ChatParseRequest,
    openai_service: OpenAIService = Depends(get_openai_service),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Unified Chat Endpoint.
    Automatically detects intent: 'time_entry' vs 'analysis' vs 'chat'.
    Uses stored credentials.
    """
    # 1. Intent Classification
    intent = openai_service.classify_intent(request.message)
    
    if intent == 'time_entry':
        try:
            extraction = openai_service.extract_time_entry(request.message)
            return {
                "type": "time_entry",
                "data": extraction.dict(),
                "summary": "Please review your time entry below."
            }
        except Exception as e:
            return {"type": "chat", "summary": f"Error parsing time entry: {str(e)}"}

    elif intent == 'analysis':
        # Get Redmine settings from stored user settings
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
        if not settings or not settings.redmine_url or not settings.api_key:
             return {"type": "chat", "summary": "I need Redmine credentials to perform analysis. Please check your settings."}
        
        try:
            # Reuse Analysis Workflow Logic
            filters = openai_service.extract_query_filter(request.message)
            if "limit" not in filters: filters["limit"] = 20
            
            redmine_service = RedmineService(url=settings.redmine_url, api_key=settings.api_key)
            issues = redmine_service.search_issues_advanced(
                project_id=filters.get("project_id"),
                assigned_to=filters.get("assigned_to"),
                status=filters.get("status"),
                query=filters.get("query"),
                updated_after=filters.get("updated_after"),
                limit=filters.get("limit", 20)
            )
            
            serialized_issues = []
            for issue in issues:
                serialized_issues.append({
                    "id": issue.id,
                    "subject": issue.subject,
                    "status": {"id": issue.status.id, "name": issue.status.name} if hasattr(issue, 'status') else None,
                    "done_ratio": getattr(issue, 'done_ratio', 0),
                    "assigned_to": {"id": issue.assigned_to.id, "name": issue.assigned_to.name} if hasattr(issue, 'assigned_to') else None,
                    "start_date": str(getattr(issue, 'start_date', '')),
                    "due_date": str(getattr(issue, 'due_date', '')),
                    "priority": {"id": issue.priority.id, "name": issue.priority.name} if hasattr(issue, 'priority') else None,
                })

            summary = openai_service.summarize_issues(serialized_issues, request.message)
            
            return {
                "type": "analysis",
                "intent_filter": filters,
                "data": serialized_issues,
                "summary": summary
            }
        except Exception as e:
             return {"type": "chat", "summary": f"Analysis failed: {str(e)}"}

    else: # 'chat'
        try:
             # Simple chat completion
            response = openai_service.client.chat.completions.create(
                model=openai_service.model,
                messages=[{"role": "user", "content": request.message}]
            )
            return {
                "type": "chat",
                "summary": response.choices[0].message.content
            }
        except Exception as e:
            return {"type": "chat", "summary": f"Error: {str(e)}"}
@router.post("/test-connection")
def test_connection(
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_openai_url: Optional[str] = Header(None, alias="X-OpenAI-URL"),
    x_openai_model: Optional[str] = Header(None, alias="X-OpenAI-Model"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Test OpenAI connection. 
    If x_openai_key is provided and not "******", uses it.
    Otherwise, uses the stored key from the database.
    """
    api_key = None
    base_url = x_openai_url
    model = x_openai_model

    if x_openai_key and x_openai_key != "******":
        api_key = x_openai_key
    else:
        # Load from DB
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
        if not settings or not settings.openai_key:
            raise HTTPException(status_code=400, detail="OpenAI settings not configured. Please provide an API key.")
        api_key = settings.openai_key
        if not base_url:
            base_url = settings.openai_url
        if not model:
            model = settings.openai_model

    if not base_url:
        base_url = "https://api.openai.com/v1"
    if not model:
        model = "gpt-4o-mini"
    
    try:
        service = OpenAIService(api_key=api_key, base_url=base_url, model=model)
        # Simple test
        service.client.chat.completions.create(
            model=service.model,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")
