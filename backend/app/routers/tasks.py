from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

# For MVP Stage 1 without DB, we require credentials in headers for list/search
# Later this will be replaced by reading from local DB

def get_redmine_service(
    x_redmine_url: str = Header(..., alias="X-Redmine-Url"),
    x_redmine_key: str = Header(..., alias="X-Redmine-Key")
) -> RedmineService:
    return RedmineService(x_redmine_url, x_redmine_key)

class TaskResponse(BaseModel):
    id: int
    subject: str
    project_name: str
    status_name: str
    updated_on: str

@router.get("/", response_model=List[TaskResponse])
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
