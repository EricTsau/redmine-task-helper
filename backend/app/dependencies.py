from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, UserSettings, AppSettings
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.auth_utils import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    
    return user

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user

def get_redmine_service(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> RedmineService:
    # Try to get user-specific settings first
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    
    # If not found or incomplete, this will fail
    if not settings or not settings.redmine_url or not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Redmine settings not configured for this user"
        )
    
    # Create a new RedmineService instance with current settings
    # This ensures that any changes to settings are immediately reflected
    return RedmineService(settings.redmine_url, settings.api_key)

def get_openai_service(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> OpenAIService:
    # Try to get user-specific settings
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    
    if not settings or not settings.openai_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenAI settings not configured for this user"
        )
    
    # Create a new OpenAIService instance with current settings
    # This ensures that any changes to settings are immediately reflected
    return OpenAIService(
        api_key=settings.openai_key,
        base_url=settings.openai_url or "https://api.openai.com/v1",
        model=settings.openai_model or "gpt-4o-mini"
    )
