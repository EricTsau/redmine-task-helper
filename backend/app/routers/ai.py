from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import httpx

router = APIRouter()

class RewriteRequest(BaseModel):
    text: str
    style: Optional[str] = "professional"  # professional, casual, formal, concise

class RewriteResponse(BaseModel):
    original: str
    rewritten: str

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_text(request: RewriteRequest):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    style_prompts = {
        "professional": "Rewrite this text to be clear and professional:",
        "casual": "Rewrite this text in a friendly, casual tone:",
        "formal": "Rewrite this text in a formal, business-appropriate tone:",
        "concise": "Make this text more concise while keeping the meaning:",
    }
    
    prompt = style_prompts.get(request.style, style_prompts["professional"])
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
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
