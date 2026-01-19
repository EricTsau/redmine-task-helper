"""
假日管理 API 路由
Admin only - 管理系統假日設定
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import csv
import io

from app.database import get_session
from app.dependencies import get_current_user
from app.models import User, Holiday, HolidaySettings

router = APIRouter(tags=["holidays"])


# ============ Request/Response Models ============

class HolidayCreate(BaseModel):
    date: str  # YYYY-MM-DD
    name: str


class HolidayResponse(BaseModel):
    id: int
    date: str
    name: str
    created_at: datetime


class HolidaySettingsUpdate(BaseModel):
    exclude_saturday: bool
    exclude_sunday: bool


class HolidaySettingsResponse(BaseModel):
    exclude_saturday: bool
    exclude_sunday: bool
    updated_at: datetime


# ============ Admin Check ============

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """確認使用者為 admin"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ============ Holiday CRUD ============

@router.get("", response_model=List[HolidayResponse])
def list_holidays(
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """取得所有假日列表"""
    holidays = session.exec(
        select(Holiday).order_by(Holiday.date)
    ).all()
    return holidays


@router.get("/public", response_model=List[HolidayResponse])
def list_public_holidays(
    session: Session = Depends(get_session)
):
    """取得公開假日列表 (無需 Admin 權限)"""
    holidays = session.exec(
        select(Holiday).order_by(Holiday.date)
    ).all()
    return holidays


@router.post("", response_model=HolidayResponse)
def create_holiday(
    holiday: HolidayCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """新增單一假日"""
    # 檢查是否已存在
    existing = session.exec(
        select(Holiday).where(Holiday.date == holiday.date)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Holiday already exists for {holiday.date}")
    
    db_holiday = Holiday(date=holiday.date, name=holiday.name)
    session.add(db_holiday)
    session.commit()
    session.refresh(db_holiday)
    return db_holiday


@router.delete("/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """刪除假日"""
    holiday = session.get(Holiday, holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    session.delete(holiday)
    session.commit()
    return {"status": "success", "message": f"Holiday {holiday.date} deleted"}


@router.post("/import")
async def import_holidays(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """
    批次匯入假日
    支援 CSV 或 TXT 格式: YYYY-MM-DD, 假日名稱
    """
    content = await file.read()
    text = content.decode('utf-8')
    
    imported = 0
    skipped = 0
    errors = []
    
    # 解析每行
    for line_num, line in enumerate(text.strip().split('\n'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        parts = [p.strip() for p in line.split(',', 1)]
        if len(parts) < 2:
            errors.append(f"Line {line_num}: Invalid format")
            continue
        
        date_str, name = parts[0], parts[1]
        
        # 驗證日期格式
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            errors.append(f"Line {line_num}: Invalid date format '{date_str}'")
            continue
        
        # 檢查是否已存在
        existing = session.exec(
            select(Holiday).where(Holiday.date == date_str)
        ).first()
        if existing:
            skipped += 1
            continue
        
        # 新增假日
        holiday = Holiday(date=date_str, name=name)
        session.add(holiday)
        imported += 1
    
    session.commit()
    
    return {
        "status": "success",
        "imported": imported,
        "skipped": skipped,
        "errors": errors
    }


# ============ Holiday Settings ============

@router.get("/settings/public", response_model=HolidaySettingsResponse)
def get_public_holiday_settings(
    session: Session = Depends(get_session)
):
    """取得假日設定 (公開)"""
    settings = session.exec(
        select(HolidaySettings).where(HolidaySettings.id == 1)
    ).first()
    
    if not settings:
        settings = HolidaySettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    return settings

@router.get("/settings", response_model=HolidaySettingsResponse)
def get_holiday_settings(
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """取得假日設定"""
    settings = session.exec(
        select(HolidaySettings).where(HolidaySettings.id == 1)
    ).first()
    
    if not settings:
        # 建立預設設定
        settings = HolidaySettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    return settings


@router.put("/settings", response_model=HolidaySettingsResponse)
def update_holiday_settings(
    settings_update: HolidaySettingsUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin)
):
    """更新假日設定"""
    settings = session.exec(
        select(HolidaySettings).where(HolidaySettings.id == 1)
    ).first()
    
    if not settings:
        settings = HolidaySettings(id=1)
        session.add(settings)
    
    settings.exclude_saturday = settings_update.exclude_saturday
    settings.exclude_sunday = settings_update.exclude_sunday
    settings.updated_at = datetime.utcnow()
    
    session.commit()
    session.refresh(settings)
    return settings
