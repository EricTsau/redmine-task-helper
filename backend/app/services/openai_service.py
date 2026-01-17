import json
from typing import Optional, Dict, Any, List
import openai
from app.models import TimeEntryExtraction
import httpx
from datetime import datetime, timedelta

class OpenAIService:
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini"):
        http_client = httpx.Client(trust_env=False)
        self.client = openai.OpenAI(
            api_key=api_key,
            base_url=base_url,
            http_client=http_client
        )
        self.model = model

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
                temperature=0.3
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
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summarize Log Error: {e}")
            return content[:100] + "..." # Fallback
