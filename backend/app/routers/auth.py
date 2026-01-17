from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from app.database import get_session
from app.models import User, LDAPSettings, AuthSource, AppSettings
from app.auth_utils import verify_password, create_access_token, get_password_hash
from app.services.ldap_service import LDAPService
from app.dependencies import get_current_user

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    is_admin: bool

class LoginRequest(BaseModel):
    username: str
    password: str
    auth_source: AuthSource = AuthSource.STANDARD

@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.username == request.username)).first()
    
    if request.auth_source == AuthSource.LDAP:
        # Check if LDAP is enabled globally
        app_settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
        if not app_settings or not app_settings.ldap_enabled:
            raise HTTPException(status_code=400, detail="LDAP login is not enabled")

        ldap_settings = session.exec(select(LDAPSettings).where(LDAPSettings.id == 1)).first()
        if not ldap_settings or not ldap_settings.is_active:
             raise HTTPException(status_code=400, detail="LDAP is not configured or inactive")
        
        ldap_service = LDAPService(ldap_settings)
        if ldap_service.authenticate(request.username, request.password):
            # If user doesn't exist locally, create them
            if not user:
                user_info = ldap_service.get_user_info(request.username)
                user = User(
                    username=request.username,
                    full_name=user_info.get("full_name") if user_info else None,
                    email=user_info.get("email") if user_info else None,
                    auth_source=AuthSource.LDAP,
                    is_admin=False # LDAP users are not admins by default
                )
                session.add(user)
                session.commit()
                session.refresh(user)
            elif user.auth_source != AuthSource.LDAP:
                 raise HTTPException(status_code=400, detail="User exists but not as LDAP user")
        else:
            raise HTTPException(status_code=401, detail="Invalid LDAP credentials")
    else:
        # Standard login
        if not user or user.auth_source != AuthSource.STANDARD:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        if not verify_password(request.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username,
        "is_admin": user.is_admin
    }

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "auth_source": current_user.auth_source
    }

class PasswordChangeRequest(BaseModel):
    old_password: Optional[str] = None
    new_password: str

@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.auth_source == AuthSource.LDAP:
        raise HTTPException(status_code=400, detail="LDAP users cannot change password here")
    
    if current_user.hashed_password and not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid old password")
    
    current_user.hashed_password = get_password_hash(request.new_password)
    session.add(current_user)
    session.commit()
    return {"status": "success"}

@router.get("/validate")
async def validate_redmine_credentials(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check if the current user has Redmine credentials configured and if they are valid.
    """
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
    if not settings or not settings.redmine_url or not settings.api_key:
        raise HTTPException(status_code=400, detail="Redmine not configured")
    
    from app.services.redmine_client import RedmineService
    service = RedmineService(settings.redmine_url, settings.api_key)
    try:
        service.get_current_user()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Redmine credentials")

@router.get("/ldap-status")
async def get_ldap_status(session: Session = Depends(get_session)):
    app_settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    return {"ldap_enabled": app_settings.ldap_enabled if app_settings else False}
