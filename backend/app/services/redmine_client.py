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
