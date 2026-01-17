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
    owner_id: int = Field(foreign_key="user.id", index=True)
    redmine_issue_id: int = Field(index=True)
    project_id: int
    project_name: str
    subject: str
    status: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    custom_group: Optional[str] = None
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
    owner_id: int = Field(foreign_key="user.id", index=True)
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
    owner_id: int = Field(foreign_key="user.id", index=True)
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


class PRDConversation(SQLModel, table=True):
    """AI PRD 對話歷史"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    project_id: int = Field(index=True)
    project_name: str
    messages: str = Field(default="[]")  # JSON 格式儲存對話
    generated_tasks: Optional[str] = None  # JSON 格式儲存生成的任務
    status: str = Field(default="draft")  # draft, confirmed, synced
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

