from redminelib import Redmine
from redminelib.exceptions import AuthError, ResourceNotFoundError
from typing import Optional, List, Dict, Any

class RedmineService:
    def __init__(self, url: str, api_key: str):
        self.redmine = Redmine(url, key=api_key)

    def get_current_user(self) -> Dict[str, Any]:
        """Fetches the current authenticated user to validate credentials."""
        try:
            return self.redmine.user.get('current')
        except (AuthError, ResourceNotFoundError):
            return None
        except Exception as e:
            # TODO: Log error
            raise e

    def get_my_tasks(self, limit: int = 50) -> List[Any]:
        """Fetches issues assigned to the current user."""
        try:
            # Status 2 = In Progress (Standard Redmine, might vary)
            # We can also filter by 'assigned_to_id=me'
            issues = self.redmine.issue.filter(
                assigned_to_id='me',
                # status_id='open', # or generic open
                sort='updated_on:desc',
                limit=limit
            )
            return list(issues)
        except Exception as e:
            print(f"Error fetching tasks: {e}")
            return []

    def get_my_projects(self) -> List[Any]:
        """Fetches all projects visible to the user."""
        try:
            # fetch all projects
            projects = self.redmine.project.all()
            return list(projects)
        except Exception as e:
            print(f"Error fetching projects: {e}")
            return []

    def search_issues(self, query: str) -> List[Any]:
        if not query:
            return []
        try:
            # Search by ID if it's a number
            if query.isdigit():
                 try:
                     issue = self.redmine.issue.get(int(query))
                     return [issue]
                 except ResourceNotFoundError:
                     return []
            
            # Search by subject otherwise
            # python-redmine doesn't have a direct 'search' like the UI, 
            # but filtering by subject can work with some limitations or using custom fields
            # For now, simplest approach:
            issues = self.redmine.issue.filter(subject=query) 
            # Note: partial match depends on Redmine API capability, 
            # often filter supports specific operators (e.g. ~ for contains) but python-redmine might abstract it.
            # Using basic filter for MVP.
            return list(issues)
        except Exception as e:
            print(f"Error searching issues: {e}")
            return []

    def search_issues_advanced(
        self,
        project_id: Optional[int] = None,
        assigned_to: Optional[str] = None,
        status: Optional[str] = None,
        query: Optional[str] = None,
        updated_after: Optional[str] = None,
        limit: int = 50
    ) -> List[Any]:
        """
        進階搜尋 Redmine issues。
        
        Args:
            project_id: 專案 ID
            assigned_to: 'me' 或使用者 ID
            status: 'open', 'closed', 或 'all'
            query: 關鍵字搜尋（Subject）
            updated_after: ISO 日期字串 (YYYY-MM-DD)
            limit: 最大回傳筆數
        """
        try:
            filter_params: Dict[str, Any] = {
                'sort': 'updated_on:desc',
                'limit': limit
            }
            
            if project_id:
                filter_params['project_id'] = project_id
            
            if assigned_to:
                if assigned_to == 'me':
                    filter_params['assigned_to_id'] = 'me'
                elif assigned_to.isdigit():
                    filter_params['assigned_to_id'] = int(assigned_to)
            
            if status:
                if status == 'open':
                    filter_params['status_id'] = 'open'
                elif status == 'closed':
                    filter_params['status_id'] = 'closed'
                # 'all' = don't add status filter
            
            if updated_after:
                filter_params['updated_on'] = f'>={updated_after}'
            
            issues = self.redmine.issue.filter(**filter_params)
            result_list = list(issues)
            
            # 如果有關鍵字，在客戶端過濾 (Redmine API 不支援模糊 subject 搜尋)
            if query:
                query_lower = query.lower()
                result_list = [
                    issue for issue in result_list
                    if query_lower in issue.subject.lower()
                ]
            
            return result_list
        except Exception as e:
            print(f"Error in advanced search: {e}")
            return []

