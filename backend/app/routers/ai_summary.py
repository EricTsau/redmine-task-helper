from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime
import json
import httpx
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
    gitlab_project_ids: List[int] = []

class SettingsResponse(BaseModel):
    target_project_ids: List[int]
    target_user_ids: List[int]
    target_gitlab_project_ids: List[int]

class SummaryRequest(BaseModel):
    start_date: str
    end_date: str
    language: Optional[str] = "zh-TW"

class ReportResponse(BaseModel):
    id: int
    title: str
    date_range_start: str
    date_range_end: str
    summary_markdown: str
    gitlab_metrics: str = "{}"
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
    settings = service.get_settings()
    return {
        "target_project_ids": json.loads(settings.target_project_ids),
        "target_user_ids": json.loads(settings.target_user_ids),
        "target_gitlab_project_ids": json.loads(settings.target_gitlab_project_ids)
    }

@router.put("/settings", response_model=SettingsResponse)
def update_settings(
    update: SettingsUpdate,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    settings = service.update_settings(update.project_ids, update.user_ids, update.gitlab_project_ids)
    return {
        "target_project_ids": json.loads(settings.target_project_ids),
        "target_user_ids": json.loads(settings.target_user_ids),
        "target_gitlab_project_ids": json.loads(settings.target_gitlab_project_ids)
    }

@router.post("/generate", response_model=ReportResponse)
async def generate_summary(
    request: SummaryRequest,
    service: WorkSummaryService = Depends(get_work_summary_service)
):
    try:
        if not request.end_date:
            request.end_date = datetime.now().strftime("%Y-%m-%d")

        report = await service.generate_summary(request.start_date, request.end_date, request.language or "zh-TW")
        return {
            "id": report.id,
            "title": report.title,
            "date_range_start": report.date_range_start,
            "date_range_end": report.date_range_end,
            "summary_markdown": report.summary_markdown,
            "gitlab_metrics": report.gitlab_metrics,
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
            "gitlab_metrics": r.gitlab_metrics,
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
            "gitlab_metrics": updated_report.gitlab_metrics,
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

@router.get("/redmine-image")
async def proxy_redmine_image(
    url: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    代理 Redmine 圖片請求，使用用戶的 Redmine 認證信息
    """
    print(f"[DEBUG] Proxying image request for user {current_user.id}: {url}")
    
    # 獲取用戶的 Redmine 設置
    from app.models import UserSettings
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    
    if not settings or not settings.redmine_url or not settings.api_key:
        print(f"[ERROR] Redmine not configured for user {current_user.id}")
        raise HTTPException(status_code=400, detail="Redmine not configured for this user")
    
    print(f"[DEBUG] User Redmine settings - URL: {settings.redmine_url}, API Key exists: {bool(settings.api_key)}")
    
    # 驗證請求的 URL 是否屬於用戶配置的 Redmine 伺服器
    # 使用更寬鬆的驗證，允許子路徑和查詢參數
    from urllib.parse import urlparse
    redmine_domain = urlparse(settings.redmine_url).netloc
    image_domain = urlparse(url).netloc
    
    print(f"[DEBUG] Domain check - Redmine: {redmine_domain}, Image: {image_domain}")
    
    if redmine_domain != image_domain:
        error_msg = f"Invalid image URL domain. Expected: {redmine_domain}, Got: {image_domain}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    
    try:
        # 使用用戶的 Redmine API 金鑰作為認證
        async with httpx.AsyncClient() as client:
            print(f"[DEBUG] Making request to Redmine with API key: {settings.api_key[:5]}...")
            response = await client.get(
                url,
                headers={
                    "X-Redmine-API-Key": settings.api_key
                },
                timeout=30.0
            )
            
            print(f"[DEBUG] Redmine response status: {response.status_code}")
            
            # 檢查響應狀態
            if response.status_code != 200:
                error_msg = f"Failed to fetch image from Redmine (Status: {response.status_code}, URL: {url})"
                print(f"[ERROR] {error_msg}")
                raise HTTPException(status_code=response.status_code, detail=error_msg)
            
            content_type = response.headers.get("content-type", "image/jpeg")
            print(f"[DEBUG] Image content type: {content_type}")
            
            # 返回圖片內容
            return Response(
                content=response.content,
                media_type=content_type,
                status_code=200
            )
    except httpx.RequestError as e:
        error_msg = f"Error fetching image from {url}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"Unexpected error while fetching image from {url}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
