from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlmodel import Session, select
from typing import List, Optional
from app.database import get_session
from app.models import ProjectWatchlist, User, UserSettings
from app.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter(tags=["watchlist"])

class WatchlistCreate(BaseModel):
    redmine_project_id: int
    project_name: str

@router.get("/", response_model=List[ProjectWatchlist])
def get_watchlist(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Get all watched projects for the current user."""
    watchlist = session.exec(select(ProjectWatchlist).where(ProjectWatchlist.owner_id == current_user.id)).all()
    return watchlist

@router.post("/", response_model=ProjectWatchlist)
def add_to_watchlist(
    project: WatchlistCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a project to the watchlist."""
    # Check if exists
    existing = session.exec(
        select(ProjectWatchlist).where(
            (ProjectWatchlist.redmine_project_id == project.redmine_project_id)
            & (ProjectWatchlist.owner_id == current_user.id)
        )
    ).first()
    if existing:
        return existing
    
    new_watch = ProjectWatchlist(
        owner_id=current_user.id,
        redmine_project_id=project.redmine_project_id,
        project_name=project.project_name,
    )
    session.add(new_watch)
    session.commit()
    session.refresh(new_watch)
    return new_watch

@router.delete("/{project_id}")
def remove_from_watchlist(project_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Remove a project from watchlist by Redmine Project ID."""
    watch_item = session.exec(
        select(ProjectWatchlist).where(
            (ProjectWatchlist.redmine_project_id == project_id)
            & (ProjectWatchlist.owner_id == current_user.id)
        )
    ).first()
    if not watch_item:
        raise HTTPException(status_code=404, detail="Project not found in watchlist")
    
    session.delete(watch_item)
    session.commit()
@router.get("/stats")
def get_watchlist_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """
    Get stats for all watched projects.
    Requires Redmine credentials in headers or user settings.
    """
    watchlist = session.exec(select(ProjectWatchlist).where(ProjectWatchlist.owner_id == current_user.id)).all()
    
    # Handle missing or masked credentials by falling back to DB
    if not x_redmine_url or not x_redmine_key or x_redmine_key == "******":
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == current_user.id)).first()
        if settings:
            if not x_redmine_url:
                x_redmine_url = settings.redmine_url
            if not x_redmine_key or x_redmine_key == "******":
                x_redmine_key = settings.api_key

    if not x_redmine_url or not x_redmine_key:
        # Return empty stats if no credentials provided (or handle as 401)
        # Choosing to return empty stats structure for UI flexibility
        return []

    from app.services.redmine_client import RedmineService
    
    try:
        service = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
        
        stats_results = []
        for item in watchlist:
            try:
                stats = service.get_project_stats(item.redmine_project_id)
                stats_results.append({
                    "id": item.id,
                    "redmine_project_id": item.redmine_project_id,
                    "project_name": item.project_name,
                    "open_issues_count": stats.get("open_issues_count", 0)
                })
            except Exception as e:
                print(f"Error fetching stats for project {item.id}: {e}")
                stats_results.append({
                    "id": item.id,
                    "redmine_project_id": item.redmine_project_id,
                    "project_name": item.project_name,
                    "open_issues_count": 0
                })
            
        return stats_results
    except Exception as e:
        print(f"Error initializing RedmineService: {e}")
        return []
