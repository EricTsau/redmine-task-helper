from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from app.services.redmine_client import RedmineService
import base64

router = APIRouter()

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    issue_id: int = None,
    x_redmine_url: str = Header(..., alias="X-Redmine-Url"),
    x_redmine_key: str = Header(..., alias="X-Redmine-Key")
):
    """Upload image to Redmine issue as attachment"""
    if not issue_id:
        raise HTTPException(status_code=400, detail="issue_id is required")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    content = await file.read()
    
    service = RedmineService(x_redmine_url, x_redmine_key)
    try:
        # Upload to Redmine
        upload = service.redmine.upload(content, filename=file.filename)
        
        # Attach to issue
        issue = service.redmine.issue.get(issue_id)
        service.redmine.issue.update(
            issue_id,
            uploads=[{
                'token': upload['token'],
                'filename': file.filename,
                'content_type': file.content_type
            }]
        )
        
        return {
            "success": True,
            "filename": file.filename,
            "issue_id": issue_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
