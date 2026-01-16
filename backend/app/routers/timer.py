from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models import TimerLog
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

class TimerStartRequest(BaseModel):
    issue_id: int
    comment: Optional[str] = None

class TimerStopRequest(BaseModel):
    comment: Optional[str] = None

class TimerResponse(BaseModel):
    id: int
    issue_id: int
    start_time: datetime
    duration: int = 0
    is_running: bool
    comment: Optional[str] = None

@router.post("/start", response_model=TimerResponse)
async def start_timer(request: TimerStartRequest, session: Session = Depends(get_session)):
    # Check if a timer is already running
    active_timer = session.exec(select(TimerLog).where(TimerLog.end_time == None)).first()
    if active_timer:
        # Standard behavior: Stop previous timer automatically or Error?
        # MVP: Stop it automatically for "Focus Mode" switching
        active_timer.end_time = datetime.utcnow()
        active_timer.duration = int((active_timer.end_time - active_timer.start_time).total_seconds())
        session.add(active_timer)
        session.commit()
        # TODO: Notify user that previous timer was stopped?

    new_timer = TimerLog(
        redmine_issue_id=request.issue_id,
        start_time=datetime.utcnow(),
        comment=request.comment
    )
    session.add(new_timer)
    session.commit()
    session.refresh(new_timer)

    return TimerResponse(
        id=new_timer.id,
        issue_id=new_timer.redmine_issue_id,
        start_time=new_timer.start_time,
        is_running=True,
        comment=new_timer.comment
    )

@router.post("/stop", response_model=TimerResponse)
async def stop_timer(request: TimerStopRequest, session: Session = Depends(get_session)):
    active_timer = session.exec(select(TimerLog).where(TimerLog.end_time == None)).first()
    if not active_timer:
        raise HTTPException(status_code=404, detail="No active timer found")

    active_timer.end_time = datetime.utcnow()
    active_timer.duration = int((active_timer.end_time - active_timer.start_time).total_seconds())
    if request.comment:
        active_timer.comment = request.comment
    
    session.add(active_timer)
    session.commit()
    session.refresh(active_timer)

    return TimerResponse(
        id=active_timer.id,
        issue_id=active_timer.redmine_issue_id,
        start_time=active_timer.start_time,
        duration=active_timer.duration,
        is_running=False,
        comment=active_timer.comment
    )

@router.get("/current", response_model=Optional[TimerResponse])
async def get_current_timer(session: Session = Depends(get_session)):
    active_timer = session.exec(select(TimerLog).where(TimerLog.end_time == None)).first()
    if not active_timer:
        return None
    
    current_duration = int((datetime.utcnow() - active_timer.start_time).total_seconds())
    
    return TimerResponse(
        id=active_timer.id,
        issue_id=active_timer.redmine_issue_id,
        start_time=active_timer.start_time,
        duration=current_duration,
        is_running=True,
        comment=active_timer.comment
    )
