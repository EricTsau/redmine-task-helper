from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_session
from app.dependencies import get_current_user, get_redmine_service, get_openai_service
from app.models import User
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.services.work_summary_service import WorkSummaryService

router = APIRouter(tags=["ai-summary"])

class SettingsUpdate(BaseModel):
    project_ids: List[int]
    user_ids: List[int]

class SettingsResponse(BaseModel):
    target_project_ids: List[int]
    target_user_ids: List[int]

class SummaryRequest(BaseModel):
    start_date: str
    end_date: str

class ReportResponse(BaseModel):
    id: int
    title: str
    date_range_start: str
    date_range_end: str
    summary_markdown: str
    created_at: str

def get_work_summary_service(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service),
    openai: OpenAIService = Depends(get_openai_service)
) -> WorkSummaryService:
    return WorkSummaryService(session, user, redmine, openai)

@router.get("/settings", response_model=SettingsResponse)
def get_settings(service: WorkSummaryService = Depends(get_work_summary_service)):
    import json
    settings = service.get_settings()
    return {
        "target_project_ids": json.loads(settings.target_project_ids),
        "target_user_ids": json.loads(settings.target_user_ids)
    }

@router.put("/settings", response_model=SettingsResponse)
def update_settings(
    update: SettingsUpdate,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    import json
    settings = service.update_settings(update.project_ids, update.user_ids)
    return {
        "target_project_ids": json.loads(settings.target_project_ids),
        "target_user_ids": json.loads(settings.target_user_ids)
    }

@router.post("/generate", response_model=ReportResponse)
async def generate_summary(
    request: SummaryRequest,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    try:
        if not request.end_date:
            request.end_date = datetime.now().strftime("%Y-%m-%d")

        report = await service.generate_summary(request.start_date, request.end_date)
        return {
            "id": report.id,
            "title": report.title,
            "date_range_start": report.date_range_start,
            "date_range_end": report.date_range_end,
            "summary_markdown": report.summary_markdown,
            "created_at": report.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[ReportResponse])
def get_history(service: WorkSummaryService = Depends(get_work_summary_service)):
    reports = service.get_history()
    return [
        {
            "id": r.id,
            "title": r.title,
            "date_range_start": r.date_range_start or "",
            "date_range_end": r.date_range_end or "",
            "summary_markdown": r.summary_markdown,
            "created_at": r.created_at.isoformat()
        }
        for r in reports
    ]

# --- Chat / Refine ---

class ChatRequest(BaseModel):
    message: str
    action: str = "chat"  # "chat" or "refine"

class ChatResponse(BaseModel):
    response: str
    updated_summary: Optional[str] = None  # Returned if action was refine

@router.post("/{report_id}/chat", response_model=ChatResponse)
async def chat_with_report(
    report_id: int,
    request: ChatRequest,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    try:
        result = await service.chat_with_report(report_id, request.message, request.action)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateReportRequest(BaseModel):
    summary_markdown: Optional[str] = None
    title: Optional[str] = None

@router.put("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    request: UpdateReportRequest,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    try:
        updated_report = service.update_report_content(report_id, request.summary_markdown, request.title)
        if not updated_report:
             raise HTTPException(status_code=404, detail="Report not found")
             
        return {
            "id": updated_report.id,
            "title": updated_report.title,
            "date_range_start": updated_report.date_range_start or "",
            "date_range_end": updated_report.date_range_end or "",
            "summary_markdown": updated_report.summary_markdown,
            "created_at": updated_report.created_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    try:
        success = service.delete_report(report_id)
        if not success:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
