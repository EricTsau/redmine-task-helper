from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlmodel import Session, select
from typing import List, Optional
from app.database import get_session
from app.models import ProjectWatchlist
from pydantic import BaseModel

router = APIRouter(tags=["watchlist"])

class WatchlistCreate(BaseModel):
    redmine_project_id: int
    project_name: str

@router.get("/", response_model=List[ProjectWatchlist])
def get_watchlist(session: Session = Depends(get_session)):
    """Get all watched projects."""
    watchlist = session.exec(select(ProjectWatchlist)).all()
    return watchlist

@router.post("/", response_model=ProjectWatchlist)
def add_to_watchlist(project: WatchlistCreate, session: Session = Depends(get_session)):
    """Add a project to the watchlist."""
    # Check if exists
    existing = session.exec(select(ProjectWatchlist).where(ProjectWatchlist.redmine_project_id == project.redmine_project_id)).first()
    if existing:
        return existing
    
    new_watch = ProjectWatchlist(
        redmine_project_id=project.redmine_project_id,
        project_name=project.project_name
    )
    session.add(new_watch)
    session.commit()
    session.refresh(new_watch)
    return new_watch

@router.delete("/{project_id}")
def remove_from_watchlist(project_id: int, session: Session = Depends(get_session)):
    """Remove a project from watchlist by Redmine Project ID."""
    watch_item = session.exec(select(ProjectWatchlist).where(ProjectWatchlist.redmine_project_id == project_id)).first()
    if not watch_item:
        raise HTTPException(status_code=404, detail="Project not found in watchlist")
    
    session.delete(watch_item)
    session.commit()
@router.get("/stats")
def get_watchlist_stats(
    session: Session = Depends(get_session),
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """
    Get stats for all watched projects.
    Requires Redmine credentials in headers.
    """
    watchlist = session.exec(select(ProjectWatchlist)).all()
    
    if not x_redmine_url or not x_redmine_key:
        # Return empty stats if no credentials provided (or handle as 401)
        # Choosing to return empty stats structure for UI flexibility
        return []

    from app.services.redmine_client import RedmineService
    service = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
    
    stats_results = []
    for item in watchlist:
        stats = service.get_project_stats(item.redmine_project_id)
        stats_results.append({
            "id": item.id,
            "redmine_project_id": item.redmine_project_id,
            "project_name": item.project_name,
            "open_issues_count": stats.get("open_issues_count", 0)
        })
        
    return stats_results
