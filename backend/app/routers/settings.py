from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models import AppSettings
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class SettingsUpdate(BaseModel):
    redmine_url: str
    api_key: str

class SettingsResponse(BaseModel):
    redmine_url: Optional[str] = None
    api_key: Optional[str] = None # Masked

@router.get("/", response_model=SettingsResponse)
async def get_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not settings:
        return SettingsResponse()
    
    masked_key = "******" if settings.api_key else None
    return SettingsResponse(redmine_url=settings.redmine_url, api_key=masked_key)

@router.put("/", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate, session: Session = Depends(get_session)):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not settings:
        settings = AppSettings(id=1, redmine_url=update.redmine_url, api_key=update.api_key)
        session.add(settings)
    else:
        settings.redmine_url = update.redmine_url
        if update.api_key != "******": # meaningful check
             settings.api_key = update.api_key
        session.add(settings)
    
    session.commit()
    session.refresh(settings)
    
    return SettingsResponse(redmine_url=settings.redmine_url, api_key="******")
