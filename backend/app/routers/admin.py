import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import User, LDAPSettings, AuthSource, AppSettings, UserSettings
from app.auth_utils import get_password_hash
from app.dependencies import get_admin_user

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = False
    auth_source: AuthSource = AuthSource.STANDARD

class BulkUserCreate(BaseModel):
    users: List[UserCreate]
    common_password: Optional[str] = None
    generate_random: bool = False

@router.get("/users")
async def list_users(session: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    return session.exec(select(User)).all()

@router.post("/users")
async def create_user(user_in: UserCreate, session: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    existing = session.exec(select(User).where(User.username == user_in.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pwd = None
    if user_in.auth_source == AuthSource.STANDARD:
        if not user_in.password:
            raise HTTPException(status_code=400, detail="Password required for standard user")
        hashed_pwd = get_password_hash(user_in.password)
    
    user = User(
        username=user_in.username,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        email=user_in.email,
        is_admin=user_in.is_admin,
        auth_source=user_in.auth_source
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.post("/users/bulk")
async def bulk_create_users(
    request: BulkUserCreate, 
    session: Session = Depends(get_session), 
    admin: User = Depends(get_admin_user)
):
    results = []
    for u in request.users:
        password = request.common_password
        if request.generate_random:
            password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
        
        try:
            hashed_pwd = get_password_hash(password) if password else None
            user = User(
                username=u.username,
                hashed_password=hashed_pwd,
                full_name=u.full_name,
                email=u.email,
                is_admin=u.is_admin,
                auth_source=u.auth_source
            )
            session.add(user)
            results.append({"username": u.username, "password": password if request.generate_random else "******", "status": "created"})
        except Exception as e:
            results.append({"username": u.username, "status": "error", "message": str(e)})
    
    session.commit()
    return results

@router.get("/ldap-settings")
async def get_ldap_settings(session: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    settings = session.exec(select(LDAPSettings).where(LDAPSettings.id == 1)).first()
    if not settings:
        settings = LDAPSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

@router.put("/ldap-settings")
async def update_ldap_settings(
    settings_in: LDAPSettings, 
    session: Session = Depends(get_session), 
    admin: User = Depends(get_admin_user)
):
    settings = session.exec(select(LDAPSettings).where(LDAPSettings.id == 1)).first()
    if not settings:
        settings = LDAPSettings(id=1)
    
    for key, value in settings_in.dict(exclude={"id"}).items():
        setattr(settings, key, value)
    
    session.add(settings)
    
    # Also update global AppSettings ldap_enabled
    app_settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not app_settings:
        app_settings = AppSettings(id=1)
    app_settings.ldap_enabled = settings.is_active
    session.add(app_settings)
    
    session.commit()
    return settings
@router.patch("/users/{user_id}/role")
async def toggle_user_role(
    user_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_admin = not user.is_admin
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get("/app-settings")
async def get_app_settings(session: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not settings:
        settings = AppSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

@router.put("/app-settings")
async def update_app_settings(
    settings_in: AppSettings, 
    session: Session = Depends(get_session), 
    admin: User = Depends(get_admin_user)
):
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not settings:
        settings = AppSettings(id=1)
    
    # Update fields
    settings.ldap_enabled = settings_in.ldap_enabled
    settings.enable_ai_debug_dump = settings_in.enable_ai_debug_dump
    settings.max_concurrent_chunks = settings_in.max_concurrent_chunks
    
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
