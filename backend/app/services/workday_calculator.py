"""
工作日計算服務
提供根據假日設定計算工作日的功能
"""
from datetime import date, timedelta
from typing import List, Optional
from sqlmodel import Session, select
from app.models import Holiday, HolidaySettings


class WorkdayCalculator:
    """工作日計算器"""
    
    def __init__(self, session: Session):
        self.session = session
        self._holidays_cache: Optional[set] = None
        self._settings_cache: Optional[HolidaySettings] = None
    
    def _load_settings(self) -> HolidaySettings:
        """載入假日設定"""
        if self._settings_cache is None:
            settings = self.session.exec(
                select(HolidaySettings).where(HolidaySettings.id == 1)
            ).first()
            if not settings:
                # 使用預設值
                settings = HolidaySettings(id=1)
            self._settings_cache = settings
        return self._settings_cache
    
    def _load_holidays(self) -> set:
        """載入所有假日日期"""
        if self._holidays_cache is None:
            holidays = self.session.exec(select(Holiday)).all()
            self._holidays_cache = {h.date for h in holidays}
        return self._holidays_cache
    
    def is_working_day(self, check_date: date) -> bool:
        """
        判斷指定日期是否為工作日
        
        Args:
            check_date: 要檢查的日期
            
        Returns:
            True 如果是工作日，False 如果是休息日
        """
        settings = self._load_settings()
        holidays = self._load_holidays()
        
        # 先檢查週末
        weekday = check_date.weekday()  # 0=Monday, 6=Sunday
        if settings.exclude_saturday and weekday == 5:
            return False
        if settings.exclude_sunday and weekday == 6:
            return False
        
        # 再檢查是否為指定假日
        date_str = check_date.strftime("%Y-%m-%d")
        if date_str in holidays:
            return False
        
        return True
    
    def calculate_due_date(self, start_date: date, working_days: int) -> date:
        """
        根據開始日期和工作天數計算結束日期
        
        Args:
            start_date: 開始日期
            working_days: 需要的工作天數
            
        Returns:
            結束日期（包含開始日當天）
        """
        if working_days <= 0:
            return start_date
        
        current_date = start_date
        days_counted = 0
        
        # 如果起始日是工作日，算一天
        if self.is_working_day(current_date):
            days_counted = 1
        
        while days_counted < working_days:
            current_date += timedelta(days=1)
            if self.is_working_day(current_date):
                days_counted += 1
        
        return current_date
    
    def get_working_days_between(self, start_date: date, end_date: date) -> int:
        """
        計算兩個日期之間的工作天數
        
        Args:
            start_date: 開始日期
            end_date: 結束日期
            
        Returns:
            工作天數（包含起始和結束日）
        """
        if end_date < start_date:
            return 0
        
        working_days = 0
        current_date = start_date
        
        while current_date <= end_date:
            if self.is_working_day(current_date):
                working_days += 1
            current_date += timedelta(days=1)
        
        return working_days
    
    def get_holidays_between(self, start_date: date, end_date: date) -> List[Holiday]:
        """
        取得指定期間內的假日列表
        
        Args:
            start_date: 開始日期
            end_date: 結束日期
            
        Returns:
            假日列表
        """
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        
        holidays = self.session.exec(
            select(Holiday)
            .where(Holiday.date >= start_str)
            .where(Holiday.date <= end_str)
            .order_by(Holiday.date)
        ).all()
        
        return list(holidays)
