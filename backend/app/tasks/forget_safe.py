import asyncio
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.database import engine
from app.models import TimerLog

MAX_TIMER_HOURS = 4

async def check_and_stop_old_timers():
    """Background task to force-stop timers running longer than MAX_TIMER_HOURS"""
    while True:
        try:
            with Session(engine) as session:
                # Find active timers older than 4 hours
                cutoff = datetime.utcnow() - timedelta(hours=MAX_TIMER_HOURS)
                statement = select(TimerLog).where(
                    TimerLog.is_running == True,
                    TimerLog.start_time < cutoff
                )
                old_timers = session.exec(statement).all()
                
                for timer in old_timers:
                    timer.is_running = False
                    timer.end_time = datetime.utcnow()
                    timer.duration = int((timer.end_time - timer.start_time).total_seconds())
                    timer.comment = (timer.comment or "") + " [Auto-stopped after 4 hours]"
                    session.add(timer)
                
                if old_timers:
                    session.commit()
                    print(f"[Forget-Safe] Auto-stopped {len(old_timers)} timers")
                    
        except Exception as e:
            print(f"[Forget-Safe] Error: {e}")
        
        # Check every 5 minutes
        await asyncio.sleep(300)

def start_forget_safe_task():
    """Start the background task in the event loop"""
    asyncio.create_task(check_and_stop_old_timers())
