from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
import enum

class AuthSource(str, enum.Enum):
    STANDARD = "standard"
    LDAP = "ldap"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = Field(default=False)
    auth_source: AuthSource = Field(default=AuthSource.STANDARD)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    tracked_tasks: List["TrackedTask"] = Relationship(back_populates="owner")
    timer_sessions: List["TimerSession"] = Relationship(back_populates="owner")
    watchlists: List["ProjectWatchlist"] = Relationship(back_populates="owner")
    refresh_tokens: List["RefreshToken"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "User.id==RefreshToken.user_id", "lazy": "dynamic"}
    )
    settings: Optional["UserSettings"] = Relationship(back_populates="user")
    work_summary_settings: Optional["AIWorkSummarySettings"] = Relationship(back_populates="owner")
    work_summary_reports: List["AIWorkSummaryReport"] = Relationship(back_populates="owner")

class LDAPSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    server_url: str = Field(default="ldap://localhost")
    base_dn: str = Field(default="dc=example,dc=com")
    user_dn_template: str = Field(default="uid={username},ou=users,dc=example,dc=com")
    bind_dn: Optional[str] = None
    bind_password: Optional[str] = None
    is_active: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSettings(SQLModel, table=True):
    """Per-user application settings (Redmine/OpenAI credentials)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    
    # Redmine settings
    redmine_url: Optional[str] = None
    api_key: Optional[str] = None
    redmine_default_activity_id: Optional[int] = None

    # OpenAI settings
    openai_url: Optional[str] = Field(default="https://api.openai.com/v1")
    openai_key: Optional[str] = None
    openai_model: Optional[str] = Field(default="gpt-4o-mini")
    
    # Task Warning Settings
    task_warning_days: int = Field(default=2)
    task_severe_warning_days: int = Field(default=3)
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="settings")

class AppSettings(SQLModel, table=True):
    """Global application settings (LDAP state etc)"""
    id: int = Field(default=1, primary_key=True)
    ldap_enabled: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TrackedTask(SQLModel, table=True):
    """使用者追蹤的 Redmine 任務"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    redmine_issue_id: int = Field(index=True)
    project_id: int
    project_name: str
    subject: str
    status: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    custom_group: Optional[str] = None
    
    # New fields for stats and warnings
    estimated_hours: Optional[float] = None
    spent_hours: float = Field(default=0.0)
    updated_on: Optional[datetime] = None
    
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner: User = Relationship(back_populates="tracked_tasks")


class TimerLog(SQLModel, table=True):
    """
    Deprecated: Use TimerSession instead. Kept for migration.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    redmine_issue_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: int = 0  # in seconds
    comment: Optional[str] = None
    is_synced: bool = False
    synced_at: Optional[datetime] = None

class TimerSession(SQLModel, table=True):
    """
    Represent a work session for an issue, which may contain multiple time spans (Pause/Resume).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    redmine_issue_id: int
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    total_duration: int = 0 
    status: str = Field(default="running") 
    content: Optional[str] = None 
    is_synced: bool = False
    synced_at: Optional[datetime] = None

    owner: User = Relationship(back_populates="timer_sessions")

class TimerSpan(SQLModel, table=True):
    """
    A continuous period of work within a session.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="timersession.id")
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None


class TimeEntryExtraction(SQLModel):
    """NLP 解析出的工時紀錄結構"""
    issue_id: Optional[int] = None
    project_name: Optional[str] = None
    hours: float
    activity_name: str = "Development"
    comments: str
    confidence_score: float = Field(default=0.0, description="AI 解析信心分數 0-1")

class ProjectWatchlist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    redmine_project_id: int = Field(index=True)
    project_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner: User = Relationship(back_populates="watchlists")

class RefreshToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True)
    user_id: int = Field(foreign_key="user.id")
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked: bool = Field(default=False)


# ============ AI PM Copilot Models ============

class Holiday(SQLModel, table=True):
    """系統假日資料 (全域共用)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True, unique=True)  # YYYY-MM-DD 格式
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HolidaySettings(SQLModel, table=True):
    """假日設定 (週末開關等)"""
    id: int = Field(default=1, primary_key=True)
    exclude_saturday: bool = Field(default=True)
    exclude_sunday: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PRDDocument(SQLModel, table=True):
    """PRD 文件主體"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    
    # 基本資訊
    title: str
    project_id: Optional[int] = None  # Redmine 專案 ID（可選）
    project_name: Optional[str] = None
    
    # 內容
    content: str = Field(default="")  # Markdown 內容
    
    # 對話紀錄
    conversation_history: str = Field(default="[]")  # JSON 格式
    
    # 狀態: draft, confirmed, synced
    status: str = Field(default="draft")
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PlanningProject(SQLModel, table=True):
    """獨立的規劃專案（甘特圖載體）"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    
    # 基本資訊
    name: str
    description: Optional[str] = None
    
    # 關聯 PRD（可選）
    prd_document_id: Optional[int] = Field(default=None, foreign_key="prddocument.id")
    
    # 關聯 Redmine 專案（可選，用於同步）
    redmine_project_id: Optional[int] = None
    redmine_project_name: Optional[str] = None
    
    # 同步設定: "realtime" | "manual"
    sync_mode: str = Field(default="manual")
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PlanningTask(SQLModel, table=True):
    """規劃中的 Task（存在本地 DB）"""
    id: Optional[int] = Field(default=None, primary_key=True)
    planning_project_id: int = Field(foreign_key="planningproject.id", index=True)
    
    # Task 內容
    subject: str
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    
    # 時程
    start_date: Optional[str] = None  # YYYY-MM-DD
    due_date: Optional[str] = None
    progress: float = Field(default=0.0)  # 0.0 ~ 1.0
    
    # 階層與順序
    parent_id: Optional[int] = None  # 自引用
    sort_order: int = Field(default=0)
    
    # Redmine 關聯（若已同步或匯入）
    redmine_issue_id: Optional[int] = None
    is_from_redmine: bool = Field(default=False)  # 是否從 Redmine 匯入
    
    # 狀態: "local" | "synced" | "modified"
    sync_status: str = Field(default="local")

    # Redmine Meta Info (Cached)
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    status_id: Optional[int] = None
    status_name: Optional[str] = None
    redmine_updated_on: Optional[datetime] = None
    
    # 時間戳記
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TaskDependency(SQLModel, table=True):
    """Task 之間的相依關係（甘特圖 Link）"""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    source_task_id: int = Field(foreign_key="planningtask.id", index=True)
    target_task_id: int = Field(foreign_key="planningtask.id", index=True)
    
    # DHTMLX 格式: "0"=FS, "1"=SS, "2"=FF, "3"=SF
    dependency_type: str = Field(default="0")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AIWorkSummarySettings(SQLModel, table=True):
    """使用者 AI 工作總結的設定"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    
    # 關注清單 (JSON list of IDs)
    target_project_ids: str = Field(default="[]") 
    target_user_ids: str = Field(default="[]")
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: User = Relationship(back_populates="work_summary_settings")


class AIWorkSummaryReport(SQLModel, table=True):
    """AI 生成的工作總結報告歷史"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    
    title: str = Field(default="工作總結")
    date_range_start: Optional[str] = None # YYYY-MM-DD
    date_range_end: Optional[str] = None   # YYYY-MM-DD
    
    # 報告內容
    summary_markdown: str = Field(default="")
    
    # 對話紀錄 for Follow-up
    conversation_history: str = Field(default="[]") # JSON
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner: User = Relationship(back_populates="work_summary_reports")
