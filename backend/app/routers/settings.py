from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, UserSettings
from app.dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

class SettingsUpdate(BaseModel):
    redmine_url: Optional[str] = None
    redmine_token: Optional[str] = None
    redmine_default_activity_id: Optional[int] = None
    openai_url: Optional[str] = None
    openai_key: Optional[str] = None
    openai_model: Optional[str] = None
    task_warning_days: Optional[int] = None
    task_severe_warning_days: Optional[int] = None

class SettingsResponse(BaseModel):
    redmine_url: Optional[str] = None
    redmine_token: Optional[str] = None  # Masked
    redmine_default_activity_id: Optional[int] = None
    openai_url: Optional[str] = None
    openai_key: Optional[str] = None  # Masked
    openai_model: Optional[str] = None
    task_warning_days: int = 2
    task_severe_warning_days: int = 3

def mask_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return "******"

@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    if not settings:
        return SettingsResponse(
            openai_url="https://api.openai.com/v1",
            openai_model="gpt-4o-mini"
        )
    
    return SettingsResponse(
        redmine_url=settings.redmine_url,
        redmine_token=mask_key(settings.api_key),
        redmine_default_activity_id=settings.redmine_default_activity_id,
        openai_url=settings.openai_url,
        openai_key=mask_key(settings.openai_key),
        openai_model=settings.openai_model,
        task_warning_days=settings.task_warning_days,
        task_severe_warning_days=settings.task_severe_warning_days
    )

@router.put("", response_model=SettingsResponse)
async def update_settings(
    update: SettingsUpdate, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    
    if not settings:
        settings = UserSettings(user_id=current_user.id)
    
    # Update Redmine settings
    if update.redmine_url is not None:
        settings.redmine_url = update.redmine_url
    if update.redmine_token and update.redmine_token != "******":
        settings.api_key = update.redmine_token
    if update.redmine_default_activity_id is not None:
        settings.redmine_default_activity_id = update.redmine_default_activity_id
    
    # Update OpenAI settings
    if update.openai_url is not None:
        settings.openai_url = update.openai_url
    if update.openai_key and update.openai_key != "******":
        settings.openai_key = update.openai_key
    if update.openai_model is not None:
        settings.openai_model = update.openai_model
        
    if update.task_warning_days is not None:
        settings.task_warning_days = update.task_warning_days
    if update.task_severe_warning_days is not None:
        settings.task_severe_warning_days = update.task_severe_warning_days
    
    settings.updated_at = datetime.utcnow()
    session.add(settings)
    session.commit()
    session.refresh(settings)
    
    return SettingsResponse(
        redmine_url=settings.redmine_url,
        redmine_token=mask_key(settings.api_key),
        redmine_default_activity_id=settings.redmine_default_activity_id,
        openai_url=settings.openai_url,
        openai_key=mask_key(settings.openai_key),
        openai_model=settings.openai_model,
        task_warning_days=settings.task_warning_days,
        task_severe_warning_days=settings.task_severe_warning_days
    )
