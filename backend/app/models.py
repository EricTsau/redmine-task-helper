from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class AppSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    # Redmine settings
    redmine_url: Optional[str] = None
    api_key: Optional[str] = None
    redmine_default_activity_id: Optional[int] = None

    # OpenAI settings
    openai_url: Optional[str] = Field(default="https://api.openai.com/v1")
    openai_key: Optional[str] = None
    openai_model: Optional[str] = Field(default="gpt-4o-mini")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TrackedTask(SQLModel, table=True):
    """使用者追蹤的 Redmine 任務"""
    id: Optional[int] = Field(default=None, primary_key=True)
    redmine_issue_id: int = Field(unique=True, index=True)
    project_id: int
    project_name: str
    subject: str
    status: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    custom_group: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


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
    redmine_issue_id: int
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    total_duration: int = 0 # Calculated sum of spans
    status: str = Field(default="running") # running, paused, stopped
    content: Optional[str] = None # Rich text / Markdown
    is_synced: bool = False
    synced_at: Optional[datetime] = None

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
    """使用者關注的專案清單"""
    id: Optional[int] = Field(default=None, primary_key=True)
    redmine_project_id: int = Field(unique=True, index=True)
    project_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
