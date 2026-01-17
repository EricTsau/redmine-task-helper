from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.services.redmine_client import RedmineService
from app.dependencies import get_redmine_service
from typing import List
import io

router = APIRouter()

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    issue_id: int = None,
    redmine: RedmineService = Depends(get_redmine_service)
):
    """Upload image to Redmine issue as attachment"""
    if not issue_id:
        raise HTTPException(status_code=400, detail="issue_id is required")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    content = await file.read()
    
    try:
        # Wrap content in BytesIO with name attribute for python-redmine
        file_obj = io.BytesIO(content)
        file_obj.name = file.filename
        
        # Upload to Redmine
        upload = redmine.redmine.upload(file_obj, filename=file.filename)
        
        # Attach to issue
        redmine.redmine.issue.update(
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


@router.post("/batch")
async def upload_batch(
    files: List[UploadFile] = File(...),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """
    Batch upload multiple files to Redmine.
    Returns tokens that can be used when updating an issue.
    Does NOT attach to any issue - that should be done separately.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    results = []
    
    try:
        for file in files:
            content = await file.read()
            
            # Wrap content in BytesIO with name attribute for python-redmine
            file_obj = io.BytesIO(content)
            file_obj.name = file.filename
            
            upload = redmine.redmine.upload(file_obj, filename=file.filename)
            results.append({
                "filename": file.filename,
                "token": upload['token'],
                "content_type": file.content_type
            })
        
        return {
            "success": True,
            "uploads": results
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"BATCH UPLOAD ERROR:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Batch upload failed: {str(e)}")

