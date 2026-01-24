import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
import urllib.parse
from app.models import GitLabInstance, GitLabWatchlist

class GitLabService:
    def __init__(self, instance: GitLabInstance):
        self.instance = instance
        self.headers = {"PRIVATE-TOKEN": instance.personal_access_token}
        self.base_url = instance.url.rstrip("/") + "/api/v4"

    async def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/{endpoint}",
                    headers=self.headers,
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"GitLab API Error: {e.response.status_code} - {e.response.text}")
                raise e
            except Exception as e:
                 print(f"GitLab Request Failed: {e}")
                 raise e

    async def get_users(self) -> List[Dict[str, Any]]:
        """獲取 GitLab 用戶列表"""
        return await self._get("users", params={"per_page": 100})

    async def get_projects(self) -> List[Dict[str, Any]]:
        """獲取 GitLab 專案列表"""
        return await self._get("projects", params={"per_page": 100, "membership": "true"})

    async def get_project(self, project_id: int) -> Dict[str, Any]:
        """獲取單一專案詳情"""
        return await self._get(f"projects/{project_id}")


    async def get_commits(self, project_id: int, since: datetime, until: datetime) -> List[Dict[str, Any]]:
        """獲取專案在指定時間內的所有 Commits"""
        params = {
            "since": since.isoformat(),
            "until": until.isoformat(),
            "with_stats": "true",
            "per_page": 100,
            "all": "true"
        }
        return await self._get(f"projects/{project_id}/repository/commits", params=params)

    async def get_merge_requests(self, project_id: int, updated_after: datetime) -> List[Dict[str, Any]]:
        """獲取更新過的 Merge Requests"""
        params = {
            "updated_after": updated_after.isoformat(),
            "per_page": 100
        }
        return await self._get(f"projects/{project_id}/merge_requests", params=params)

    async def get_mr_notes_count(self, project_id: int, mr_iid: int) -> int:
        """獲取 MR 的留言總數"""
        notes = await self._get(f"projects/{project_id}/merge_requests/{mr_iid}/notes")
        user_notes = [n for n in notes if n.get("system") is False]
        return len(user_notes)

    async def get_mr_notes_snippet(self, project_id: int, mr_iid: int, limit: int = 5) -> str:
        """獲取 MR 的留言摘要（用於 AI 上下文）"""
        try:
            notes = await self._get(f"projects/{project_id}/merge_requests/{mr_iid}/notes")
            user_notes = [n for n in notes if n.get("system") is False]
            # 取最近的幾則留言
            user_notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            snippet = []
            for n in user_notes[:limit]:
                author = n.get("author", {}).get("name", "Unknown")
                body = n.get("body", "").replace("\n", " ")[:100]
                snippet.append(f"{author}: {body}")
            return " | ".join(snippet) if snippet else ""
        except Exception:
            return ""

    async def get_commit_diff_extensions(self, project_id: int, sha: str) -> List[str]:
        """獲取 Commit 修改的檔案副檔名"""
        try:
            diffs = await self._get(f"projects/{project_id}/repository/commits/{sha}/diff")
            extensions = []
            for d in diffs:
                path = d.get("new_path") or d.get("old_path")
                if path and "." in path:
                    ext = path.split(".")[-1].lower()
                    extensions.append(ext)
            return extensions
        except Exception:
            return []

    @staticmethod
    def process_commits_for_heatmap(commits: List[Dict[str, Any]]) -> Dict[str, int]:
        """處理 Commits 產生熱圖數據 (date -> count)"""
        heatmap = {}
        for commit in commits:
            date_str = commit["created_at"][:10]  # YYYY-MM-DD
            heatmap[date_str] = heatmap.get(date_str, 0) + 1
        return heatmap

    @staticmethod
    def analyze_impact(commits: List[Dict[str, Any]], commit_extensions: List[List[str]] = []) -> Dict[str, Any]:
        """分析代碼影響力 (包含副檔名統計)"""
        total_additions = sum(c.get("stats", {}).get("additions", 0) for c in commits)
        total_deletions = sum(c.get("stats", {}).get("deletions", 0) for c in commits)
        
        # 統計技術棧分佈
        tech_stack = {}
        for exts in commit_extensions:
            for ext in exts:
                tech_stack[ext] = tech_stack.get(ext, 0) + 1
        
        # 轉換為百分比
        total_files = sum(tech_stack.values())
        tech_stats = []
        if total_files > 0:
            for ext, count in tech_stack.items():
                tech_stats.append({
                    "language": ext,
                    "percentage": round((count / total_files) * 100, 1),
                    "count": count
                })
            tech_stats.sort(key=lambda x: x["percentage"], reverse=True)

        return {
            "total_commits": len(commits),
            "additions": total_additions,
            "deletions": total_deletions,
            "tech_stack": tech_stats[:5] # 只取前五名
        }

    @staticmethod
    def calculate_cycle_time(mrs: List[Dict[str, Any]], mr_notes_counts: List[int] = []) -> Dict[str, Any]:
        """計算 MR 審查效率 (包含留言統計)"""
        durations = []
        merged_count = 0
        opened_count = 0
        for mr in mrs:
            if mr.get("state") == "merged":
                merged_count += 1
                if mr.get("merged_at") and mr.get("created_at"):
                    created = datetime.fromisoformat(mr["created_at"].replace("Z", "+00:00"))
                    merged = datetime.fromisoformat(mr["merged_at"].replace("Z", "+00:00"))
                    durations.append((merged - created).total_seconds())
            elif mr.get("state") == "opened":
                opened_count += 1
        
        avg_cycle_time = sum(durations) / len(durations) if durations else 0
        total_review_notes = sum(mr_notes_counts)
        
        return {
            "average_cycle_time_seconds": avg_cycle_time,
            "mrs_count": len(mrs),
            "merged_count": merged_count,
            "opened_count": opened_count,
            "total_review_notes": total_review_notes
        }
