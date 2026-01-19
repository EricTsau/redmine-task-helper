from typing import List, Dict, Any, Optional, TypedDict
from datetime import datetime
import json
from sqlmodel import Session, select
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.models import User, AIWorkSummarySettings, AIWorkSummaryReport
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService

class AgentState(TypedDict):
    project_ids: List[int]
    user_ids: List[int]
    start_date: str
    end_date: str
    raw_logs: List[Dict[str, Any]]
    summary_markdown: str
    messages: List[Any]

class WorkSummaryService:
    def __init__(self, session: Session, user: User, redmine: RedmineService, openai: OpenAIService):
        self.session = session
        self.user = user
        self.redmine = redmine
        self.openai = openai

    def get_settings(self) -> AIWorkSummarySettings:
        settings = self.session.exec(
            select(AIWorkSummarySettings).where(AIWorkSummarySettings.owner_id == self.user.id)
        ).first()
        
        if not settings:
            settings = AIWorkSummarySettings(owner_id=self.user.id)
            self.session.add(settings)
            self.session.commit()
            self.session.refresh(settings)
        return settings

    def update_settings(self, project_ids: List[int], user_ids: List[int]) -> AIWorkSummarySettings:
        settings = self.get_settings()
        settings.target_project_ids = json.dumps(project_ids)
        settings.target_user_ids = json.dumps(user_ids)
        settings.updated_at = datetime.utcnow()
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings

    def get_history(self) -> List[AIWorkSummaryReport]:
        return self.session.exec(
            select(AIWorkSummaryReport)
            .where(AIWorkSummaryReport.owner_id == self.user.id)
            .order_by(AIWorkSummaryReport.created_at.desc())
        ).all()

    def get_report(self, report_id: int) -> Optional[AIWorkSummaryReport]:
        return self.session.exec(
            select(AIWorkSummaryReport)
            .where(AIWorkSummaryReport.id == report_id)
            .where(AIWorkSummaryReport.owner_id == self.user.id)
        ).first()

    async def generate_summary(self, start_date: str, end_date: str) -> AIWorkSummaryReport:
        settings = self.get_settings()
        project_ids = json.loads(settings.target_project_ids)
        user_ids = json.loads(settings.target_user_ids)

        if not project_ids or not user_ids:
            return AIWorkSummaryReport(
                owner_id=self.user.id,
                title="Error",
                summary_markdown="請先設定關注的專案與人員"
            )

        # Build Graph
        workflow = StateGraph(AgentState)
        workflow.add_node("fetch_logs", self._fetch_logs_node)
        workflow.add_node("analyze_logs", self._analyze_logs_node)
        workflow.set_entry_point("fetch_logs")
        workflow.add_edge("fetch_logs", "analyze_logs")
        workflow.add_edge("analyze_logs", END)
        app = workflow.compile()

        inputs = {
            "project_ids": project_ids,
            "user_ids": user_ids,
            "start_date": start_date,
            "end_date": end_date,
            "raw_logs": [],
            "summary_markdown": "",
            "messages": []
        }

        result = await app.ainvoke(inputs)

        # Save Report
        report = AIWorkSummaryReport(
            owner_id=self.user.id,
            title=f"工作總結 {start_date} ~ {end_date}",
            date_range_start=start_date,
            date_range_end=end_date,
            summary_markdown=result["summary_markdown"],
            conversation_history="[]"
        )
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    async def _fetch_logs_node(self, state: AgentState) -> Dict:
        # Mocking or implementing actual Redmine fetch
        # Need to implement get_work_logs in RedmineService or do it here
        # For now, let's assume we implement a method here or use existing
        
        logs = []
        # TODO: Batch fetch time entries and issue journals
        # This is a placeholder for the actual complex fetching logic
        # We need to filter by user_ids, project_ids and date range
        
        # 1. Fetch Issues updated in range
        issues = self.redmine.search_issues_advanced(
            updated_after=state["start_date"],
            limit=50 # limit
        )
        
        users_set = set(state["user_ids"])
        projects_set = set(state["project_ids"])
        
        filtered_issues = []
        for issue in issues:
            # Filter by project
            if issue.project.id in projects_set:
                filtered_issues.append(issue)

        # Build raw text log
        raw_text = f"Found {len(filtered_issues)} updated issues in targeted projects."
        for i in filtered_issues:
            status_name = getattr(i.status, 'name', 'Unknown')
            raw_text += f"\n- [{i.id}] {i.subject} (Status: {status_name}, Updated: {i.updated_on})"

        return {"raw_logs": [{"summary": raw_text}]}

    async def _analyze_logs_node(self, state: AgentState) -> Dict:
        logs_text = "\n".join([l["summary"] for l in state["raw_logs"]])
        prompt = f"""
        請根據以下 Redmine 工作紀錄，整理出一份工作總結報告。
        
        時間範圍: {state['start_date']} 到 {state['end_date']}
        
        格式要求:
        1. 使用 Markdown Table 呈現主要工作項目。
        2. 欄位包含: 日期, 專案, 人員, 任務(含連結), 工作內容摘要, 耗時(若有)。
        3. 附上 Markdown 總結分析 (各專案進度、風險等)。
        4. 連結格式: [Issue #ID](redmine_url/issues/ID)
        
        資料:
        {logs_text}
        """
        
        # Call OpenAI
        response = await self.openai.chat_completion([
            {"role": "system", "content": "你是專業的專案經理助手，擅長整理工作報告。"},
            {"role": "user", "content": prompt}
        ])
        
        return {"summary_markdown": response}
