from redminelib import Redmine
from redminelib.exceptions import AuthError, ResourceNotFoundError
from typing import Optional, List, Dict, Any

class RedmineService:
    def __init__(self, url: str, api_key: str):
        self.redmine = Redmine(url, key=api_key, requests={'verify': False})

    def get_current_user(self) -> Dict[str, Any]:
        """Fetches the current authenticated user to validate credentials."""
        try:
            return self.redmine.user.get('current')
        except (AuthError, ResourceNotFoundError):
            return None
        except Exception as e:
            # TODO: Log error
            raise e

    def get_issue_with_journals(self, issue_id: int) -> Dict[str, Any]:
        """
        Fetch issue details including description and journals (history notes).
        
        Returns:
            Dict with id, subject, description, and journals list
        """
        try:
            issue = self.redmine.issue.get(issue_id, include=['journals'])
            
            journals = []
            for j in getattr(issue, 'journals', []):
                # Only include journals that have notes (not just status changes)
                notes = getattr(j, 'notes', '')
                if notes and notes.strip():
                    journals.append({
                        'id': j.id,
                        'notes': notes,
                        'created_on': str(getattr(j, 'created_on', '')),
                        'user': getattr(j.user, 'name', 'Unknown') if hasattr(j, 'user') else 'Unknown'
                    })
            
            return {
                'id': issue.id,
                'subject': getattr(issue, 'subject', ''),
                'description': getattr(issue, 'description', '') or '',
                'journals': journals
            }
        except ResourceNotFoundError:
            return None
        except Exception as e:
            print(f"Error fetching issue {issue_id} with journals: {e}")
            return None

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

    def create_time_entry(
        self,
        issue_id: int,
        hours: float,
        activity_id: int = 9,  # Default to 'Development' (usually 9 in std Redmine, but safer to parameterize)
        comments: str = ""
    ) -> Any:
        """
        Create a time entry for a specific issue. Returns the created entry or raises an exception.
        """
        # Let exceptions bubble up so the caller knows WHY it failed (e.g. invalid activity_id)
        return self.redmine.time_entry.create(
            issue_id=issue_id,
            hours=hours,
            activity_id=activity_id,
            comments=comments
        )

    def add_issue_note(self, issue_id: int, notes: str) -> Any:
        """
        Add a note (journal entry) to an existing issue.
        This will appear in the issue's history/comments section.
        """
        if not notes or not notes.strip():
            return None
        return self.redmine.issue.update(issue_id, notes=notes)

    def get_project_stats(self, project_id: int) -> Dict[str, Any]:
        """
        Get basic stats for a project (e.g. open issue count).
        """
        try:
            # We want to count open issues.
            # Removing subproject_id='!*' to include subprojects by default (as per comment intention).
            # limit=1 is used to minimize data transfer, relying on total_count.
            issues = self.redmine.issue.filter(
                project_id=project_id,
                status_id='open',
                limit=1
            )
            # Ensure we get the count even if total_count needs to be accessed differently or if filtered result is empty
            if hasattr(issues, 'total_count'):
                count = issues.total_count
            else:
                # Fallback if total_count is not available (though it should be for ResourceSet)
                # But if we use limit=1, len() will be at most 1, so this fallback is only useful if we removed limit.
                # Trusting total_count for now.
                count = 0
            
            print(f"[Stats] Project {project_id}: Found {count} open issues")
            return {
                "open_issues_count": count,
                 # Potential for expansion: closed count, count by tracker, etc.
            }
        except Exception as e:
            print(f"Error fetching stats for project {project_id}: {e}")
            return {"open_issues_count": 0, "error": str(e)}

    def get_activities(self) -> List[Any]:
        """
        Fetch available time entry activities (Global).
        """
        try:
            return list(self.redmine.time_entry_activity.all())
        except Exception as e:
            # Fallback for systems where 'time_entry_activity' is not available or supported
            # print(f"Error fetching activities: {e}")
            try:
                # Try fetching via enumeration resource if available in python-redmine mapping
                # However, python-redmine might raise 'Unsupported resource' for 'enumeration' too if not mapped standardly
                # But we can try/catch
                return list(self.redmine.enumeration.filter(resource='time_entry_activities'))
            except Exception:
                pass
            return []

    def get_valid_activities_for_issue(self, issue_id: int) -> List[Any]:
        """
        Fetch valid time entry activities for a specific issue's project.
        """
        try:
            # 1. Get Issue to find Project
            issue = self.redmine.issue.get(issue_id)
            project_id = issue.project.id
            
            # 2. Get Project with activities included
            # Note: include='time_entry_activities' might not return anything if they are not overridden.
            # If overridden, they appear. If not, we might need to fallback to global.
            project = self.redmine.project.get(project_id, include=['time_entry_activities'])
            
            # python-redmine returns 'time_entry_activities' attribute if present
            # It seems if activities are NOT specific to the project, this list might be empty or null?
            # Actually Redmine API behavior:
            # If the project uses the system default activities, the API might not list them or list them all.
            # But if we explicitly ask for them, we usually get the allowed list.
            
            project_activities = getattr(project, 'time_entry_activities', [])
            
            if project_activities:
                return list(project_activities)
            
            # If no specific activities defined/returned, fallback to global
            return self.get_activities()
            
        except Exception as e:
            print(f"Error fetching valid activities for issue {issue_id}: {e}")
            # Fallback to global if anything fails (e.g. issue not found)
            return self.get_activities()
