from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime

from app.database import get_session
from app.models import User, GitLabInstance, GitLabWatchlist
from app.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter()

class GitLabInstanceCreate(BaseModel):
    instance_name: str
    url: str
    personal_access_token: str
    target_users_json: Optional[str] = "[]"
    target_projects_json: Optional[str] = "[]"

class GitLabWatchlistCreate(BaseModel):
    instance_id: int
    gitlab_project_id: int
    project_name: str
    project_path_with_namespace: str
    is_included: Optional[bool] = True

@router.post("/instances", response_model=GitLabInstance)
async def create_instance(
    data: GitLabInstanceCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = GitLabInstance(
        owner_id=user.id,
        instance_name=data.instance_name,
        url=data.url,
        personal_access_token=data.personal_access_token,
        target_users_json=data.target_users_json,
        target_projects_json=data.target_projects_json,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance

@router.put("/instances/{instance_id}", response_model=GitLabInstance)
async def update_instance(
    instance_id: int,
    data: GitLabInstanceCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    instance.instance_name = data.instance_name
    instance.url = data.url
    instance.personal_access_token = data.personal_access_token
    instance.target_users_json = data.target_users_json
    instance.target_projects_json = data.target_projects_json
    instance.updated_at = datetime.utcnow()
    
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance

@router.get("/instances", response_model=List[GitLabInstance])
async def get_instances(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(
        select(GitLabInstance).where(GitLabInstance.owner_id == user.id)
    ).all()

@router.delete("/instances/{instance_id}")
async def delete_instance(
    instance_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Also delete associated watchlists
    watchlists = session.exec(
        select(GitLabWatchlist).where(GitLabWatchlist.instance_id == instance_id)
    ).all()
    for wl in watchlists:
        session.delete(wl)
        
    session.delete(instance)
    session.commit()
    return {"message": "Instance deleted"}

@router.post("/watchlists", response_model=GitLabWatchlist)
async def create_watchlist(
    data: GitLabWatchlistCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Verify instance belongs to user
    instance = session.get(GitLabInstance, data.instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Instance access denied")

    watchlist = GitLabWatchlist(
        owner_id=user.id,
        instance_id=data.instance_id,
        gitlab_project_id=data.gitlab_project_id,
        project_name=data.project_name,
        project_path_with_namespace=data.project_path_with_namespace,
        is_included=data.is_included,
        created_at=datetime.utcnow()
    )
    session.add(watchlist)
    session.commit()
    session.refresh(watchlist)
    return watchlist

@router.put("/watchlists/{watchlist_id}", response_model=GitLabWatchlist)
async def update_watchlist(
    watchlist_id: int,
    data: GitLabWatchlistCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    watchlist = session.get(GitLabWatchlist, watchlist_id)
    if not watchlist or watchlist.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    watchlist.is_included = data.is_included
    session.add(watchlist)
    session.commit()
    session.refresh(watchlist)
    return watchlist

@router.get("/watchlists", response_model=List[GitLabWatchlist])
async def get_watchlists(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(
        select(GitLabWatchlist).where(GitLabWatchlist.owner_id == user.id)
    ).all()

@router.delete("/watchlists/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    watchlist = session.get(GitLabWatchlist, watchlist_id)
    if not watchlist or watchlist.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    session.delete(watchlist)
    session.commit()
    return {"message": "Watchlist deleted"}
