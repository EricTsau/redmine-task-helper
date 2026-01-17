from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_redmine_service
from app.services.redmine_client import RedmineService

router = APIRouter(tags=["issues"])


@router.get("/{issue_id}")
def get_issue_details(
    issue_id: int,
    redmine: RedmineService = Depends(get_redmine_service)
):
    """
    Get issue details including description and journals (history notes).
    Journals are sorted by created_on descending (newest first).
    """
    result = redmine.get_issue_with_journals(issue_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
    
    # Sort journals by created_on descending (newest first)
    result['journals'] = sorted(
        result['journals'],
        key=lambda j: j['created_on'],
        reverse=True
    )
    
    return result
