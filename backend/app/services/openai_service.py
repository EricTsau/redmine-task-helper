import json
from typing import Optional, Dict, Any, List
import openai
from app.models import TimeEntryExtraction
import httpx
from datetime import datetime, timedelta
import threading
import asyncio

class OpenAIService:
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini"):
        http_client = httpx.Client(trust_env=False)
        self.client = openai.OpenAI(
            api_key=api_key,
            base_url=base_url,
            http_client=http_client
        )
        # expose base_url and api_key for streaming helper
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def chat_completion(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
        """
        通用的 Chat Completion 方法
        
        Args:
            messages: OpenAI 格式的訊息列表 [{"role": "system/user/assistant", "content": "..."}]
            temperature: 創意程度 (0-1)
            
        Returns:
            AI 回應的純文字內容
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    def extract_time_entry(self, user_input: str) -> TimeEntryExtraction:
        """
        從自然語言中提取工時紀錄資訊。
        """
        system_prompt = """
        You are an AI assistant for a project management tool (Redmine).
        Your goal is to extract structured time entry data from the user's natural language input.
        
        Extract the following fields:
        - issue_id: The Redmine issue ID (e.g., #1234 -> 1234). If not found, return null.
        - project_name: The name of the project. If not found, return null.
        - hours: The number of hours spent. Parse "2h", "2.5 hours", "30 mins" (convert to hours).
        - activity_name: The activity type (e.g., "Development", "Design", "Meeting"). Default to "Development" if unsure.
        - comments: A brief description of the work done.
        - confidence_score: A float between 0 and 1 indicating how confident you are in the extraction.

        Return the result as a valid JSON object matching this structure:
        {
            "issue_id": int | null,
            "project_name": str | null,
            "hours": float,
            "activity_name": str,
            "comments": str,
            "confidence_score": float
        }
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input}
                ],
                response_format={"type": "json_object"},
                temperature=0
            )
            
            content = response.choices[0].message.content
            data = json.loads(content)
            return TimeEntryExtraction(**data)
        except Exception as e:
            print(f"OpenAI Extraction Error: {e}")
            # Return a fallback empty/error object or raise
            raise e

    def extract_query_filter(self, message: str) -> Dict[str, Any]:
        """
        Phase 1: Intent Extraction
        Convert natural language query into Redmine advanced search parameters.
        """
        now_str = datetime.now().strftime("%Y-%m-%d")
        
        schema = {
            "type": "object",
            "properties": {
                "project_id": {"type": "integer", "description": "Project ID if specific project mentioned"},
                "assigned_to": {"type": "string", "enum": ["me", "all"], "description": "'me' if asking about self, else null or 'all'"},
                "status": {"type": "string", "enum": ["open", "closed", "all"], "description": "Issue status"},
                "query": {"type": "string", "description": "Keyword to search in subject"},
                "limit": {"type": "integer", "description": "Number of items to fetch, default 20"},
                "days_ago": {"type": "integer", "description": "If asking for recent items, how many days ago? e.g. 7 for 'this week'"}
            },
            "required": ["status", "limit"]
        }

        prompt = f"""
        You are a Redmine Query Parser. Today is {now_str}.
        Convert user question into search filter parameters.
        Question: "{message}"
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": "You convert natural language to Redmine query filters."},
                          {"role": "user", "content": prompt}],
                functions=[{
                    "name": "build_redmine_filter",
                    "description": "Builds filter parameters for Redmine API",
                    "parameters": schema
                }],
                function_call={"name": "build_redmine_filter"}
            )
            
            args = json.loads(response.choices[0].message.function_call.arguments)
            
            # Post-processing: Calculate updated_after if days_ago is present
            if "days_ago" in args:
                date_threshold = datetime.now() - timedelta(days=args["days_ago"])
                args["updated_after"] = date_threshold.strftime("%Y-%m-%d")
                del args["days_ago"]
                
            return args
        except Exception as e:
            print(f"OpenAI Filter Extraction Error: {e}")
            return {"status": "open", "limit": 10}

    def summarize_issues(self, issues: List[Dict[str, Any]], user_query: str) -> str:
        """
        Phase 3: Insight Generation
        Summarize the fetched Redmine issues in response to the user's original query.
        """
        if not issues:
            return "No matching issues found."

        # Simplify data for context window
        issues_summary = []
        for i in issues:
            status_name = i.get('status', {}).get('name', 'Unknown') if isinstance(i.get('status'), dict) else str(i.get('status'))
            subject = i.get('subject', 'No Subject')
            issues_summary.append(f"#{i.get('id')} {subject} (Status: {status_name}, %Done: {i.get('done_ratio')})")
        
        data_text = "\n".join(issues_summary)
        
        prompt = f"""
        User Query: "{user_query}"
        
        Redmine Data:
        {data_text}
        
        Please provide a concise management summary (bullet points) answering the user's query based on the data. 
        Highlight any high priority items or risks if visible (e.g. high % done but open).
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error generating summary: {str(e)}"

    def classify_intent(self, message: str) -> str:
        """
        Classify user message into: 'time_entry', 'analysis', or 'chat'.
        """
        prompt = f"""
        Classify the following user message into one of these categories:
        1. 'time_entry': User wants to log time, track hours, or record work (e.g., "Logged 2h on #123", "Spent 4 hours", "Record time").
        2. 'analysis': User wants to query data, ask about project status, or get a summary (e.g., "Show open bugs", "Project progress", "List tasks").
        3. 'chat': General conversation or unclear intent.
        
        Message: "{message}"
        
        Return ONLY the category name.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0
            )
            intent = response.choices[0].message.content.strip().lower()
            if intent not in ['time_entry', 'analysis', 'chat']:
                return 'chat'
            return intent
        except Exception as e:
            print(f"Intent Classification Error: {e}")
            return 'chat'

    def refine_log_content(self, content: str) -> str:
        """
        Refine the work log content: fix grammar, improve formatting (Markdown), and organize thoughts.
        """
         # Don't change the meaning, just polish.
        prompt = f"""
        You are a helpful copyeditor. Please refine the following work log content.
        - Fix grammar and spelling mistakes.
        - Improve formatting using Markdown (bullet points, headers) where appropriate.
        - Keep the tone professional but concise.
        - Do NOT summarize; keep all details.
        
        Content:
        {content}
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Refine Log Error: {e}")
            return content # Fallback to original

    def summarize_for_redmine(self, content: str) -> str:
        """
        Generate a concise summary suitable for a Redmine Time Entry comment (limit ~255 chars usually, but we can be a bit longer).
        """
        prompt = f"""
        Summarize the following work log into a single concise sentence or short paragraph suitable for a timesheet entry.
        - Focus on WHAT was achieved.
        - Avoid "I worked on...", just state the task (e.g., "Fixed bug in login module", "Refactored API").
        
        Content:
        {content}
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summarize Log Error: {e}")
            return content[:100] + "..." # Fallback

    def generate_work_log(self, context: Dict[str, Any]) -> str:
        """
        Generate a work log based on the provided context (issue details, duration, etc).
        """
        prompt = f"""
        You are a helpful assistant assisting a developer to write a work log.
        Here is the context of the task:
        - Issue ID: #{context.get('issue_id')}
        - Issue Subject: {context.get('issue_subject', 'Unknown')}
        - Project: {context.get('project_name', 'Unknown')}
        - Duration: {context.get('duration_str', 'Unknown')}
        
        Please generate a professional and concise work log entry describing the work done for this task.
        Since you don't know the exact details, provide a template with placeholders for specific implementation details, 
        or infer generic steps based on the subject (e.g. if subject is "Fix bug", mention "Investigated root cause, implemented fix, verified").
        
        Output format: Markdown.
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Generate Log Error: {e}")
            return "Failed to generate log."

    async def stream_chat(self, messages: List[Dict[str, str]], temperature: float = 0.7):
        """
        Async generator that yields streaming chat completions from OpenAI as text chunks.

        Usage:
            async for chunk in service.stream_chat(messages):
                # handle chunk (string)
        """
        # Use the SDK client's streaming generator in a background thread
        loop = asyncio.get_running_loop()
        q: asyncio.Queue = asyncio.Queue()

        def worker():
            try:
                # Use context manager to get a ChatCompletionStream (iterable)
                with self.client.chat.completions.stream(model=self.model, messages=messages, temperature=temperature) as stream:
                    for event in stream:
                        try:
                            # event has `type` and payload fields (e.g., delta for content.delta)
                            etype = getattr(event, 'type', None)
                            if etype == 'content.delta':
                                delta = getattr(event, 'delta', None)
                                if delta:
                                    loop.call_soon_threadsafe(q.put_nowait, delta)
                            elif etype == 'content.done':
                                content = getattr(event, 'content', None)
                                if content:
                                    loop.call_soon_threadsafe(q.put_nowait, content)
                        except Exception as e:
                            loop.call_soon_threadsafe(q.put_nowait, f"[ERROR]{str(e)}")
                            continue
            except Exception as e:
                loop.call_soon_threadsafe(q.put_nowait, f"[ERROR]{str(e)}")
            finally:
                loop.call_soon_threadsafe(q.put_nowait, None)

        t = threading.Thread(target=worker, daemon=True)
        t.start()

        while True:
            item = await q.get()
            if item is None:
                break
            yield item

    def edit_text(self, selection: str, instruction: str) -> str:
        """
        Edit the selected text based on specific user instructions.
        """
        prompt = f"""
        You are a text editor assistant.
        User Instruction: "{instruction}"
        
        Selected Text:
        "{selection}"
        
        Please provide the rewritten version of the selected text based on the instruction. 
        Refuse to answer if the instruction is unrelated to editing.
        Return ONLY the rewritten text.
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Edit Text Error: {e}")
            return selection

    def parse_prd_to_tasks(self, conversation: List[Dict[str, Any]], project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        根據 PRD 對話內容拆解為任務清單
        
        Args:
            conversation: 對話訊息列表 [{"role": "user/assistant", "content": "..."}]
            project_context: 專案資訊 {"id": int, "name": str}
            
        Returns:
            {
                "message": "AI 回應訊息",
                "tasks": [{"subject", "estimated_hours", "start_date", "due_date", "predecessors"}]
            }
        """
        today = datetime.now().strftime("%Y-%m-%d")
        
        system_prompt = f"""
你是一位資深專案經理 (PM)，負責協助使用者釐清專案需求文件 (PRD) 並將需求拆解為具體的任務清單。

專案資訊：
- 專案名稱：{project_context.get('name', 'Unknown')}
- 專案 ID：{project_context.get('id', 0)}
- 今天日期：{today}

你的職責：
1. 仔細閱讀使用者的需求描述
2. 提出澄清問題以確保需求完整
3. 當需求足夠清晰時，將 PRD 拆解為具體的 Task List

任務清單格式 (JSON)：
{{
    "message": "你的回應訊息，可以是確認理解、提問或總結",
    "tasks": [
        {{
            "subject": "任務名稱",
            "description": "任務描述（包含：目標 (Goal) 與 完成定義 (DOD)）",
            "estimated_hours": 8,
            "start_date": "YYYY-MM-DD",
            "due_date": "YYYY-MM-DD",
            "predecessors": []
        }}
    ]
}}

規則：
- 如果需求還不夠清晰，tasks 陣列可以為空，並在 message 中詢問更多細節
- 如果需求清晰，拆解為 3-10 個具體可執行的子任務
-description 必須包含具體的「目標」與「DOD (Definition of Done)」
- estimated_hours 應該是合理的工時預估 (1-40 小時)
- start_date 從今天開始，根據任務順序安排
- due_date 根據 estimated_hours 計算 (假設每天 8 工作小時)
- predecessors 是任務相依性，使用 1-based 索引 (例如 [1,2] 表示依賴第 1 和第 2 個任務)

回應格式：嚴格 JSON，確保可以 parse
"""

        # 建立訊息列表
        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation:
            messages.append({"role": msg["role"], "content": msg["content"]})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            
            # 嘗試提取 JSON (支援 ```json 格式)
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
            if json_match:
                json_str = json_match.group(1).strip()
            else:
                # 嘗試直接解析整個內容
                json_str = content.strip()
            
            result = json.loads(json_str)
            
            # 確保必要欄位存在
            if "message" not in result:
                result["message"] = "任務已拆解完成"
            if "tasks" not in result:
                result["tasks"] = []
                
            return result
        except json.JSONDecodeError as e:
            print(f"PRD Parsing JSON Error: {e}")
            # 如果 JSON 解析失敗，嘗試擷取部分內容作為訊息
            return {
                "message": content if content else "抱歉，我在處理回應時遇到問題。請再告訴我一次您的需求。",
                "tasks": []
            }
        except Exception as e:
            print(f"PRD Parsing Error: {e}")
            return {
                "message": f"處理時發生錯誤：{str(e)}",
                "tasks": []
            }


    def generate_executive_briefing(self, context: str) -> str:
        """
        Generate an executive briefing based on the provided context.
        """
        system_prompt = """
        You are a Chief of Staff or Senior Project Manager assistant.
        Your goal is to write a high-quality, professional Executive Briefing for C-level executives.
        
        Input Context:
        The context contains Project Status summaries, Overdue Risks, and Recent Achievements.
        
        Output Requirements:
        1. Format: Markdown
        2. Tone: Professional, objective, concise yet insightful.
        3. Structure:
           # Executive Briefing {Date}
           ## 1. Executive Summary
           (One paragraph summary of the overall portfolio health, major wins, and critical risks)
           
           ## 2. Portfolio Status
           (Bullet points on key projects)
           
           ## 3. Risk Assessment
           (Highlight critical delays/risks and their potential impact)
           
           ## 4. Recent Achievements
           (Briefly mention what was completed)
           
           ## 5. Recommendations
           (Actionable advice based on the risks)
           
        4. Language: Traditional Chinese (繁體中文).
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": context}
                ],
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Executive Briefing Gen Error: {e}")
            return f"# Error\nFailed to generate briefing: {str(e)}"
