from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from app.services.redmine_client import RedmineService

router = APIRouter()

class ConnectionRequest(BaseModel):
    url: str
    api_key: str

class UserResponse(BaseModel):
    id: int
    firstname: str
    lastname: str
    mail: str = ""

@router.post("/connect")
async def connect_redmine(request: ConnectionRequest):
    """
    Validates Redmine connection credentials.
    In the future (Task 1.6), this will also save them to the database.
    """
    if not request.url or not request.api_key:
         raise HTTPException(status_code=400, detail="Missing URL or API Key")

    service = RedmineService(request.url, request.api_key)
    try:
        user = service.get_current_user()
        if not user:
             raise HTTPException(status_code=401, detail="Invalid Credentials")
        
        return {
            "status": "success", 
            "user": {
                "id": user.id,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "mail": getattr(user, 'mail', '')
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
