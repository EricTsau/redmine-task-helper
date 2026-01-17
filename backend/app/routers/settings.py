from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models import AppSettings
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

class SettingsResponse(BaseModel):
    redmine_url: Optional[str] = None
    redmine_token: Optional[str] = None  # Masked
    redmine_default_activity_id: Optional[int] = None
    openai_url: Optional[str] = None
    openai_key: Optional[str] = None  # Masked
    openai_model: Optional[str] = None

def mask_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return "******"

@router.get("", response_model=SettingsResponse)
async def get_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
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
        openai_model=settings.openai_model
    )

@router.put("", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate, session: Session = Depends(get_session)):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    
    if not settings:
        settings = AppSettings(id=1)
    
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
        openai_model=settings.openai_model
    )
