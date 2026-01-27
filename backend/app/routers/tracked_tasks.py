"""
Tracked Tasks Router - 管理使用者追蹤的 Redmine 任務
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

import json
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
    status_id: Optional[int] = None
    status: str
    
    # New fields
    estimated_hours: Optional[float] = None
    spent_hours: float = 0.0
    updated_on: Optional[datetime] = None
    
    relations: Optional[str] = None
    
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    custom_group: Optional[str] = None
    
    # Hierarchy & Author
    parent_id: Optional[int] = None
    parent_subject: Optional[str] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    
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
                
            author_id = None
            author_name = None
            if hasattr(issue, 'author') and issue.author:
                author_id = issue.author.id
                author_name = issue.author.name
                
            parent_id = None
            parent_subject = None # Not always available
            if hasattr(issue, 'parent') and issue.parent:
                parent_id = issue.parent.id
                # Attempt to get subject if present, else just ID
                if hasattr(issue.parent, 'subject'):
                    parent_subject = issue.parent.subject
            
            # Fetch relations details
            relations_data = []
            if hasattr(issue, 'relations'):
                rel_ids = []
                for rel in issue.relations:
                    # Determine the other issue ID
                    target_id = rel.issue_to_id if rel.issue_id == issue.id else rel.issue_id
                    rel_ids.append(target_id)
                
                # Fetch details for related issues (Subject, Status, etc.)
                # We do this one-by-one or in batch if possible. Redmine doesn't support easy batch fetch by IDs list usually,
                # unless we use filter. But for small number, loop is fine. 
                # Or we can just store the ID and type for now? 
                # User requested detailed info: "Logistics CRM System Development • Open Est: 80h about 1 month ago 📝 eric eric"
                # So we definitely need to fetch the target issue details.
                for target_id in rel_ids:
                    try:
                        # Fetch minimal info?
                        target = service.redmine.issue.get(target_id)
                        relations_data.append({
                            "id": target.id,
                            "subject": target.subject,
                            "status": target.status.name,
                            "estimated_hours": getattr(target, 'estimated_hours', None),
                            "updated_on": target.updated_on.isoformat() if hasattr(target, 'updated_on') else None,
                            "author_name": target.author.name if hasattr(target, 'author') else None,
                            "assigned_to_name": target.assigned_to.name if hasattr(target, 'assigned_to') else None,
                            "relation_type": next((r.relation_type for r in issue.relations if r.issue_id == target_id or r.issue_to_id == target_id), "relates")
                        })
                    except Exception as e:
                        print(f"Failed to fetch related task {target_id}: {e}")
            
            if existing:
                # 更新現有記錄
                existing.project_id = issue.project.id
                existing.project_name = issue.project.name
                existing.subject = issue.subject
                existing.status_id = issue.status.id
                existing.status = issue.status.name
                
                # Update new fields
                existing.estimated_hours = getattr(issue, 'estimated_hours', None)
                existing.spent_hours = getattr(issue, 'spent_hours', 0.0) or getattr(issue, 'total_spent_hours', 0.0) or 0.0
                if hasattr(issue, 'updated_on'):
                    existing.updated_on = issue.updated_on
                
                existing.assigned_to_id = assigned_to_id
                existing.assigned_to_name = assigned_to_name
                
                existing.author_id = author_id
                existing.author_name = author_name
                existing.parent_id = parent_id
                existing.parent_subject = parent_subject
                existing.relations = json.dumps(relations_data)
                
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
                    status_id=issue.status.id,
                    status=issue.status.name,
                    estimated_hours=getattr(issue, 'estimated_hours', None),
                    spent_hours=getattr(issue, 'spent_hours', 0.0) or getattr(issue, 'total_spent_hours', 0.0) or 0.0,
                    updated_on=getattr(issue, 'updated_on', None),
                    assigned_to_id=assigned_to_id,
                    assigned_to_name=assigned_to_name,
                    author_id=author_id,
                    author_name=author_name,
                    parent_id=parent_id,
                    parent_subject=parent_subject,
                    relations=json.dumps(relations_data),
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


class UpdateStatusRequest(BaseModel):
    status_id: int


@router.patch("/{task_id}/status", response_model=TrackedTaskResponse)
async def update_task_status(
    task_id: int,
    request: UpdateStatusRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    service: RedmineService = Depends(get_redmine_service)
):
    """Update task status in Redmine and local DB"""
    task = session.exec(
        select(TrackedTask).where(
            TrackedTask.id == task_id,
            TrackedTask.owner_id == current_user.id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tracked task not found")
    
    try:
        # 1. Update Redmine
        service.update_issue(task.redmine_issue_id, status_id=request.status_id)
        
        # 2. Update Local DB
        issue = service.redmine.issue.get(task.redmine_issue_id)
        
        task.status_id = issue.status.id
        task.status = issue.status.name
        task.updated_on = issue.updated_on
        task.last_synced_at = datetime.utcnow()
        
        session.add(task)
        session.commit()
        session.refresh(task)
        return task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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

            task.status_id = issue.status.id
            task.status = issue.status.name
            
            task.estimated_hours = getattr(issue, 'estimated_hours', None)
            task.spent_hours = getattr(issue, 'spent_hours', 0.0) or getattr(issue, 'total_spent_hours', 0.0) or 0.0
            if hasattr(issue, 'updated_on'):
                task.updated_on = issue.updated_on
            
            task.assigned_to_id = assigned_to_id
            task.assigned_to_name = assigned_to_name
            task.last_synced_at = datetime.utcnow()
            
            # Update relations
            relations_data = []
            if hasattr(issue, 'relations'):
                rel_ids = [rel.issue_to_id if rel.issue_id == issue.id else rel.issue_id for rel in issue.relations]
                for target_id in rel_ids:
                    try:
                        target = service.redmine.issue.get(target_id)
                        relations_data.append({
                            "id": target.id,
                            "subject": target.subject,
                            "status": target.status.name,
                            "estimated_hours": getattr(target, 'estimated_hours', None),
                            "updated_on": target.updated_on.isoformat() if hasattr(target, 'updated_on') else None,
                            "author_name": target.author.name if hasattr(target, 'author') else None,
                            "assigned_to_name": target.assigned_to.name if hasattr(target, 'assigned_to') else None,
                            "relation_type": next((r.relation_type for r in issue.relations if r.issue_id == target_id or r.issue_to_id == target_id), "relates")
                        })
                    except Exception as e:
                        print(f"Failed to sync related task {target_id}: {e}")
            
            task.relations = json.dumps(relations_data)
            
            session.add(task)
            updated += 1
        except Exception as e:
            print(f"Error syncing task {task.redmine_issue_id}: {e}")
            failed += 1
    
    session.commit()
    return SyncResult(total=total, updated=updated, failed=failed)
