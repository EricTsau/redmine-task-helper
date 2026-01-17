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

@router.post("/log/generate")
def generate_log(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    issue_id = data.get("issue_id")
    # Need settings
    settings = session.get(AppSettings, 1)
    if not settings or not settings.openai_key:
         raise HTTPException(status_code=400, detail="OpenAI not configured")

    ai_service = OpenAIService(api_key=settings.openai_key, base_url=settings.openai_url, model=settings.openai_model)
    
    # Optional: fetch issue details if possible, or just use what's passed
    # For now, just rely on client passing minimal context or we fetch name from DB if we tracked it
    # We'll use the data passed from frontend 
    
    generated = ai_service.generate_work_log(data)
    return {"content": generated}

@router.post("/log/refine-selection")
def refine_selection(
    data: dict = Body(...),
    session: Session = Depends(get_session)
):
    selection = data.get("selection")
    instruction = data.get("instruction")
    
    if not selection or not instruction:
        raise HTTPException(status_code=400, detail="Selection and instruction required")
        
    settings = session.get(AppSettings, 1)
    if not settings or not settings.openai_key:
         raise HTTPException(status_code=400, detail="OpenAI not configured")

    ai_service = OpenAIService(api_key=settings.openai_key, base_url=settings.openai_url, model=settings.openai_model)
    result = ai_service.edit_text(selection, instruction)
    
    return {"content": result}

from app.dependencies import get_redmine_service
from app.services.redmine_client import RedmineService

@router.post("/submit")
def submit_time_entry(
    data: dict = Body(...),
    redmine: RedmineService = Depends(get_redmine_service),
    session: Session = Depends(get_session)
):
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
    
    # Resolve Activity ID dynamically
    # Resolve Activity ID dynamically
    activity_id = data.get("activity_id")
    if not activity_id:
        activities = redmine.get_valid_activities_for_issue(timer_session.redmine_issue_id)
        if activities:
            # Try to find default
            default_activity = next((a for a in activities if getattr(a, 'is_default', False)), None)
            if default_activity:
                activity_id = default_activity.id
            else:
                # Fallback to first available
                activity_id = activities[0].id
        
        if not activity_id:
             # Try fallback from AppSettings
             settings = session.get(AppSettings, 1)
             if settings and settings.redmine_default_activity_id:
                 activity_id = settings.redmine_default_activity_id
        
        if not activity_id:
             # If we cannot find any valid activity, we cannot submit.
             # Attempting to use '9' blindy often results in 500/422 errors if it doesn't exist.
             # We should return a clear error to the user.
             raise HTTPException(status_code=400, detail="No time entry activities found in Redmine. Please check your Redmine configuration or set a Default Activity ID in Settings.")

    try:
        redmine.create_time_entry(
            issue_id=timer_session.redmine_issue_id,
            hours=hours,
            activity_id=activity_id,
            comments=""  # 時間記錄的 comments 留空
        )
        
        # 將工作日誌內容添加到 issue 的 notes/journal
        if comments and comments.strip():
            try:
                redmine.add_issue_note(timer_session.redmine_issue_id, comments)
            except Exception as note_err:
                # 記錄 note 失敗不應該阻止整個提交流程
                print(f"Warning: Failed to add note to issue: {note_err}")
        
        # If successful (no exception raised)
        timer_session.is_synced = True
        timer_session.synced_at = datetime.utcnow()
        session.add(timer_session)
        session.commit()
        return {"status": "submitted", "hours": hours, "issue_id": timer_session.redmine_issue_id}
    except Exception as e:
        # Return the actual error from Redmine (e.g. "Activity can't be blank" or "Invalid issue ID")
        # Ensure we return 400/422 for client errors instead of 500
        error_msg = str(e)
        status = 500
        # Check for common client-side errors in the message
        if "Activity cannot be blank" in error_msg or "is not included in the list" in error_msg:
             status = 400
        raise HTTPException(status_code=status, detail=f"Redmine submission failed: {error_msg}")
