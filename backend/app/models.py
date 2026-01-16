from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class AppSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    # Redmine settings
    redmine_url: Optional[str] = None
    api_key: Optional[str] = None
    # OpenAI settings
    openai_url: Optional[str] = Field(default="https://api.openai.com/v1")
    openai_key: Optional[str] = None
    openai_model: Optional[str] = Field(default="gpt-4o-mini")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TimerLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    redmine_issue_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: int = 0  # in seconds
    comment: Optional[str] = None
    is_synced: bool = False
    synced_at: Optional[datetime] = None
