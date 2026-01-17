from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.services.openai_service import OpenAIService
from app.services.redmine_client import RedmineService
from app.models import TimeEntryExtraction

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
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_openai_url: Optional[str] = Header("https://testpega.openai.com/v1", alias="X-OpenAI-URL"),
    x_openai_model: Optional[str] = Header("gpt-4o-mini", alias="X-OpenAI-Model")
):
    """
    接收自然語言，使用 OpenAI 解析出工時結構。
    API Key 需由前端 Header 帶入，不存資料庫。
    """
    if not x_openai_key:
        raise HTTPException(status_code=401, detail="Missing X-OpenAI-Key header")

    service = OpenAIService(api_key=x_openai_key, base_url=x_openai_url, model=x_openai_model)
    try:
        result = service.extract_time_entry(request.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-time-entry")
def submit_time_entry(
    request: ChatTimeEntryRequest,
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """
    確認後提交工時到 Redmine。
    """
    if not x_redmine_url or not x_redmine_key:
        raise HTTPException(status_code=401, detail="Missing Redmine credentials in header")

    redmine = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
    success = redmine.create_time_entry(
        issue_id=request.issue_id,
        hours=request.hours,
        activity_id=request.activity_id,
        comments=request.comments
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create time entry in Redmine")
    
@router.post("/message")
def unified_chat(
    request: ChatParseRequest,
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_openai_url: Optional[str] = Header(None, alias="X-OpenAI-URL"),
    x_openai_model: Optional[str] = Header("gpt-4o-mini", alias="X-OpenAI-Model"),
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """
    Unified Chat Endpoint.
    Automatically detects intent: 'time_entry' vs 'analysis' vs 'chat'.
    """
    if not x_openai_key:
        raise HTTPException(status_code=401, detail="Missing X-OpenAI-Key header")
    
    openai_service = OpenAIService(api_key=x_openai_key, base_url=x_openai_url, model=x_openai_model)
    
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
        if not x_redmine_url or not x_redmine_key:
             return {"type": "chat", "summary": "I need Redmine credentials to perform analysis. Please check your settings."}
        
        try:
             # Reuse Analysis Workflow Logic
            filters = openai_service.extract_query_filter(request.message)
            if "limit" not in filters: filters["limit"] = 20
            
            redmine_service = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
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
