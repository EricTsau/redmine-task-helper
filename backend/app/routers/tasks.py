from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

# For MVP Stage 1 without DB, we require credentials in headers for list/search
# Later this will be replaced by reading from local DB

from app.dependencies import get_redmine_service

class TaskResponse(BaseModel):
    id: int
    subject: str
    project_name: str
    status_name: str
    updated_on: str

@router.get("", response_model=List[TaskResponse])
async def list_tasks(service: RedmineService = Depends(get_redmine_service)):
    """List issues assigned to the current user."""
    issues = service.get_my_tasks()
    return [
        TaskResponse(
            id=issue.id,
            subject=issue.subject,
            project_name=issue.project.name,
            status_name=issue.status.name,
            updated_on=str(issue.updated_on)
        ) for issue in issues
    ]


class SearchTaskResponse(BaseModel):
    id: int
    subject: str
    project_id: int
    project_name: str
    status_id: int
    status_name: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    updated_on: str


@router.get("/search", response_model=List[SearchTaskResponse])
async def search_tasks(
    project_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    updated_after: Optional[str] = None,
    limit: int = 50,
    service: RedmineService = Depends(get_redmine_service)
):
    """
    Search Redmine issues with flexible filters.
    
    Parameters:
    - project_id: Filter by project ID
    - assigned_to: 'me' or user ID
    - status: 'open', 'closed', or 'all'
    - q: Keyword search in subject
    - updated_after: ISO date string (YYYY-MM-DD)
    - limit: Maximum number of results (default 50)
    """
    issues = service.search_issues_advanced(
        project_id=project_id,
        assigned_to=assigned_to,
        status=status,
        query=q,
        updated_after=updated_after,
        limit=limit
    )
    
    results = []
    for issue in issues:
        assigned_id = None
        assigned_name = None
        if hasattr(issue, 'assigned_to') and issue.assigned_to:
            assigned_id = issue.assigned_to.id
            assigned_name = issue.assigned_to.name
        
        results.append(SearchTaskResponse(
            id=issue.id,
            subject=issue.subject,
            project_id=issue.project.id,
            project_name=issue.project.name,
            status_id=issue.status.id,
            status_name=issue.status.name,
            assigned_to_id=assigned_id,
            assigned_to_name=assigned_name,
            updated_on=str(issue.updated_on)
        ))
    
    return results
