from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select
from app.database import get_session
from app.models import AppSettings
import httpx

router = APIRouter()

class RewriteRequest(BaseModel):
    text: str
    style: Optional[str] = "professional"  # professional, casual, formal, concise

class RewriteResponse(BaseModel):
    original: str
    rewritten: str

def get_ai_settings(session: Session):
    """Get AI settings from database"""
    settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not settings:
        return None, None, None
    return settings.openai_url, settings.openai_key, settings.openai_model

@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_text(request: RewriteRequest, session: Session = Depends(get_session)):
    openai_url, openai_key, openai_model = get_ai_settings(session)
    
    if not openai_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured. Please set it in Settings.")
    
    style_prompts = {
        "professional": "Rewrite this text to be clear and professional:",
        "casual": "Rewrite this text in a friendly, casual tone:",
        "formal": "Rewrite this text in a formal, business-appropriate tone:",
        "concise": "Make this text more concise while keeping the meaning:",
    }
    
    prompt = style_prompts.get(request.style, style_prompts["professional"])
    base_url = openai_url or "https://api.openai.com/v1"
    model = openai_model or "gpt-4o-mini"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful writing assistant. Only output the rewritten text, no explanations."},
                        {"role": "user", "content": f"{prompt}\n\n{request.text}"}
                    ],
                    "max_tokens": 1000
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            rewritten = data["choices"][0]["message"]["content"].strip()
            return RewriteResponse(original=request.text, rewritten=rewritten)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"OpenAI API error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@router.post("/test")
async def test_openai(session: Session = Depends(get_session)):
    """Test OpenAI connection with a simple request"""
    openai_url, openai_key, openai_model = get_ai_settings(session)
    
    if not openai_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")
    
    base_url = openai_url or "https://api.openai.com/v1"
    model = openai_model or "gpt-4o-mini"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Say 'OK'"}],
                    "max_tokens": 5
                },
                timeout=10.0
            )
            response.raise_for_status()
            return {"success": True, "model": model}
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"API error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
