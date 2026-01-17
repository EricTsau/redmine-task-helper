from fastapi import APIRouter, Depends, Header, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

class ProjectResponse(BaseModel):
    id: int
    name: str
    identifier: str
    parent_id: Optional[int] = None

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key")
):
    """List all projects visible to the user. Requires Redmine credentials in headers."""
    
    if not x_redmine_url or not x_redmine_key:
        raise HTTPException(status_code=401, detail="Missing Redmine credentials in header")

    service = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
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
