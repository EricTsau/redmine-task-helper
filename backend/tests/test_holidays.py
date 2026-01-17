"""
Holiday Service 測試
"""
import pytest
from datetime import date, timedelta
from sqlmodel import Session, SQLModel, create_engine
from app.models import Holiday, HolidaySettings
from app.services.workday_calculator import WorkdayCalculator


@pytest.fixture(name="session")
def session_fixture():
    """建立測試用 in-memory 資料庫"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestWorkdayCalculator:
    """工作日計算器測試"""

    def test_is_working_day_weekday(self, session: Session):
        """測試平日是工作日"""
        # 設定排除週末
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 2026-01-19 是週一
        monday = date(2026, 1, 19)
        assert calculator.is_working_day(monday) is True

    def test_is_working_day_weekend_excluded(self, session: Session):
        """測試排除週末設定"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 2026-01-18 是週日
        sunday = date(2026, 1, 18)
        assert calculator.is_working_day(sunday) is False
        
        # 2026-01-17 是週六
        saturday = date(2026, 1, 17)
        assert calculator.is_working_day(saturday) is False

    def test_is_working_day_weekend_included(self, session: Session):
        """測試不排除週末時週末是工作日"""
        settings = HolidaySettings(id=1, exclude_saturday=False, exclude_sunday=False)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 2026-01-18 是週日
        sunday = date(2026, 1, 18)
        assert calculator.is_working_day(sunday) is True

    def test_is_working_day_with_holiday(self, session: Session):
        """測試假日被排除"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        
        # 新增假日 (2026-01-20 週一)
        holiday = Holiday(date="2026-01-20", name="測試假日")
        session.add(holiday)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        holiday_date = date(2026, 1, 20)
        assert calculator.is_working_day(holiday_date) is False

    def test_calculate_due_date_no_weekend(self, session: Session):
        """測試計算結束日期（無週末阻擋）"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 從週一開始，3 個工作天
        start = date(2026, 1, 19)  # 週一
        due = calculator.calculate_due_date(start, 3)
        
        # 週一(19) + 週二(20) + 週三(21) = 週三
        assert due == date(2026, 1, 21)

    def test_calculate_due_date_across_weekend(self, session: Session):
        """測試計算結束日期（跨週末）"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 從週五開始，3 個工作天
        start = date(2026, 1, 16)  # 週五
        due = calculator.calculate_due_date(start, 3)
        
        # 週五(16) + [跳過週六日] + 週一(19) + 週二(20) = 週二
        assert due == date(2026, 1, 20)

    def test_calculate_due_date_with_holiday(self, session: Session):
        """測試計算結束日期（含假日）"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        
        # 2026-01-20 (週一) 是假日
        holiday = Holiday(date="2026-01-20", name="測試假日")
        session.add(holiday)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        # 從週五開始，3 個工作天
        start = date(2026, 1, 16)  # 週五
        due = calculator.calculate_due_date(start, 3)
        
        # 週五(16)=1天 + [跳過週六日] + [跳過假日週一20] + 週二(21)=2天 + 週三(22)=3天 
        # 實際: 16(五)+跳過17(六)+跳過18(日)+跳過20(假日)+21(二)+22(三) = 結果應該是21或22
        # 測試調整：根據計算邏輯，如果16是第1天，跳過17/18週末，20是假日也跳過
        # 19(一)=2天, 21(二)=3天 = 21日
        assert due == date(2026, 1, 21)  # 週五(1st) -> 週一(2nd) -> 週二(3rd)

    def test_get_working_days_between(self, session: Session):
        """測試計算兩日期間的工作天數"""
        settings = HolidaySettings(id=1, exclude_saturday=True, exclude_sunday=True)
        session.add(settings)
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        start = date(2026, 1, 19)  # 週一
        end = date(2026, 1, 23)    # 週五
        
        working_days = calculator.get_working_days_between(start, end)
        assert working_days == 5

    def test_get_holidays_between(self, session: Session):
        """測試取得期間內假日"""
        holiday1 = Holiday(date="2026-01-20", name="假日1")
        holiday2 = Holiday(date="2026-01-22", name="假日2")
        holiday3 = Holiday(date="2026-02-01", name="假日3")  # 範圍外
        session.add_all([holiday1, holiday2, holiday3])
        session.commit()
        
        calculator = WorkdayCalculator(session)
        
        holidays = calculator.get_holidays_between(
            date(2026, 1, 19),
            date(2026, 1, 25)
        )
        
        assert len(holidays) == 2
        assert holidays[0].name == "假日1"
        assert holidays[1].name == "假日2"
