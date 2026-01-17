from fastapi import APIRouter, Depends, Header, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

from app.dependencies import get_redmine_service

router = APIRouter()

class ProjectResponse(BaseModel):
    id: int
    name: str
    identifier: str
    parent_id: Optional[int] = None

@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    service: RedmineService = Depends(get_redmine_service)
):
    """List all projects visible to the user. Uses configured Redmine settings."""
    projects = service.get_my_projects()
    
    results = []
    for project in projects:
        parent_id = None
        if hasattr(project, 'parent'):
            parent_id = project.parent.id
            
        results.append(ProjectResponse(
            id=project.id,
            name=project.name,
            identifier=project.identifier,
            parent_id=parent_id
        ))
    
    return results
@router.get("/{project_id}/metadata")
async def get_project_metadata(
    project_id: int,
    service: RedmineService = Depends(get_redmine_service)
):
    """
    Get available metadata for creating issues in a project.
    Returns trackers, priorities, issues statuses, and assignable members.
    """
    trackers = service.get_trackers()
    statuses = service.get_issue_statuses()
    priorities = service.get_priorities()
    members = service.get_project_members(project_id)
    current_redmine_user = service.get_current_user()
    
    return {
        "trackers": [{"id": t.id, "name": t.name} for t in trackers],
        "statuses": [{"id": s.id, "name": s.name} for s in statuses],
        "priorities": [{"id": p.id, "name": p.name} for p in priorities],
        "members": members,
        "current_user": {
            "id": current_redmine_user.id,
            "name": f"{current_redmine_user.firstname} {current_redmine_user.lastname}"
        } if current_redmine_user else None
    }
