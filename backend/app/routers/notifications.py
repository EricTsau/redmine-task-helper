from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class NotificationRequest(BaseModel):
    title: str
    body: str
    icon: str = "/icon.png"

# Store subscriptions (in production, use database)
subscriptions: List[dict] = []

@router.post("/subscribe")
async def subscribe(subscription: dict):
    """Register a push notification subscription"""
    if subscription not in subscriptions:
        subscriptions.append(subscription)
    return {"status": "subscribed"}

@router.post("/send")
async def send_notification(notification: NotificationRequest):
    """Send notification to all subscribers (for server events)"""
    # In production, use web-push library
    # For MVP, frontend will poll or use SSE
    return {
        "title": notification.title,
        "body": notification.body,
        "sent_to": len(subscriptions)
    }

@router.get("/pending")
async def get_pending_notifications():
    """Get pending notifications (polling endpoint)"""
    # In MVP, return empty - frontend will handle via timer state
    return {"notifications": []}
