"""
背景任務：定期同步追蹤任務的狀態
"""
import asyncio
from datetime import datetime
from sqlmodel import Session, select

from app.database import engine
from app.models import TrackedTask, AppSettings
from app.services.redmine_client import RedmineService

# 同步間隔（秒）
SYNC_INTERVAL = 300  # 5 分鐘

_sync_task = None


async def sync_tracked_tasks():
    """同步所有追蹤任務的狀態"""
    with Session(engine) as session:
        # 取得 Redmine 設定
        settings = session.get(AppSettings, 1)
        if not settings or not settings.redmine_url or not settings.api_key:
            print("[sync_tasks] Redmine not configured, skipping sync")
            return
        
        service = RedmineService(settings.redmine_url, settings.api_key)
        
        # 取得所有追蹤任務
        tasks = session.exec(select(TrackedTask)).all()
        
        if not tasks:
            print("[sync_tasks] No tracked tasks to sync")
            return
        
        print(f"[sync_tasks] Syncing {len(tasks)} tracked tasks...")
        
        updated = 0
        failed = 0
        
        for task in tasks:
            try:
                issue = service.redmine.issue.get(task.redmine_issue_id)
                
                assigned_to_id = None
                assigned_to_name = None
                if hasattr(issue, 'assigned_to') and issue.assigned_to:
                    assigned_to_id = issue.assigned_to.id
                    assigned_to_name = issue.assigned_to.name
                
                task.project_id = issue.project.id
                task.project_name = issue.project.name
                task.subject = issue.subject
                task.status = issue.status.name
                task.assigned_to_id = assigned_to_id
                task.assigned_to_name = assigned_to_name
                task.last_synced_at = datetime.utcnow()
                
                session.add(task)
                updated += 1
            except Exception as e:
                print(f"[sync_tasks] Error syncing task {task.redmine_issue_id}: {e}")
                failed += 1
        
        session.commit()
        print(f"[sync_tasks] Sync complete: {updated} updated, {failed} failed")


async def sync_loop():
    """背景同步迴圈"""
    while True:
        try:
            await sync_tracked_tasks()
        except Exception as e:
            print(f"[sync_tasks] Sync loop error: {e}")
        
        await asyncio.sleep(SYNC_INTERVAL)


def start_sync_task():
    """啟動背景同步任務"""
    global _sync_task
    if _sync_task is None:
        loop = asyncio.get_event_loop()
        _sync_task = loop.create_task(sync_loop())
        print("[sync_tasks] Background sync task started")


def stop_sync_task():
    """停止背景同步任務"""
    global _sync_task
    if _sync_task:
        _sync_task.cancel()
        _sync_task = None
        print("[sync_tasks] Background sync task stopped")
