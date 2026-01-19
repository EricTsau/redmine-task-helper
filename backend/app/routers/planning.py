from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.dependencies import get_current_user, get_openai_service, get_redmine_service
from app.models import User, PlanningProject, PlanningTask, PRDDocument, TaskDependency
from app.services.openai_service import OpenAIService
from app.services.redmine_client import RedmineService

router = APIRouter(prefix="/planning", tags=["planning"])

# ============ Request/Response Models ============

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    prd_document_id: Optional[int] = None
    redmine_project_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sync_mode: Optional[str] = None
    redmine_project_id: Optional[int] = None
    redmine_project_name: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    prd_document_id: Optional[int]
    redmine_project_id: Optional[int]
    redmine_project_name: Optional[str] = None
    sync_mode: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    parent_id: Optional[int] = None

class TaskUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    progress: Optional[float] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None

class TaskResponse(BaseModel):
    id: int
    planning_project_id: int
    subject: str
    description: Optional[str]
    estimated_hours: Optional[float]
    start_date: Optional[str]
    due_date: Optional[str]
    progress: float
    parent_id: Optional[int]
    sort_order: int
    redmine_issue_id: Optional[int]
    is_from_redmine: bool
    sync_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============ Project Endpoints ============

@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """建立新的規劃專案"""
    db_project = PlanningProject(
        owner_id=current_user.id,
        name=project.name,
        description=project.description,
        prd_document_id=project.prd_document_id,
        redmine_project_id=project.redmine_project_id
    )
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    prd_document_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """列出所有規劃專案，可依 PRD ID 篩選"""
    query = select(PlanningProject).where(PlanningProject.owner_id == current_user.id)
    
    if prd_document_id:
        query = query.where(PlanningProject.prd_document_id == prd_document_id)
        
    projects = session.exec(query.order_by(PlanningProject.updated_at.desc())).all()
    return projects

@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得規劃專案詳情"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """更新規劃專案"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project_update.name is not None:
        project.name = project_update.name
    if project_update.description is not None:
        project.description = project_update.description
    if project_update.sync_mode is not None:
        project.sync_mode = project_update.sync_mode
    if project_update.redmine_project_id is not None:
        project.redmine_project_id = project_update.redmine_project_id
    if project_update.redmine_project_name is not None:
        project.redmine_project_name = project_update.redmine_project_name
    
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """刪除規劃專案"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 這裡可能需要級聯刪除 tasks? SQLModel 不一定會自動處理
    # 暫時先刪除 project，讓 DB constraint 處理或手動刪除 tasks
    tasks = session.exec(select(PlanningTask).where(PlanningTask.planning_project_id == project_id)).all()
    for task in tasks:
        session.delete(task)
        
    session.delete(project)
    session.commit()
    return {"status": "deleted"}

# ============ Task Endpoints ============

@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """列出專案的所有任務"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = session.exec(
        select(PlanningTask)
        .where(PlanningTask.planning_project_id == project_id)
        .order_by(PlanningTask.sort_order)
    ).all()
    return tasks

@router.post("/projects/{project_id}/tasks", response_model=TaskResponse)
async def create_task(
    project_id: int,
    task: TaskCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """建立新任務"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 計算 sort_order (放在最後)
    last_task = session.exec(
        select(PlanningTask)
        .where(PlanningTask.planning_project_id == project_id)
        .order_by(PlanningTask.sort_order.desc())
    ).first()
    new_order = (last_task.sort_order + 1) if last_task else 0
    
    db_task = PlanningTask(
        planning_project_id=project_id,
        subject=task.subject,
        description=task.description,
        estimated_hours=task.estimated_hours,
        start_date=task.start_date,
        due_date=task.due_date,
        parent_id=task.parent_id,
        sort_order=new_order
    )
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.put("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: int,
    task_id: int,
    task_update: TaskUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """更新任務"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    task = session.get(PlanningTask, task_id)
    if not task or task.planning_project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_update.subject is not None:
        task.subject = task_update.subject
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.estimated_hours is not None:
        task.estimated_hours = task_update.estimated_hours
    if task_update.start_date is not None:
        task.start_date = task_update.start_date
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    if task_update.progress is not None:
        task.progress = task_update.progress
    if task_update.parent_id is not None:
        task.parent_id = task_update.parent_id
    if task_update.sort_order is not None:
        task.sort_order = task_update.sort_order
        
    task.updated_at = datetime.utcnow()
    # 標記為 modified，除非已經同步過    
    if task.assigned_to_id:
        # Update assigned_to_name if possible? No easy way unless we fetch user.
        pass

    session.add(task)
    session.commit()
    session.refresh(task)
    return task

@router.put("/projects/{project_id}/tasks/reorder")
async def reorder_tasks(
    project_id: int,
    reorder_data: List[dict],  # [{"id": 1, "sort_order": 0}, ...]
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """批次更新任務順序"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    for item in reorder_data:
        task_id = item.get("id")
        sort_order = item.get("sort_order")
        if task_id is not None and sort_order is not None:
             task = session.get(PlanningTask, task_id)
             if task and task.planning_project_id == project_id:
                 task.sort_order = sort_order
                 session.add(task)
    
    session.commit()
    return {"status": "ok"}

@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def patch_task(
    task_id: int,
    task_update: TaskUpdate,
    session: Session = Depends(get_session),
    redmine_service: RedmineService = Depends(get_redmine_service),
    current_user: User = Depends(get_current_user)
):
    """更新任務 (PATCH - 不需 Project ID)"""
    task = session.get(PlanningTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    project = session.get(PlanningProject, task.planning_project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    if task_update.subject is not None:
        task.subject = task_update.subject
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.estimated_hours is not None:
        task.estimated_hours = task_update.estimated_hours
    if task_update.start_date is not None:
        task.start_date = task_update.start_date
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    if task_update.progress is not None:
        task.progress = task_update.progress
    if task_update.parent_id is not None:
        task.parent_id = task_update.parent_id
    if task_update.sort_order is not None:
        task.sort_order = task_update.sort_order
        
    task.updated_at = datetime.utcnow()
    if task.sync_status == "synced":
        task.sync_status = "modified"

    # Attempt to sync to Redmine immediately if linked
    redmine_error = None
    if task.is_from_redmine and task.redmine_issue_id:
        try:
             print(f"[Patch Task] Syncing task {task.id} (Issue #{task.redmine_issue_id}) subject={task.subject} desc_len={len(task.description or '')}")
             # Only update supported fields
             redmine_service.update_issue(
                 task.redmine_issue_id,
                 subject=task.subject,
                 description=task.description,
                 start_date=task.start_date,
                 due_date=task.due_date,
                 estimated_hours=task.estimated_hours,
                 done_ratio=int(task.progress * 100)
             )
             task.sync_status = "synced"
        except Exception as e:
             redmine_error = str(e)
             print(f"Failed to auto-sync task {task.id} to Redmine: {e}")

    session.add(task)
    session.commit()
    session.refresh(task)
    
    # We could attach a warning if sync failed, but response model doesn't support it yet.
    # For now, client will see sync_status="modified" if it failed.
    return task

@router.get("/tasks/{task_id}/redmine-details")
async def get_task_redmine_details(
    task_id: int,
    session: Session = Depends(get_session),
    redmine_service: RedmineService = Depends(get_redmine_service),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch live details from Redmine for a connected task (including journals/notes)
    """
    task = session.get(PlanningTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if not task.is_from_redmine or not task.redmine_issue_id:
        raise HTTPException(status_code=400, detail="Task is not linked to Redmine")
        
    # Check project ownership
    project = session.get(PlanningProject, task.planning_project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        issue = redmine_service.get_issue_with_journals(task.redmine_issue_id)
        if not issue:
             raise HTTPException(status_code=404, detail="Issue not found in Redmine")
             
        return issue
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: int,
    task_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """刪除任務"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    task = session.get(PlanningTask, task_id)
    if not task or task.planning_project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    
    session.delete(task)
    session.commit()
    return {"status": "deleted"}

# ============ AI Generation ============

@router.post("/projects/{project_id}/generate-tasks")
async def generate_tasks_from_prd(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    openai: OpenAIService = Depends(get_openai_service)
):
    """從 PRD 內容生成任務"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.prd_document_id:
        raise HTTPException(status_code=400, detail="此專案未連結 PRD")
        
    prd = session.get(PRDDocument, project.prd_document_id)
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
        
    if not prd.content:
        raise HTTPException(status_code=400, detail="PRD 內容為空")

    # TODO: 這裡需要確保 OpenAIService 支援 parse_prd_content_to_tasks
    # 目前先用現有的 parse_prd_to_tasks，但稍微修改傳入參數
    # 我們需要更新 OpenAIService? 或者在這裡組裝假的 conversation
    
    fake_conversation = [
        {"role": "user", "content": f"這是我們的 PRD 內容：\n\n{prd.content}\n\n請幫我拆解成具體的任務清單。"}
    ]
    project_context = {"id": project.id, "name": project.name}
    
    result = openai.parse_prd_to_tasks(fake_conversation, project_context)
    
    print(f"[Generate Tasks] Generated result: {result}")
    
    # 將生成的 Tasks 存入 DB
    generated_tasks = result.get("tasks", [])
    db_tasks = []
    
    # 取得目前最大的 sort_order
    last_task = session.exec(
        select(PlanningTask)
        .where(PlanningTask.planning_project_id == project_id)
        .order_by(PlanningTask.sort_order.desc())
    ).first()
    current_order = (last_task.sort_order + 1) if last_task else 0
    
    for task_data in generated_tasks:
        est = task_data.get("estimated_hours")
        if est is not None:
             try:
                 est = float(est)
             except (ValueError, TypeError):
                 est = 0
                 
        # Default start_date to today if missing, to ensure visibility in Gantt
        start_date = task_data.get("start_date")
        if not start_date:
            start_date = datetime.now().strftime("%Y-%m-%d")
        
        # Handle description - could be dict with goal/DOD or plain string
        description_raw = task_data.get("description")
        if isinstance(description_raw, dict):
            # Convert dict to formatted string
            parts = []
            if description_raw.get("goal"):
                parts.append(f"## 目標\n{description_raw['goal']}")
            if description_raw.get("DOD"):
                parts.append(f"## Definition of Done\n{description_raw['DOD']}")
            description = "\n\n".join(parts) if parts else None
        else:
            description = description_raw
            
        task = PlanningTask(
            planning_project_id=project_id,
            subject=task_data.get("subject", "未命名任務"),
            description=description,  # Save description (Goal & DOD)
            estimated_hours=est,
            start_date=start_date,
            due_date=task_data.get("due_date"),
            sort_order=current_order
        )
        db_tasks.append(task)
        session.add(task)
        current_order += 1
        
    session.commit()
    
    return {
        "message": result.get("message", "任務生成完成"),
        "tasks_count": len(db_tasks)
    }
# ============ Dependency Endpoints ============

class LinkCreate(BaseModel):
    source: int
    target: int
    type: str = "0"  # 0: Finish-Start

class LinkResponse(BaseModel):
    id: int
    source: int
    target: int
    type: str
    
    class Config:
        from_attributes = True

@router.get("/projects/{project_id}/links", response_model=List[LinkResponse])
async def list_links(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """列出專案的所有相依關係"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # 這裡需要用 JOIN 找出屬於該專案 Tasks 的 Links
    # 假設 Link 兩端都在同專案 (通常是)
    # 我們找出 source_task_id 屬於該專案的所有 links
    
    links = session.exec(
        select(TaskDependency)
        .join(PlanningTask, TaskDependency.source_task_id == PlanningTask.id)
        .where(PlanningTask.planning_project_id == project_id)
    ).all()
    
    # 轉換為 DHTMLX 格式 (source/target instead of source_task_id/target_task_id)
    result = []
    for link in links:
        result.append(LinkResponse(
            id=link.id,
            source=link.source_task_id,
            target=link.target_task_id,
            type=link.dependency_type
        ))
    return result

@router.post("/projects/{project_id}/links", response_model=LinkResponse)
async def create_link(
    project_id: int,
    link_data: LinkCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """建立相依關係"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 驗證 Tasks 是否存在且屬於該專案
    source_task = session.get(PlanningTask, link_data.source)
    target_task = session.get(PlanningTask, link_data.target)
    
    if not source_task or source_task.planning_project_id != project_id:
        raise HTTPException(status_code=400, detail="Source task invalid")
    if not target_task or target_task.planning_project_id != project_id:
        raise HTTPException(status_code=400, detail="Target task invalid")
        
    db_link = TaskDependency(
        source_task_id=link_data.source,
        target_task_id=link_data.target,
        dependency_type=link_data.type
    )
    session.add(db_link)
    session.commit()
    session.refresh(db_link)
    
    return LinkResponse(
        id=db_link.id,
        source=db_link.source_task_id,
        target=db_link.target_task_id,
        type=db_link.dependency_type
    )

    session.delete(link)
    session.commit()
    return {"status": "deleted"}


# ============ Redmine Integration ============

class ImportRequest(BaseModel):
    redmine_project_id: int
    issue_ids: Optional[List[int]] = None

@router.post("/projects/{project_id}/import-redmine")
async def import_redmine_tasks(
    project_id: int,
    request: ImportRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """從 Redmine 匯入任務 (支援整專案匯入或指定 Issue ID)"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    

    # Update Redmine Project ID mapping if changed or name missing
    if project.redmine_project_id != request.redmine_project_id or not project.redmine_project_name:
        project.redmine_project_id = request.redmine_project_id
        
        # Try to fetch project name
        try:
             # Need to use redmine_service.redmine directly or add helper
             # We added get_project(id) to redmine_service
             r_project = redmine.get_project(request.redmine_project_id)
             if r_project:
                 project.redmine_project_name = r_project.name
        except Exception as e:
            print(f"Failed to fetch redmine project name: {e}")

        session.add(project)
        session.commit()
        session.refresh(project)

    try:
        # Fetch issues from Redmine
        if request.issue_ids:
            # Import specific issues
            issue_ids_str = ",".join(map(str, request.issue_ids))
            # Note: python-redmine filter passes kwargs to requests params. Redmine API supports issue_id=1,2,3
            issues = redmine.redmine.issue.filter(issue_id=issue_ids_str, status_id='*')
        else:
            # Full project sync (existing behavior)
            issues = redmine.redmine.issue.filter(project_id=request.redmine_project_id, status_id='*')
        
        redmine_issues = list(issues)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Redmine issues: {str(e)}")

    # Map Redmine issues to PlanningTasks
    # Strategy: Match by redmine_issue_id.
    
    # 1. Get existing tasks to avoid duplicates
    existing_tasks = session.exec(
        select(PlanningTask).where(PlanningTask.planning_project_id == project_id)
    ).all()
    existing_map = {t.redmine_issue_id: t for t in existing_tasks if t.redmine_issue_id}
    
    # Determine max sort order
    max_order = 0
    if existing_tasks:
        max_order = max(t.sort_order for t in existing_tasks)
    
    imported_count = 0
    updated_count = 0
    
    # Use a map to track redmine_id -> task_id for parent linking
    redmine_id_to_task_id = {}
    
    # List to store created/updated tasks for 2nd pass
    processed_tasks = []

    for issue in issues:
        r_id = issue.id
        subject = getattr(issue, 'subject', 'No Subject')
        description = getattr(issue, 'description', '')
        start_date = getattr(issue, 'start_date', None)
        due_date = getattr(issue, 'due_date', None)
        estimated = getattr(issue, 'estimated_hours', None)
        done_ratio = getattr(issue, 'done_ratio', 0)
        
        # Meta info
        assigned_to = getattr(issue, 'assigned_to', None)
        status = getattr(issue, 'status', None)
        updated_on_str = str(getattr(issue, 'updated_on', ''))
        
        redmine_updated_on = None
        try:
             if updated_on_str:
                 if isinstance(getattr(issue, 'updated_on', None), datetime):
                     redmine_updated_on = issue.updated_on
                 else:
                     redmine_updated_on = datetime.fromisoformat(updated_on_str.replace('Z', '+00:00'))
        except Exception:
             pass
        
        # Convert dates to string YYYY-MM-DD
        s_date_str = str(start_date) if start_date else None
        d_date_str = str(due_date) if due_date else None
        
        if r_id in existing_map:
            # Update
            task = existing_map[r_id]
            task.subject = subject
            task.description = description
            # Preserve locally modified dates if strict sync not enforced? 
            # For now, overwrite to ensure consistency with Redmine (Import implies source of truth)
            task.start_date = s_date_str
            task.due_date = d_date_str
            if estimated:
                task.estimated_hours = float(estimated)
            task.progress = float(done_ratio) / 100.0
            task.is_from_redmine = True
            task.sync_status = "synced"
            
            # Update meta
            task.assigned_to_id = assigned_to.id if assigned_to else None
            task.assigned_to_name = assigned_to.name if assigned_to else None
            task.status_id = status.id if status else None
            task.status_name = status.name if status else None
            task.redmine_updated_on = redmine_updated_on
            
            session.add(task)
            updated_count += 1
            processed_tasks.append(task)
        else:
            # Create
            max_order += 1
            task = PlanningTask(
                planning_project_id=project_id,
                subject=subject,
                description=description,
                start_date=s_date_str,
                due_date=d_date_str,
                estimated_hours=float(estimated) if estimated else None,
                progress=float(done_ratio) / 100.0,
                sort_order=max_order,
                redmine_issue_id=r_id,
                is_from_redmine=True,
                sync_status="synced",
                assigned_to_id=assigned_to.id if assigned_to else None,
                assigned_to_name=assigned_to.name if assigned_to else None,
                status_id=status.id if status else None,
                status_name=status.name if status else None,
                redmine_updated_on=redmine_updated_on
            )
            session.add(task)
            imported_count += 1
            processed_tasks.append(task)
    session.commit()
    
    # Refresh processed tasks to get IDs
    for t in processed_tasks:
        session.refresh(t)
        if t.redmine_issue_id:
            redmine_id_to_task_id[t.redmine_issue_id] = t.id
            
    # Include existing tasks in map (in case they weren't updated but are parents)
    for t in existing_tasks:
        if t.redmine_issue_id:
            redmine_id_to_task_id[t.redmine_issue_id] = t.id

    # 2nd Pass: Link Parents
    for issue in issues:
        if not hasattr(issue, 'parent'):
            continue
            
        parent_r_id = issue.parent.id
        child_r_id = issue.id
        
        if child_r_id in redmine_id_to_task_id and parent_r_id in redmine_id_to_task_id:
            child_task_id = redmine_id_to_task_id[child_r_id]
            parent_task_id = redmine_id_to_task_id[parent_r_id]
            
            # Fetch and update
            child_task = session.get(PlanningTask, child_task_id)
            if child_task and child_task.parent_id != parent_task_id:
                child_task.parent_id = parent_task_id
                session.add(child_task)
                
    session.commit()
    
    return {"message": "Import completed", "imported": imported_count, "updated": updated_count}


@router.post("/projects/{project_id}/sync-redmine")
async def sync_redmine_tasks(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """將本地任務同步回 Redmine"""
    project = session.get(PlanningProject, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if not project.redmine_project_id:
        raise HTTPException(status_code=400, detail="未連結 Redmine 專案")
        
    tasks = session.exec(
        select(PlanningTask).where(PlanningTask.planning_project_id == project_id)
    ).all()
    
    synced_count = 0
    created_count = 0
    
    # Map local_id -> redmine_id for parent linking
    local_id_to_redmine_id = {}
    
    # 1st Pass: Create or Update Issues
    for task in tasks:
        # Default settings if creating
        # TODO: Allow configuration. Using defaults for now (Tracker=Feature/2, Status=New/1)
        # We might need to fetch available trackers to pick a valid one.
        
        description = task.description or ""
        
        if task.redmine_issue_id:
            # Update existing
            try:
                redmine.update_issue(
                    task.redmine_issue_id,
                    subject=task.subject,
                    description=description,
                    start_date=task.start_date,
                    due_date=task.due_date,
                    estimated_hours=task.estimated_hours,
                    done_ratio=int(task.progress * 100)
                )
                task.sync_status = "synced"
                session.add(task)
                synced_count += 1
                local_id_to_redmine_id[task.id] = task.redmine_issue_id
            except Exception as e:
                print(f"Failed to sync task {task.id}: {e}")
        else:
            # Create new
            try:
                # We need tracker_id. redmine_client.create_issue requires it.
                # Hardcoding tracker_id=2 (Feature) as fallback?
                # Safer: Fetch trackers and pick first? 
                # Let's use tracker_id=2 for MVP 
                issue = redmine.create_issue(
                    project_id=project.redmine_project_id,
                    subject=task.subject,
                    description=description,
                    tracker_id=2, # TODO: config
                    start_date=task.start_date,
                    due_date=task.due_date,
                    estimated_hours=task.estimated_hours,
                    done_ratio=int(task.progress * 100)
                )
                task.redmine_issue_id = issue.id
                task.is_from_redmine = True
                task.sync_status = "synced"
                session.add(task)
                created_count += 1
                local_id_to_redmine_id[task.id] = issue.id
            except Exception as e:
                print(f"Failed to create issue for task {task.id}: {e}")

    session.commit()
    
    # 2nd Pass: Update Parents
    for task in tasks:
        if task.parent_id and task.redmine_issue_id:
            parent_redmine_id = local_id_to_redmine_id.get(task.parent_id)
            if parent_redmine_id:
                try:
                    redmine.update_issue(task.redmine_issue_id, parent_issue_id=parent_redmine_id)
                except Exception as e:
                    print(f"Failed to update parent for task {task.id}: {e}")
            else:
                 # Parent has no redmine ID (maybe failed to create?), skip
                 pass

    return {"status": "synced", "synced": synced_count, "created": created_count}


class NoteRequest(BaseModel):
    notes: str


@router.post("/tasks/{task_id}/note")
async def add_task_note(
    task_id: int,
    request: NoteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """新增筆記到任務（同步到 Redmine）"""
    task = session.get(PlanningTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    project = session.get(PlanningProject, task.planning_project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    if not task.is_from_redmine or not task.redmine_issue_id:
        # TODO: Support local notes? For now only synced tasks.
        raise HTTPException(status_code=400, detail="此任務尚未同步到 Redmine，無法新增筆記")

    try:
        # Add note to Redmine
        redmine.add_issue_note(task.redmine_issue_id, notes=request.notes)
        
        # Ideally, we should fetch the latest journal to store locally if we had local comment caching.
        # For now, just confirming success.
        
        return {"status": "success", "message": "Note added to Redmine"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add note to Redmine: {str(e)}")
