from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime
from app.database import get_session
from app.models import TimerSession, TimerSpan, AppSettings
from app.services.openai_service import OpenAIService

router = APIRouter(tags=["timer"])

def calculate_duration(session: TimerSession, current_span: Optional[TimerSpan] = None) -> int:
    """Calculate total duration including completed spans + current running span."""
    total = session.total_duration
    if session.status == "running" and current_span:
        now = datetime.utcnow()
        start = current_span.start_time or now
        total += int((now - start).total_seconds())
    return total

@router.get("/current")
def get_current_timer(session: Session = Depends(get_session)):
    """Get the currently running or paused timer session."""
    timer_session = session.exec(
        select(TimerSession)
        .where(TimerSession.status.in_(["running", "paused"]))
        .order_by(TimerSession.start_time.desc())
    ).first()

    if not timer_session:
        return None

    current_span = None
    if timer_session.status == "running":
        current_span = session.exec(
            select(TimerSpan)
            .where(TimerSpan.session_id == timer_session.id)
            .where(TimerSpan.end_time == None)
        ).first()

    duration = calculate_duration(timer_session, current_span)

    return {
        "id": timer_session.id,
        "issue_id": timer_session.redmine_issue_id,
        "start_time": timer_session.start_time,
        "duration": duration,
        "status": timer_session.status,
        "is_running": timer_session.status == "running",
        "content": timer_session.content
    }

@router.post("/start")
def start_timer(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    issue_id = data.get("issue_id")
    if not issue_id:
        raise HTTPException(status_code=400, detail="issue_id required")

    # 1. Check for any running session
    active_session = session.exec(
        select(TimerSession)
        .where(TimerSession.status == "running")
    ).first()

    if active_session:
        if active_session.redmine_issue_id == issue_id:
            return get_current_timer(session) # Already running
        else:
            # Pause other task
            active_session.status = "paused"
            active_span = session.exec(
                select(TimerSpan)
                .where(TimerSpan.session_id == active_session.id)
                .where(TimerSpan.end_time == None)
            ).first()
            if active_span:
                active_span.end_time = datetime.utcnow()
                active_session.total_duration += int((active_span.end_time - active_span.start_time).total_seconds())
                session.add(active_span)
            session.add(active_session)
            session.commit()

    # 2. Check if we have a paused session for THIS issue to resume
    paused_session = session.exec(
        select(TimerSession)
        .where(TimerSession.redmine_issue_id == issue_id)
        .where(TimerSession.status == "paused")
        .order_by(TimerSession.start_time.desc())
    ).first()

    target_session = paused_session

    if not target_session:
        # Create new session
        target_session = TimerSession(
            redmine_issue_id=issue_id,
            status="running"
        )
        session.add(target_session)
        session.commit()
        session.refresh(target_session)
    else:
        # Resume
        target_session.status = "running"
        session.add(target_session)
        session.commit()

    # Create new span
    new_span = TimerSpan(session_id=target_session.id)
    session.add(new_span)
    session.commit()

    return get_current_timer(session)

@router.post("/pause")
def pause_timer(session: Session = Depends(get_session)):
    active_session = session.exec(
        select(TimerSession).where(TimerSession.status == "running")
    ).first()

    if not active_session:
        raise HTTPException(status_code=404, detail="No running timer")

    active_span = session.exec(
        select(TimerSpan)
        .where(TimerSpan.session_id == active_session.id)
        .where(TimerSpan.end_time == None)
    ).first()

    if active_span:
        active_span.end_time = datetime.utcnow()
        active_session.total_duration += int((active_span.end_time - active_span.start_time).total_seconds())
        session.add(active_span)

    active_session.status = "paused"
    session.add(active_session)
    session.commit()
    
    return get_current_timer(session)

@router.post("/stop")
def stop_timer(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    timer_session = session.exec(
        select(TimerSession)
        .where(TimerSession.status.in_(["running", "paused"]))
    ).first()

    if not timer_session:
        return {"status": "no_active_timer"}

    if timer_session.status == "running":
        active_span = session.exec(
            select(TimerSpan)
            .where(TimerSpan.session_id == timer_session.id)
            .where(TimerSpan.end_time == None)
        ).first()
        if active_span:
            active_span.end_time = datetime.utcnow()
            timer_session.total_duration += int((active_span.end_time - active_span.start_time).total_seconds())
            session.add(active_span)

    timer_session.status = "stopped"
    timer_session.end_time = datetime.utcnow()
    
    comment = data.get("comment")
    if comment:
        timer_session.content = comment

    session.add(timer_session)
    session.commit()
    
    return get_current_timer(session)

@router.post("/log/update")
def update_log(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    timer_session = session.exec(
        select(TimerSession)
        .where(TimerSession.status.in_(["running", "paused"]))
    ).first()
    
    if not timer_session:
         raise HTTPException(status_code=404, detail="No active session")
         
    content = data.get("content")
    if content is not None:
        timer_session.content = content
        session.add(timer_session)
        session.commit()
        
    return {"status": "updated", "content": timer_session.content}

@router.post("/log/refine")
def refine_log(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    content = data.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    
    settings = session.get(AppSettings, 1)
    if not settings or not settings.openai_key:
         raise HTTPException(status_code=400, detail="OpenAI not configured")
         
    ai_service = OpenAIService(api_key=settings.openai_key, base_url=settings.openai_url, model=settings.openai_model)
    refined = ai_service.refine_log_content(content)
    
    return {"content": refined}

@router.post("/submit")
def submit_time_entry(
    data: dict = Body(...),
    x_redmine_url: Optional[str] = Header(None, alias="X-Redmine-Url"),
    x_redmine_key: Optional[str] = Header(None, alias="X-Redmine-Key"),
    session: Session = Depends(get_session)
):
    if not x_redmine_url or not x_redmine_key:
        raise HTTPException(status_code=401, detail="Missing Redmine credentials")
        
    session_id = data.get("session_id")
    timer_session = None
    if session_id:
        timer_session = session.get(TimerSession, session_id)
    else:
         timer_session = session.exec(
            select(TimerSession)
            .where(TimerSession.status == "stopped")
            .where(TimerSession.is_synced == False)
            .order_by(TimerSession.end_time.desc())
        ).first()

    if not timer_session:
        raise HTTPException(status_code=404, detail="No submit-able session found")
        
    hours = round(timer_session.total_duration / 3600.0, 2)
    if hours < 0.1: hours = 0.1
    
    comments = data.get("comments") or timer_session.content or "Worked on task"
    activity_id = data.get("activity_id", 9)

    from app.services.redmine_client import RedmineService
    redmine = RedmineService(url=x_redmine_url, api_key=x_redmine_key)
    
    success = redmine.create_time_entry(
        issue_id=timer_session.redmine_issue_id,
        hours=hours,
        activity_id=activity_id,
        comments=comments
    )
    
    if success:
        timer_session.is_synced = True
        timer_session.synced_at = datetime.utcnow()
        session.add(timer_session)
        session.commit()
        return {"status": "submitted", "hours": hours, "issue_id": timer_session.redmine_issue_id}
    else:
        raise HTTPException(status_code=500, detail="Redmine submission failed")
