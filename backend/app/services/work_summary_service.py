from typing import List, Dict, Any, Optional, TypedDict
from datetime import datetime
import json
from sqlmodel import Session, select
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.models import User, AIWorkSummarySettings, AIWorkSummaryReport
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.models import UserSettings

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

        # Extract title from markdown (first H1/H2) if present
        md = result.get("summary_markdown", "") or ""
        title = None
        for line in md.splitlines():
            line = line.strip()
            if line.startswith('#'):
                # remove leading hashes and whitespace
                title = line.lstrip('#').strip()
                break

        if not title:
            title = f"工作總結 {start_date} ~ {end_date}"

        # Save Report
        report = AIWorkSummaryReport(
            owner_id=self.user.id,
            title=title,
            date_range_start=start_date,
            date_range_end=end_date,
            summary_markdown=md,
            conversation_history="[]"
        )
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    async def _fetch_logs_node(self, state: AgentState) -> Dict:
        start_date = state.get('start_date')
        end_date = state.get('end_date') or start_date

        users_set = set(state["user_ids"])
        projects_set = set(state["project_ids"])

        # 1. Fetch Issues updated in range
        try:
            issues = self.redmine.search_issues_advanced(
                updated_after=start_date,
                limit=500
            )
        except Exception as e:
            print(f"Error fetching issues: {e}")
            issues = []

        filtered_issues = []
        structured_issues = []
        for issue in issues:
            try:
                pid = issue.project.id
            except Exception:
                continue
            if pid in projects_set:
                # client-side end_date filter if server didn't apply
                updated_on = getattr(issue, 'updated_on', None)
                include_issue = True
                if updated_on and isinstance(updated_on, str):
                    if updated_on.split('T')[0] > end_date:
                        include_issue = False
                if include_issue:
                    filtered_issues.append(issue)
                    # fetch journals
                    journals = []
                    try:
                        journals = self.redmine.get_issue_journals(issue.id)
                    except Exception:
                        journals = []
                    structured_issues.append({
                        'id': issue.id,
                        'project_id': pid,
                        'project_name': getattr(issue.project, 'name', ''),
                        'subject': getattr(issue, 'subject', ''),
                        'status': getattr(issue.status, 'name', ''),
                        'updated_on': getattr(issue, 'updated_on', ''),
                        'journals': journals,
                        'description': getattr(issue, 'description', '') or ''
                    })

        # 2. Fetch time entries for the projects / users in the date range
        time_entries = []
        for pid in projects_set:
            try:
                entries = self.redmine.search_time_entries(
                    user_ids=list(users_set) if users_set else None,
                    project_id=pid,
                    from_date=start_date,
                    to_date=end_date,
                    limit=500
                )
            except Exception:
                entries = []

            for e in entries:
                te_date = getattr(e, 'spent_on', None) or getattr(e, 'created_on', None) or ''
                te_hours = getattr(e, 'hours', getattr(e, 'hours', 0))
                te_user = getattr(e, 'user', None)
                te_user_name = getattr(te_user, 'name', '') if te_user else ''
                te_issue = getattr(e, 'issue', None)
                te_issue_id = getattr(te_issue, 'id', '') if te_issue else ''
                time_entries.append({
                    'date': te_date,
                    'hours': te_hours,
                    'user': te_user_name,
                    'issue_id': te_issue_id,
                    'comments': getattr(e, 'comments', '')
                })

        # Build raw_logs structured for analysis + summary
        raw_summary_lines = []
        raw_summary_lines.append(f"Found {len(structured_issues)} updated issues in targeted projects.")
        for i in structured_issues:
            raw_summary_lines.append(f"- [{i['id']}] {i['subject']} (Project: {i['project_name']}, Status: {i['status']}, Updated: {i['updated_on']})")
            for j in i.get('journals', []):
                raw_summary_lines.append(f"  - Journal by {j.get('user')}: {j.get('notes')}")

        raw_summary_lines.append(f"\nFound {len(time_entries)} time entries in range.")
        for te in time_entries:
            raw_summary_lines.append(f"- [{te.get('date')}] Issue:{te.get('issue_id')} User:{te.get('user')} Hours:{te.get('hours')} Comments:{te.get('comments')}")

        raw_text = "\n".join(raw_summary_lines)

        # Return both structured data and aggregated text for backwards compatibility
        return {
            "raw_logs": [{"summary": raw_text}],
            'time_entries_count': len(time_entries),
            'issues': structured_issues,
            'time_entries': time_entries
        }

    async def _analyze_logs_node(self, state: AgentState) -> Dict:
        # Compose analysis prompt including structured issues/time entries and link template
        logs_text = "\n".join([l["summary"] for l in state.get("raw_logs", [])])
        issues = state.get('issues', []) or []
        time_entries = state.get('time_entries', []) or []

        # Determine redmine base URL: prefer user's settings, fallback to RedmineService.base_url
        user_settings = self.session.exec(
            select(UserSettings).where(UserSettings.user_id == self.user.id)
        ).first()
        redmine_base = ''
        if user_settings and getattr(user_settings, 'redmine_url', None):
            redmine_base = user_settings.redmine_url.rstrip('/')
        else:
            redmine_base = getattr(self.redmine, 'base_url', '') if hasattr(self.redmine, 'base_url') else ''
        # Build multiple subject headings when an issue subject contains ' / ' or ';'
        issue_lines = []
        for i in issues:
            link = f"{redmine_base}/issues/{i['id']}" if redmine_base else f"issues/{i['id']}"
            subject = i.get('subject') or ''
            # split into multiple subjects by common separators to create multi-subject entries
            parts = [s.strip() for s in subject.replace(';', '/').split('/') if s.strip()]
            if len(parts) <= 1:
                issue_lines.append(f"- [{i['id']}] [{subject}]({link}) (Project: {i['project_name']})")
            else:
                # For multiple subjects, create a sub-list under the issue
                issue_lines.append(f"- [{i['id']}] [{parts[0]}]({link}) (Project: {i['project_name']})")
                for extra in parts[1:]:
                    issue_lines.append(f"  - Subject: {extra}")

        te_lines = []
        for te in time_entries:
            te_lines.append(f"- {te.get('date')} | Issue:{te.get('issue_id')} | User:{te.get('user')} | Hours:{te.get('hours')} | {te.get('comments')}")

        # Build prompt with explicit sections: Title, Internal Summary, Data, and Link template
        prompt = f"""
        請根據以下 Redmine 工作紀錄，整理出一份工作總結報告。

        時間範圍: {state['start_date']} 到 {state['end_date']}

        要求:
        - 報告需包含一個**富有創意且專業的總結標題 (Title)**(請在文件開頭以 # H1 標示)，一個針對此範圍的內部描述 summary（以簡短段落呈現），以及一個清楚的 Markdown 表格或列表，列出主要工作項目。
        - 表格欄位包含: 日期, 專案, 人員, 任務(含 Redmine 連結), 工作內容摘要, 耗時(若有)。
        - 使用以下 Issue 連結格式: [Issue #ID]({redmine_base}/issues/ID)

        原始彙整資料(供參考):
        {logs_text}

        Issues:
        {"\n".join(issue_lines)}

        Time Entries:
        {"\n".join(te_lines)}

        請輸出完整的 Markdown 文件，包含 Title 與 Internal Summary，且在文件開頭明顯標示時間範圍。
        """

        # Call OpenAI
        response = await self.openai.chat_completion([
            {"role": "system", "content": "你是專業的專案經理助手，擅長整理工作報告。"},
            {"role": "user", "content": prompt}
        ])

        # Ensure we save both markdown and structured context for future chat
        return {"summary_markdown": response, 'issues': issues, 'time_entries': time_entries}

    async def chat_with_report(self, report_id: int, message: str, action: str) -> Dict[str, Any]:
        report = self.get_report(report_id)
        if not report:
            raise Exception("Report not found")
            
        history = json.loads(report.conversation_history or "[]")
        
        # Build context from summary
        system_prompt = f"""
        你是專業的專案經理助手。使用者正在檢視一份工作總結報告。
        
        目前的報告內容:
        {report.summary_markdown}
        
        請根據使用者的指示進行回應。
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history
        # Simplify history to last 5 rounds to save tokens
        for msg in history[-10:]: 
            messages.append(msg)
            
        messages.append({"role": "user", "content": message})
        
        if action == "refine":
            # Add instruction for refinement
            messages.append({"role": "system", "content": "使用者要求根據上述指示「重新撰寫」或「補充」整份報告。請輸出完整的、更新後的 Markdown 報告內容。"})
            
        response_text = await self.openai.chat_completion(messages)
        
        # Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response_text})
        report.conversation_history = json.dumps(history)
        
        result = {"response": response_text}
        
        if action == "refine":
            report.summary_markdown = response_text
            result["updated_summary"] = response_text
            
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        
        return result

    def update_report_content(self, report_id: int, content: Optional[str] = None, title: Optional[str] = None) -> Optional[AIWorkSummaryReport]:
        report = self.get_report(report_id)
        if not report:
            return None
            
        if content is not None:
            report.summary_markdown = content
        
        if title is not None:
            report.title = title

        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    def delete_report(self, report_id: int) -> bool:
        report = self.get_report(report_id)
        if not report:
            return False
        self.session.delete(report)
        self.session.commit()
        return True
