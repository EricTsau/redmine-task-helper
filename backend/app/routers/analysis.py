from fastapi import APIRouter, HTTPException, Header, Body
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.services.openai_service import OpenAIService
from app.services.redmine_client import RedmineService

router = APIRouter(tags=["analysis"])

class AnalysisQuery(BaseModel):
    query: str

@router.post("/query")
async def analyze_query(
    request: AnalysisQuery,
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_openai_url: Optional[str] = Header(None, alias="X-OpenAI-URL"),
    x_openai_model: Optional[str] = Header("gpt-4o-mini", alias="X-OpenAI-Model"),
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """
    3-Phase Conversational BI Workflow:
    1. Intent: AI converts natural language to Redmine filter.
    2. Execution: Fetch data from Redmine.
    3. Insight: AI summarizes the results.
    """
    if not x_openai_key:
        raise HTTPException(status_code=401, detail="Missing X-OpenAI-Key")
    if not x_redmine_url or not x_redmine_key:
        raise HTTPException(status_code=401, detail="Missing Redmine credentials")

    # 1. Intent Extraction
    openai_service = OpenAIService(
        api_key=x_openai_key,
        base_url=x_openai_url or "https://api.openai.com/v1",
        model=x_openai_model
    )
    
    try:
        filters = openai_service.extract_query_filter(request.query)
        # Ensure limit is reasonable
        if "limit" not in filters:
            filters["limit"] = 20
        
        # 2. Execution
        redmine_service = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
        
        # Map filter keys to search_issues_advanced arguments
        # The schema from OpenAI matches the arguments of search_issues_advanced fairly well
        # but we need to handle potential type mismatches or extra keys
        
        issues = redmine_service.search_issues_advanced(
            project_id=filters.get("project_id"),
            assigned_to=filters.get("assigned_to"),
            status=filters.get("status"),
            query=filters.get("query"),
            updated_after=filters.get("updated_after"),
            limit=filters.get("limit", 20)
        )
        
        # Serialize issues for response and AI summary
        # Redmine objects need to be converted to dicts
        serialized_issues = []
        for issue in issues:
            # Basic serialization
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

        # 3. Insight Generation
        summary = openai_service.summarize_issues(serialized_issues, request.query)
        
        return {
            "intent_filter": filters,
            "data_count": len(serialized_issues),
            "data": serialized_issues,
            "summary": summary
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
