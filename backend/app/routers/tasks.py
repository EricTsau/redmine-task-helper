from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

# For MVP Stage 1 without DB, we require credentials in headers for list/search
# Later this will be replaced by reading from local DB

from app.dependencies import get_redmine_service

class TaskResponse(BaseModel):
    id: int
    subject: str
    project_id: int
    project_name: str
    status_id: int
    status_name: str
    estimated_hours: Optional[float] = None
    spent_hours: float = 0.0
    updated_on: str

def format_iso_datetime(dt) -> str:
    """Format datetime to ISO string with UTC timezone if naive."""
    from datetime import timezone
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt
    if hasattr(dt, 'isoformat'):
        # If naive, assume UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    return str(dt)

@router.get("/statuses")
async def get_statuses(service: RedmineService = Depends(get_redmine_service)):
    """Get all available issue statuses."""
    try:
        statuses = service.get_issue_statuses()
        return [{"id": s.id, "name": s.name, "is_closed": getattr(s, 'is_closed', False)} for s in statuses]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[TaskResponse])
async def list_tasks(service: RedmineService = Depends(get_redmine_service)):
    """List issues assigned to the current user."""
    issues = service.get_my_tasks()
    return [
        TaskResponse(
            id=issue.id,
            subject=issue.subject,
            project_id=issue.project.id,
            project_name=issue.project.name,
            status_id=issue.status.id,
            status_name=issue.status.name,
            estimated_hours=getattr(issue, 'estimated_hours', None),
            spent_hours=getattr(issue, 'spent_hours', 0.0) or getattr(issue, 'total_spent_hours', 0.0) or 0.0,
            updated_on=format_iso_datetime(issue.updated_on)
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
    estimated_hours: Optional[float] = None
    spent_hours: float = 0.0
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
            estimated_hours=getattr(issue, 'estimated_hours', None),
            spent_hours=getattr(issue, 'spent_hours', 0.0) or getattr(issue, 'total_spent_hours', 0.0) or 0.0,
            updated_on=format_iso_datetime(issue.updated_on)
        ))
    
    return results

@router.get("/{task_id}")
async def get_task_details(
    task_id: int,
    include: Optional[str] = None,
    service: RedmineService = Depends(get_redmine_service)
):
    """Get task details including journals."""
    try:
        # Check if we need to include journals
        if include and 'journals' in include:
            issue = service.get_issue_with_journals(task_id)
        else:
            # Fallback to simple get if just basic info needed (though frontend asks for journals)
            # For consistency, get_issue_with_journals is robust enough
             issue = service.get_issue_with_journals(task_id)
        
        if not issue:
             raise HTTPException(status_code=404, detail="Task not found")
             
        return issue
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateTaskRequest(BaseModel):
    project_id: int
    subject: str
    description: Optional[str] = None
    tracker_id: int
    status_id: int
    priority_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    estimated_hours: Optional[float] = None
    
@router.post("", response_model=TaskResponse)
async def create_task(
    request: CreateTaskRequest,
    service: RedmineService = Depends(get_redmine_service)
):
    """Create a new task in Redmine."""
    try:
        issue = service.create_issue(
            project_id=request.project_id,
            subject=request.subject,
            tracker_id=request.tracker_id,
            description=request.description,
            status_id=request.status_id,
            priority_id=request.priority_id,
            assigned_to_id=request.assigned_to_id,
            estimated_hours=request.estimated_hours
        )
        
        return TaskResponse(
            id=issue.id,
            subject=issue.subject,
            project_id=issue.project.id,
            project_name=issue.project.name,
            status_id=issue.status.id,
            status_name=issue.status.name,
            updated_on=format_iso_datetime(issue.updated_on)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateTaskRequest(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status_id: Optional[int] = None
    done_ratio: Optional[int] = None
    assigned_to_id: Optional[int] = None
    
@router.put("/{task_id}")
async def update_task(
    task_id: int,
    request: UpdateTaskRequest,
    service: RedmineService = Depends(get_redmine_service)
):
    """Update a task in Redmine."""
    try:
        service.redmine.issue.update(
            task_id,
            **request.model_dump(exclude_unset=True)
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AddNoteRequest(BaseModel):
    notes: str


@router.post("/{task_id}/notes")
async def add_task_note(
    task_id: int,
    request: AddNoteRequest,
    service: RedmineService = Depends(get_redmine_service)
):
    """Add a note to a task in Redmine."""
    try:
        service.add_issue_note(task_id, request.notes)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

