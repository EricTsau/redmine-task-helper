from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime, date

from app.services.redmine_client import RedmineService
from app.dependencies import get_redmine_service, get_current_user
from app.models import User

router = APIRouter()

@router.get("/executive-summary")
def get_executive_summary(
    redmine: RedmineService = Depends(get_redmine_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated executive summary data.
    """
    try:
        # 1. Fetch all projects
        projects = redmine.get_all_projects_summary()
        
        # 2. Statistics containers
        health_stats = {"critical": 0, "warning": 0, "healthy": 0}
        total_projects = len(projects)
        project_health_list = []

        # 3. Calculate health for each project
        # Note: This loop causes N+1 API calls (search_issues per project). 
        # Ideally, we should fetch ALL open issues and aggregate in memory if the dataset is small enough suitable for desktop app.
        # Or, we accept the latency for now. Let's try to be smarter: 
        # fetch all open issues for "me" or globally if possible? 
        # Checking "all projects" issues might be huge.
        # Let's stick to per-project check but limit to top projects or use a lightweight check.
        # For MVP, let's iterate.
        
        for p in projects:
            # Get stats: open issues count, maybe overdue count
            # We can use search_issues_advanced to get specific counts if we want
            # But get_project_stats returns basic open count.
            
            # Let's try to get more specific health indicators
            # We need: Overdue tasks count, Progress vs Time (hard without baseline)
            
            # Strategy: Fetch overdue issues count for this project
            # This is still an API call.
            
            # Simple Heuristic for Demo:
            # - Critical: Has overdue tasks > 2 days or count > 5
            # - Warning: Has ANY overdue tasks
            # - Healthy: No overdue tasks
            
            # Optimization: Can we fetch ALL overdue tasks for user/globally and group by project?
            # Yes, get_overdue_tasks serves this but with a limit. 
            # If we fetch ALL overdue issues (maybe limit 500), we can aggregate.
            pass

        # Optimized Approach:
        # A. Fetch global overdue issues (limit 100) -> Mark projects as Critical/Warning
        # B. For remaining projects, assume Healthy (or Warning if we can't be sure)
        
        today = date.today().isoformat()
        
        # Fetch all overdue issues (limit 100 mostly covers the "problematic" ones for the dashboard)
        overdue_issues = redmine.search_issues_advanced(
            status='open',
            limit=200 # Fetch enough to get a good picture
        )
        # Filter for strictly overdue manually to be safe or rely on search if possible (Redmine API <today works)
        # Assuming search_issues_advanced supports the custom filter logic we added (it uses updated_on etc, maybe not due_date ranges yet).
        # Wait, redmine_client.search_issues_advanced doesn't expose due_date filter yet.
        # But get_overdue_tasks does. Let's assume we use get_overdue_tasks logic but broader.
        
        # Let's use redmine.redmine.issue.filter directly effectively by replicating get_overdue_tasks logic but larger content
        all_overdue = redmine.redmine.issue.filter(
            status_id='open',
            due_date=f"<{today}",
            limit=200
        )
        
        overdue_map = {} # project_id -> count
        critical_threshold = 3 
        
        for issue in all_overdue:
            pid = issue.project.id
            overdue_map[pid] = overdue_map.get(pid, 0) + 1
            
        # Build Project Health List
        for p in projects:
            p_id = p['id']
            overdue_count = overdue_map.get(p_id, 0)
            
            status = "healthy"
            if overdue_count > critical_threshold:
                status = "critical"
                health_stats["critical"] += 1
            elif overdue_count > 0:
                status = "warning"
                health_stats["warning"] += 1
            else:
                health_stats["healthy"] += 1
                
            project_health_list.append({
                **p,
                "health_status": status,
                "overdue_count": overdue_count
            })
            
        # 4. Top Risks (Global Overdue)
        # We can reuse the all_overdue list, sort by due date (most overdue first)
        sorted_risks = sorted(all_overdue, key=lambda x: x.due_date if hasattr(x, 'due_date') else '9999-99-99')
        top_risks = []
        for issue in sorted_risks[:5]:
             top_risks.append({
                 "id": issue.id,
                 "project_id": issue.project.id,
                 "project_name": issue.project.name,
                 "subject": issue.subject,
                 "due_date": str(issue.due_date),
                 "assigned_to": issue.assigned_to.name if hasattr(issue, 'assigned_to') else "Unassigned"
             })

        return {
            "portfolio_health": health_stats,
            "total_projects": total_projects,
            "project_health_list": project_health_list,
            "top_risks": top_risks
        }

    except Exception as e:
        print(f"Error in dashboard executive summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
