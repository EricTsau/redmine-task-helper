from redminelib import Redmine
from redminelib.exceptions import AuthError, ResourceNotFoundError
from typing import Optional, List, Dict, Any
from datetime import date

class RedmineService:
    def __init__(self, url: str, api_key: str):
        # Normalize and store base URL for link generation elsewhere
        self.base_url = url.rstrip('/') if isinstance(url, str) else ''
        self.redmine = Redmine(self.base_url, key=api_key, requests={'verify': False})

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
            Dict with id, subject, description, journals, estimated_hours, and spent_hours
        """
        try:
            issue = self.redmine.issue.get(issue_id, include=['journals', 'attachments'])
            
            journals = []
            for j in getattr(issue, 'journals', []):
                # Only include journals that have notes (not just status changes)
                notes = getattr(j, 'notes', '')
                if notes and notes.strip():
                    journals.append({
                        'id': j.id,
                        'notes': notes,
                        'created_on': j.created_on.isoformat() if hasattr(j, 'created_on') and hasattr(j.created_on, 'isoformat') else str(getattr(j, 'created_on', '')),
                        'user': getattr(j.user, 'name', 'Unknown') if hasattr(j, 'user') else 'Unknown'
                    })
            
            return {
                'id': issue.id,
                'subject': getattr(issue, 'subject', ''),
                'description': getattr(issue, 'description', '') or '',
                'journals': journals,
                'estimated_hours': getattr(issue, 'estimated_hours', None),
                'spent_hours': getattr(issue, 'spent_hours', None) or getattr(issue, 'total_spent_hours', None),
                'attachments': [{'filename': a.filename, 'content_url': a.content_url} for a in getattr(issue, 'attachments', [])]
            }
        except ResourceNotFoundError:
            return None
        except Exception as e:
            import traceback
            traceback.print_exc()
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
            # fetch all projects with a reasonable limit or iterate all
            # python-redmine's all() is a ResourceSet that handles paging
            projects = self.redmine.project.all(limit=100)
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
            return list(issues)
        except Exception as e:
            print(f"Error searching issues: {e}")
            return []

    def get_trackers(self) -> List[Any]:
        try:
            return list(self.redmine.tracker.all())
        except Exception:
            return []

    def get_issue_statuses(self) -> List[Any]:
        try:
            return list(self.redmine.issue_status.all())
        except Exception:
            return []

    def get_priorities(self) -> List[Any]:
        try:
            return list(self.redmine.enumeration.filter(resource='issue_priorities'))
        except Exception:
            return []

    def get_project_members(self, project_id: int) -> List[Any]:
        try:
            memberships = self.redmine.project_membership.filter(project_id=project_id)
            # Extract users from memberships
            users = []
            for m in memberships:
                if hasattr(m, 'user'):
                    users.append({'id': m.user.id, 'name': m.user.name})
                elif hasattr(m, 'group'):
                    users.append({'id': m.group.id, 'name': m.group.name})
            return users
        except Exception as e:
            print(f"Error fetching members: {e}")
            return []

    def create_issue(self, project_id: int, subject: str, tracker_id: int, **kwargs) -> Any:
        try:
            issue = self.redmine.issue.create(
                project_id=project_id,
                subject=subject,
                tracker_id=tracker_id,
                **kwargs
            )
            return issue
        except Exception as e:
            # Enhanced error logging
            print(f"Error creating issue: {e}")
            raise e 
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
        updated_before: Optional[str] = None,
        include: Optional[List[str]] = None,
        include_subprojects: bool = False,
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
            include: 額外欄位 (e.g. ['relations'])
            include_subprojects: 是否包含子專案
            limit: 最大回傳筆數
        """
        try:
            filter_params: Dict[str, Any] = {
                'sort': 'updated_on:desc',
                'limit': limit
            }
            
            if include:
                filter_params['include'] = include

            if project_id:
                filter_params['project_id'] = project_id
                if include_subprojects:
                     filter_params['subproject_id'] = '!*'  # Redmine API syntax for "include all subprojects"
            
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
                # start boundary inclusive
                filter_params['updated_on'] = f'>={updated_after}'
            if updated_before:
                # end boundary inclusive
                # If updated_on already present, combine using comma (Redmine allows range '>=YYYY-MM-DD|<=YYYY-MM-DD' not standard across instances,
                # so we set updated_on to a '>=' string and rely on client-side filtering for safety. Still, include a hint param for servers that support it.
                # Try to set updated_on as a range if not present (some Redmine servers may accept '<=YYYY-MM-DD')
                if 'updated_on' in filter_params:
                    # leave start filter, server-side filtering of end may not be supported; we keep as is and let caller client-filter
                    print(f"[RedmineService] search_issues_advanced: requested updated_before={updated_before}, server-side may ignore end-boundary")
                else:
                    filter_params['updated_on'] = f'<={updated_before}'
            
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

    def search_time_entries(
        self,
        user_ids: Optional[list] = None,
        project_id: Optional[int] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Any]:
        """
        搜尋 time entries（工時紀錄）。
        支援以使用者、專案與日期區間過濾。
        """
        try:
            # Build base params
            base_params: Dict[str, Any] = { 'limit': limit }
            if project_id:
                base_params['project_id'] = project_id
            if from_date and to_date:
                base_params['from'] = from_date
                base_params['to'] = to_date

            results = []

            # If multiple user_ids provided, query per-user to avoid server-side parsing issues
            if user_ids:
                seen_ids = set()
                for uid in user_ids:
                    try:
                        params = dict(base_params)
                        params['user_id'] = int(uid)
                        entries = self.redmine.time_entry.filter(**params)
                        for e in entries:
                            eid = getattr(e, 'id', None)
                            if eid and eid not in seen_ids:
                                seen_ids.add(eid)
                                results.append(e)
                    except Exception as inner_e:
                        # Log but continue with other user ids
                        print(f"Error searching time entries for user {uid}: {inner_e}")
                return results

            # No specific user filter, query once
            entries = self.redmine.time_entry.filter(**base_params)
            return list(entries)
        except Exception as e:
            import traceback
            traceback.print_exc()
            # If python-redmine returns a server-side message, print args for debugging
            print(f"Error searching time entries: {e} | args: {getattr(e, 'args', None)}")
            return []

    def get_issue_journals(self, issue_id: int) -> List[Dict[str, Any]]:
        """
        Get journals for an issue and return a simplified list.
        """
        try:
            issue = self.redmine.issue.get(issue_id, include=['journals'])
            journals = []
            for j in getattr(issue, 'journals', []):
                notes = getattr(j, 'notes', '')
                if notes and notes.strip():
                    journals.append({
                        'id': j.id,
                        'notes': notes,
                        'created_on': j.created_on.isoformat() if hasattr(j, 'created_on') and hasattr(j.created_on, 'isoformat') else str(getattr(j, 'created_on', '')),
                        'user': getattr(j.user, 'name', 'Unknown') if hasattr(j, 'user') else 'Unknown'
                    })
            return journals
        except Exception as e:
            print(f"Error fetching journals for issue {issue_id}: {e}")
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

    def add_issue_note(self, issue_id: int, notes: str, uploads: List[Dict[str, str]] = None) -> Any:
        """
        Add a note (journal entry) to an existing issue.
        This will appear in the issue's history/comments section.
        
        Args:
            issue_id: The Redmine issue ID
            notes: The note content (can be Textile formatted)
            uploads: Optional list of upload tokens, e.g. [{'token': 'xxx', 'filename': 'file.png', 'content_type': 'image/png'}]
        """
        if not notes or not notes.strip():
            return None
        
        update_params = {'notes': notes}
        if uploads:
            update_params['uploads'] = uploads
        
        return self.redmine.issue.update(issue_id, **update_params)


    def update_issue(self, issue_id: int, **kwargs) -> bool:
        """
        Update an existing Redmine issue with provided fields.
        """
        try:
            print(f"[Redmine Service] Updating issue {issue_id} with: {kwargs}")
            return self.redmine.issue.update(issue_id, **kwargs)
        except Exception as e:
            print(f"[Redmine Service] Error updating issue {issue_id}: {e}")
            raise e

    def get_project(self, project_id: int) -> Any:
        """
        Get project details by ID.
        """
        try:
            return self.redmine.project.get(project_id)
        except Exception as e:
            print(f"[Redmine Service] Error fetching project {project_id}: {e}")
            return None

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

    def get_issue_relations(self, issue_id: int) -> List[Any]:
        """
        Get relations for a specific issue.
        """
        try:
            issue = self.redmine.issue.get(issue_id, include=['relations'])
            return list(issue.relations)
        except ResourceNotFoundError:
            return []
        except Exception as e:
            print(f"Error fetching relations for issue {issue_id}: {e}")
            return []

    def update_issue(self, issue_id: int, **kwargs) -> Any:
        """
        Generic method to update an issue.
        """
        try:
            return self.redmine.issue.update(issue_id, **kwargs)
        except Exception as e:
            print(f"Error updating issue {issue_id}: {e}")
            raise e

    def update_issue_dates(self, issue_id: int, start_date: Optional[str] = None, due_date: Optional[str] = None, done_ratio: Optional[int] = None) -> Any:
        # Backward compatibility wrapper or deprecated
        kwargs = {}
        if start_date: kwargs['start_date'] = start_date
        if due_date: kwargs['due_date'] = due_date
        if done_ratio is not None: kwargs['done_ratio'] = done_ratio
        
        return self.update_issue(issue_id, **kwargs)

    def create_issue_relation(self, issue_id: int, related_issue_id: int, relation_type: str = 'precedes') -> Any:
        """
        Create a new relation between two issues.
        """
        try:
            return self.redmine.issue_relation.create(
                issue_id=issue_id,
                issue_to_id=related_issue_id,
                relation_type=relation_type
            )
        except Exception as e:
             print(f"Error creating relation: {e}")
             raise e

    def delete_issue_relation(self, relation_id: int) -> None:
        """
        Delete an issue relation by its ID.
        """
        try:
            self.redmine.issue_relation.delete(relation_id)
        except Exception as e:
             print(f"Error deleting relation {relation_id}: {e}")
             raise e

    def delete_issue(self, issue_id: int) -> bool:
        """
        Delete an issue by its ID.
        """
        try:
            self.redmine.issue.delete(issue_id)
            return True
        except Exception as e:
            print(f"Error deleting issue {issue_id}: {e}")
            raise e

    def get_all_projects_summary(self) -> List[Dict[str, Any]]:
        """
        Fetch summary of all projects for the dashboard.
        Returns basic info + status (calculated).
        """
        try:
            projects = self.redmine.project.all(limit=100)
            summary = []
            for p in projects:
                # Basic info
                # Note: Redmine project object doesn't strictly have a 'status' field in the same way issues do.
                # However, it has 'status' (1=active, 5=closed, 9=archived).
                # We can also calculate a "health" status based on issues.
                
                # Fetch issue counts for health calculation
                # To be efficient, we might need a separate query or rely on aggregated data if available.
                # For now, let's just return basic identity. Health calculation might happen in the router 
                # to avoid N+1 queries here if possible, or we optimize later.
                # Actually, fetching open issue count per project is common.
                
                # Optimization: Redmine API might not give issue counts in project list.
                # We will return basic info and let the dashboard router/service handle detailed health checks
                # perhaps by fetching all issues (batched) or just basic project metadata.
                summary.append({
                    "id": p.id,
                    "name": p.name,
                    "identifier": p.identifier,
                    "created_on": str(p.created_on),
                    # "status": p.status # Integer in Redmine
                })
            return summary
        except Exception as e:
            print(f"Error fetching all projects summary: {e}")
            return []

    def get_overdue_tasks(self, limit: int = 10) -> List[Any]:
        """
        Fetch overdue tasks across all projects visible to the user.
        """
        try:
            # Redmine API allows filtering by due_date
            # due_date='<2023-01-01'
            today = date.today().isoformat()
            
            # Filter: Open status, due date < today
            issues = self.redmine.issue.filter(
                status_id='open',
                due_date=f"<{today}",
                sort='due_date:asc', # Most overdue first
                limit=limit
            )
            return list(issues)
        except Exception as e:
            print(f"Error fetching overdue tasks: {e}")
            return []

