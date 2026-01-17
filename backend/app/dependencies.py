from fastapi import Depends, HTTPException, status
from sqlmodel import Session, select
from app.database import get_session
from app.models import AppSettings
from app.services.redmine_client import RedmineService

def get_redmine_service(session: Session = Depends(get_session)) -> RedmineService:
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    
    if not settings or not settings.redmine_url or not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Redmine settings not configured"
        )
    
    return RedmineService(settings.redmine_url, settings.api_key)
