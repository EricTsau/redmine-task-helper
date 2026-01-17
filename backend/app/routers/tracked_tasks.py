"""
Tracked Tasks Router - 管理使用者追蹤的 Redmine 任務
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_session
from app.models import TrackedTask, User
from app.services.redmine_client import RedmineService
from app.dependencies import get_current_user, get_redmine_service

router = APIRouter()


# === Schemas ===

class ImportTasksRequest(BaseModel):
    issue_ids: List[int]


class TrackedTaskResponse(BaseModel):
    id: int
    redmine_issue_id: int
    project_id: int
    project_name: str
    subject: str
    status: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    custom_group: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime


class UpdateGroupRequest(BaseModel):
    custom_group: Optional[str] = None


class SyncResult(BaseModel):
    total: int
    updated: int
    failed: int


# === Endpoints ===

@router.post("/import", response_model=List[TrackedTaskResponse])
async def import_tasks(
    request: ImportTasksRequest,
    session: Session = Depends(get_session),
    service: RedmineService = Depends(get_redmine_service),
    current_user: User = Depends(get_current_user)
):
    """
    匯入 Redmine 任務到追蹤清單。
    
    接受 issue IDs 陣列，從 Redmine 取得詳細資訊後存入本地資料庫。
    若任務已存在則更新，不存在則新增。
    """
    imported = []
    
    for issue_id in request.issue_ids:
        try:
            # 檢查是否已追蹤 (需過濾 owner_id)
            existing = session.exec(
                select(TrackedTask).where(
                    TrackedTask.redmine_issue_id == issue_id,
                    TrackedTask.owner_id == current_user.id
                )
            ).first()
            
            # 從 Redmine 取得最新資料
            issue = service.redmine.issue.get(issue_id)
            
            assigned_to_id = None
            assigned_to_name = None
            if hasattr(issue, 'assigned_to') and issue.assigned_to:
                assigned_to_id = issue.assigned_to.id
                assigned_to_name = issue.assigned_to.name
            
            if existing:
                # 更新現有記錄
                existing.project_id = issue.project.id
                existing.project_name = issue.project.name
                existing.subject = issue.subject
                existing.status = issue.status.name
                existing.assigned_to_id = assigned_to_id
                existing.assigned_to_name = assigned_to_name
                existing.last_synced_at = datetime.utcnow()
                session.add(existing)
                imported.append(existing)
            else:
                # 新增記錄
                tracked = TrackedTask(
                    owner_id=current_user.id,
                    redmine_issue_id=issue.id,
                    project_id=issue.project.id,
                    project_name=issue.project.name,
                    subject=issue.subject,
                    status=issue.status.name,
                    assigned_to_id=assigned_to_id,
                    assigned_to_name=assigned_to_name,
                    last_synced_at=datetime.utcnow()
                )
                session.add(tracked)
                session.commit()
                session.refresh(tracked)
                imported.append(tracked)
        except Exception as e:
            print(f"Error importing issue {issue_id}: {e}")
            continue
    
    session.commit()
    return imported


@router.get("/", response_model=List[TrackedTaskResponse])
async def list_tracked_tasks(
    group_by: Optional[str] = None,
    custom_group: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    取得所有追蹤中的任務。
    
    Parameters:
    - group_by: 分組方式 ('project', 'status', 'custom')
    - custom_group: 篩選特定自定義分組
    """
    query = select(TrackedTask).where(TrackedTask.owner_id == current_user.id)
    
    if custom_group:
        query = query.where(TrackedTask.custom_group == custom_group)
    
    tasks = session.exec(query.order_by(TrackedTask.project_name, TrackedTask.subject)).all()
    return tasks


@router.get("/{task_id}", response_model=TrackedTaskResponse)
async def get_tracked_task(
    task_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得單一追蹤任務詳情"""
    task = session.exec(
        select(TrackedTask).where(
            TrackedTask.id == task_id,
            TrackedTask.owner_id == current_user.id
        )
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Tracked task not found")
    return task


@router.delete("/{task_id}")
async def delete_tracked_task(
    task_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """移除任務追蹤"""
    task = session.exec(
        select(TrackedTask).where(
            TrackedTask.id == task_id,
            TrackedTask.owner_id == current_user.id
        )
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Tracked task not found")
    
    session.delete(task)
    session.commit()
    return {"message": "Task removed from tracking"}


@router.patch("/{task_id}/group", response_model=TrackedTaskResponse)
async def update_task_group(
    task_id: int,
    request: UpdateGroupRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """更新任務的自定義分組"""
    task = session.exec(
        select(TrackedTask).where(
            TrackedTask.id == task_id,
            TrackedTask.owner_id == current_user.id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tracked task not found")
    
    task.custom_group = request.custom_group
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/sync", response_model=SyncResult)
async def sync_tracked_tasks(
    session: Session = Depends(get_session),
    service: RedmineService = Depends(get_redmine_service),
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發同步所有追蹤任務的狀態。
    從 Redmine 取得最新資料並更新本地記錄。
    """
    # Fetch tasks only for current user
    tasks = session.exec(
        select(TrackedTask).where(TrackedTask.owner_id == current_user.id)
    ).all()
    
    total = len(tasks)
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
            print(f"Error syncing task {task.redmine_issue_id}: {e}")
            failed += 1
    
    session.commit()
    return SyncResult(total=total, updated=updated, failed=failed)
