from fastapi import APIRouter, Depends, Header
from typing import List, Optional
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

from app.dependencies import get_redmine_service

class ProjectResponse(BaseModel):
    id: int
    name: str
    identifier: str
    parent_id: Optional[int] = None

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(service: RedmineService = Depends(get_redmine_service)):
    """List all projects visible to the user."""
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
