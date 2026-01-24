"""
通用 AI Copilot 服務
支援多種頁面 context 的 AI 對話功能
"""
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select
from app.database import engine
from app.models import UserSettings
from app.services.openai_service import OpenAIService


class CopilotService:
    """通用 AI Copilot 服務"""
    
    SYSTEM_PROMPTS = {
        "gitlab_dashboard": """你是一個 GitLab 專案管理助手。你有權存取使用者提供的 GitLab 活動數據，包括：
- Commits 記錄
- Merge Requests
- KPI 指標（行數變更、commit 頻率等）

請根據這些數據回答使用者的問題。回答時：
1. 使用繁體中文
2. 提供具體的數據和洞見
3. 如果被問到績效問題，客觀分析但避免過度批評
4. 可以建議改進方向""",

        "task_workbench": """你是一個任務管理助手。你有權存取使用者的 Redmine 任務數據，包括：
- 任務清單（標題、狀態、指派人）
- 任務詳細描述和工作紀錄
- 任務進度和截止日期

請根據這些數據回答使用者的問題。回答時：
1. 使用繁體中文
2. 可以總結任務狀態、進度
3. 可以分析誰有最多待辦工作
4. 可以總結特定任務的內容""",

        "ai_summary": """你是一個工作報告助手。你有權存取使用者的工作總結報告。

請根據報告內容回答使用者的問題。回答時：
1. 使用繁體中文
2. 可以解釋報告中的內容
3. 可以提供額外分析或建議
4. 可以幫忙潤飾或修改報告內容"""
    }
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.openai_service = self._get_openai_service()
    
    def _get_openai_service(self) -> Optional[OpenAIService]:
        """取得 OpenAI 服務實例"""
        with Session(engine) as session:
            settings = session.exec(
                select(UserSettings).where(UserSettings.user_id == self.user_id)
            ).first()
            
            if not settings or not settings.openai_key:
                return None
            
            return OpenAIService(
                api_key=settings.openai_key,
                base_url=settings.openai_url,
                model=settings.openai_model or "gpt-4o-mini"
            )
    
    async def chat(
        self,
        context_type: str,
        message: str,
        context_data: Dict[str, Any],
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        通用對話方法
        
        Args:
            context_type: 頁面類型 (gitlab_dashboard, task_workbench, ai_summary)
            message: 使用者訊息
            context_data: 頁面上下文數據
            conversation_history: 對話歷史
        
        Returns:
            Dict with 'response' key containing AI response
        """
        if not self.openai_service:
            return {"response": "❌ 尚未設定 OpenAI API Key，請至設定頁面配置。"}
        
        system_prompt = self.SYSTEM_PROMPTS.get(
            context_type, 
            "你是一個有幫助的助手。請使用繁體中文回答。"
        )
        
        # 構建 context 描述
        context_desc = self._build_context_description(context_type, context_data)
        
        messages = [
            {"role": "system", "content": f"{system_prompt}\n\n### 當前頁面數據\n{context_desc}"}
        ]
        
        # 加入對話歷史
        if conversation_history:
            for msg in conversation_history[-10:]:  # 只保留最近 10 條
                messages.append(msg)
        
        # 加入當前訊息
        messages.append({"role": "user", "content": message})
        
        try:
            response = await self.openai_service.chat_completion(messages)
            return {"response": response}
        except Exception as e:
            return {"response": f"❌ AI 請求失敗: {str(e)}"}
    
    def _build_context_description(self, context_type: str, context_data: Dict[str, Any]) -> str:
        """根據 context_type 構建上下文描述"""
        
        if context_type == "gitlab_dashboard":
            return self._build_gitlab_context(context_data)
        elif context_type == "task_workbench":
            return self._build_task_context(context_data)
        elif context_type == "ai_summary":
            return self._build_summary_context(context_data)
        else:
            return str(context_data)
    
    def _build_gitlab_context(self, data: Dict[str, Any]) -> str:
        """構建 GitLab context"""
        lines = []
        
        # KPI (guard against missing or malformed structures)
        if isinstance(data, dict) and data.get("kpi"):
            lines.append("#### KPI 指標")
            kpi = data["kpi"] or {}
            lines.append(f"- 總 Commits: {kpi.get('total_commits', 'N/A')}")
            lines.append(f"- 總 MRs: {kpi.get('total_mrs', 'N/A')}")
            lines.append(f"- 新增行數: {kpi.get('additions', 'N/A')}")
            lines.append(f"- 刪除行數: {kpi.get('deletions', 'N/A')}")

        # Commits (support both dict items and simple string items)
        commits = []
        if isinstance(data, dict) and data.get("commits"):
            commits = data.get("commits") or []
        if commits:
            lines.append("\n#### 最近 Commits")
            for c in commits[:10]:
                if isinstance(c, dict):
                    short_id = c.get('short_id') or c.get('id') or ''
                    author = c.get('author_name') or (c.get('author') if isinstance(c.get('author'), str) else (c.get('author', {}).get('name') if isinstance(c.get('author'), dict) else ''))
                    title = c.get('title') or c.get('message') or ''
                    lines.append(f"- {short_id} | {author} | {title}")
                else:
                    lines.append(f"- {str(c)}")

        # Merge requests (handle author as dict or string)
        mrs = []
        if isinstance(data, dict) and data.get("merge_requests"):
            mrs = data.get("merge_requests") or []
        if mrs:
            lines.append("\n#### 最近 MRs")
            for mr in mrs[:10]:
                if isinstance(mr, dict):
                    iid = mr.get('iid', '')
                    author_field = mr.get('author')
                    if isinstance(author_field, dict):
                        author_name = author_field.get('name', '')
                    else:
                        author_name = str(author_field) if author_field is not None else ''
                    title = mr.get('title', '')
                    state = mr.get('state', '')
                    lines.append(f"- !{iid} | {author_name} | {title} ({state})")
                else:
                    lines.append(f"- {str(mr)}")
        
        return "\n".join(lines) if lines else "無可用數據"
    
    def _build_task_context(self, data: Dict[str, Any]) -> str:
        """構建任務 context"""
        lines = []
        
        if data.get("summary"):
            lines.append(f"#### 任務摘要\n{data['summary']}")
        
        if data.get("tasks"):
            lines.append("\n#### 任務清單")
            for t in data["tasks"][:30]:  # 限制數量
                status = t.get("status_name", "")
                assignee = t.get("assigned_to_name", "未指派")
                lines.append(f"- #{t.get('id', '')} | {t.get('subject', '')} | {status} | {assignee}")
        
        if data.get("selected_task"):
            task = data["selected_task"]
            lines.append(f"\n#### 選中的任務詳情")
            lines.append(f"- ID: #{task.get('id', '')}")
            lines.append(f"- 標題: {task.get('subject', '')}")
            lines.append(f"- 描述: {task.get('description', '無')}")
            if task.get("journals"):
                lines.append("- 工作紀錄:")
                for j in task["journals"][:10]:
                    lines.append(f"  - {j.get('created_on', '')}: {j.get('notes', '')[:200]}")
        
        return "\n".join(lines) if lines else "無可用數據"
    
    def _build_summary_context(self, data: Dict[str, Any]) -> str:
        """構建報告 context"""
        if data.get("report_content"):
            return f"#### 報告內容\n{data['report_content'][:5000]}"
        return "無報告內容"


def get_copilot_service(user_id: int) -> CopilotService:
    """Dependency for FastAPI"""
    return CopilotService(user_id)
