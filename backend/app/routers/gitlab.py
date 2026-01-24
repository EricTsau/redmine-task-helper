from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
import httpx
import asyncio
from pydantic import BaseModel, HttpUrl

from app.database import get_session
from app.models import User, GitLabInstance, GitLabWatchlist
from app.dependencies import get_current_user
from app.services.gitlab_service import GitLabService

router = APIRouter(tags=["gitlab"])

class GitLabInstanceCreate(BaseModel):
    instance_name: str
    url: HttpUrl
    personal_access_token: str
    target_users_json: Optional[str] = None
    target_projects_json: Optional[str] = None

class GitLabWatchlistCreate(BaseModel):
    instance_id: int
    gitlab_project_id: int
    project_name: str
    project_path_with_namespace: str
    is_included: Optional[bool] = None

class GitLabConnectionTest(BaseModel):
    url: HttpUrl
    personal_access_token: str

class GitLabUser(BaseModel):
    id: int
    username: str
    name: str
    state: str

class GitLabProject(BaseModel):
    id: int
    name: str
    path_with_namespace: str
    description: Optional[str]

@router.post("/test-connection")
async def test_gitlab_connection(
    data: GitLabConnectionTest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Test GitLab connection with provided URL and token
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{data.url}/api/v4/projects",
                headers={"PRIVATE-TOKEN": data.personal_access_token},
                timeout=10.0
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful"
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed with status code {response.status_code}",
                    "details": response.text
                }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Connection timeout - please check your network or GitLab server"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.post("/fetch-users-projects")
async def fetch_gitlab_users_projects(
    data: GitLabConnectionTest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Fetch GitLab users and projects with provided URL and token without creating an instance
    """
    try:
        # Create a temporary GitLabInstance object for the service
        temp_instance = GitLabInstance(
            owner_id=user.id or 0,  # fallback to 0 if user.id is None
            instance_name="temp",
            url=str(data.url),
            personal_access_token=data.personal_access_token,
            target_users_json="[]",
            target_projects_json="[]"
        )
        
        gitlab_service = GitLabService(temp_instance)
        
        # Fetch users and projects concurrently
        users_task = gitlab_service.get_users()
        projects_task = gitlab_service.get_projects()
        
        users, projects = await asyncio.gather(users_task, projects_task)
        
        # Transform to our response models
        user_list = [
            GitLabUser(
                id=u["id"],
                username=u["username"],
                name=u["name"],
                state=u["state"]
            )
            for u in users
        ]
        
        project_list = [
            GitLabProject(
                id=p["id"],
                name=p["name"],
                path_with_namespace=p["path_with_namespace"],
                description=p.get("description")
            )
            for p in projects
        ]
        
        return {
            "users": user_list,
            "projects": project_list
        }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Connection timeout - please check your network or GitLab server"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users and projects: {str(e)}"
        )

@router.get("/users", response_model=List[GitLabUser])
async def get_gitlab_users(
    instance_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get GitLab users from a specific instance
    """
    # Verify instance belongs to user
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Instance access denied")
    
    try:
        gitlab_service = GitLabService(instance)
        users = await gitlab_service.get_users()
        
        # Transform to our response model
        return [
            GitLabUser(
                id=u["id"],
                username=u["username"],
                name=u["name"],
                state=u["state"]
            )
            for u in users
        ]
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Connection timeout - please check your network or GitLab server"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )

@router.get("/projects", response_model=List[GitLabProject])
async def get_gitlab_projects(
    instance_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get GitLab projects from a specific instance
    """
    # Verify instance belongs to user
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Instance access denied")
    
    try:
        gitlab_service = GitLabService(instance)
        projects = await gitlab_service.get_projects()
        
        # Transform to our response model
        return [
            GitLabProject(
                id=p["id"],
                name=p["name"],
                path_with_namespace=p["path_with_namespace"],
                description=p.get("description")
            )
            for p in projects
        ]
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Connection timeout - please check your network or GitLab server"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch projects: {str(e)}"
        )

@router.post("/instances", response_model=GitLabInstance)
async def create_instance(
    data: GitLabInstanceCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = GitLabInstance(
        owner_id=user.id or 0,  # fallback to 0 if user.id is None (shouldn't happen with authenticated users)
        instance_name=data.instance_name,
        url=str(data.url),
        personal_access_token=data.personal_access_token,
        target_users_json=data.target_users_json or "[]",
        target_projects_json=data.target_projects_json or "[]",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    session.add(instance)
    session.commit()
    session.refresh(instance)
    
    # Sync Watchlists
    await sync_watchlists(session, instance, user.id)
    
    return instance

@router.put("/instances/{instance_id}", response_model=GitLabInstance)
async def update_instance(
    instance_id: int,
    data: GitLabInstanceCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    instance.instance_name = data.instance_name
    instance.url = str(data.url)
    instance.personal_access_token = data.personal_access_token
    instance.target_users_json = data.target_users_json or "[]"
    instance.target_projects_json = data.target_projects_json or "[]"
    instance.updated_at = datetime.utcnow()
    
    session.add(instance)
    session.commit()
    session.refresh(instance)
    
    # Sync Watchlists
    await sync_watchlists(session, instance, user.id)
    
    return instance

import json

async def sync_watchlists(session: Session, instance: GitLabInstance, user_id: int):
    """
    Syncs the GitLabWatchlist table with the target_projects_json list.
    """
    try:
        project_ids = json.loads(instance.target_projects_json)
        print(f"Syncing watchlists for instance {instance.id}. Target IDs: {project_ids}")

        if not isinstance(project_ids, list):
            print("Target projects JSON is not a list")
            return

        # Fetch existing watchlists for this instance
        existing_watchlists = session.exec(
            select(GitLabWatchlist).where(GitLabWatchlist.instance_id == instance.id)
        ).all()
        
        existing_map = {wl.gitlab_project_id: wl for wl in existing_watchlists}
        existing_ids = set(existing_map.keys())
        target_ids = set(project_ids)
        
        print(f"Existing IDs: {existing_ids}, Target IDs: {target_ids}")
        
        # 1. Remove watchlist items not in target
        for pid in existing_ids - target_ids:
            session.delete(existing_map[pid])
            
        # 2. Add new watchlist items
        to_add = target_ids - existing_ids
        if to_add:
            gs = GitLabService(instance)
            # Create tasks to fetch project info
            # We must be careful not to spam API if too many
            for pid in to_add:
                try:
                    p = await gs.get_project(pid)
                    wl = GitLabWatchlist(
                        owner_id=user_id,
                        instance_id=instance.id,
                        gitlab_project_id=p["id"],
                        project_name=p["name"],
                        project_path_with_namespace=p["path_with_namespace"],
                        is_included=True
                    )
                    session.add(wl)
                except Exception as e:
                    print(f"Failed to sync project {pid}: {e}")
                    
        session.commit()
        
    except Exception as e:
        print(f"Error syncing watchlists: {e}") 

@router.get("/instances", response_model=List[GitLabInstance])
async def get_instances(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(
        select(GitLabInstance).where(GitLabInstance.owner_id == user.id)
    ).all()

@router.delete("/instances/{instance_id}")
async def delete_instance(
    instance_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    instance = session.get(GitLabInstance, instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Also delete associated watchlists
    watchlists = session.exec(
        select(GitLabWatchlist).where(GitLabWatchlist.instance_id == instance_id)
    ).all()
    for wl in watchlists:
        session.delete(wl)
        
    session.delete(instance)
    session.commit()
    return {"message": "Instance deleted"}

@router.post("/watchlists", response_model=GitLabWatchlist)
async def create_watchlist(
    data: GitLabWatchlistCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Verify instance belongs to user
    instance = session.get(GitLabInstance, data.instance_id)
    if not instance or instance.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Instance access denied")

    watchlist = GitLabWatchlist(
        owner_id=user.id or 0,  # fallback to 0 if user.id is None (shouldn't happen with authenticated users)
        instance_id=data.instance_id,
        gitlab_project_id=data.gitlab_project_id,
        project_name=data.project_name,
        project_path_with_namespace=data.project_path_with_namespace,
        is_included=data.is_included if data.is_included is not None else True,
        created_at=datetime.utcnow()
    )
    session.add(watchlist)
    session.commit()
    session.refresh(watchlist)
    return watchlist

@router.put("/watchlists/{watchlist_id}", response_model=GitLabWatchlist)
async def update_watchlist(
    watchlist_id: int,
    data: GitLabWatchlistCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    watchlist = session.get(GitLabWatchlist, watchlist_id)
    if not watchlist or watchlist.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    watchlist.is_included = data.is_included if data.is_included is not None else True
    session.add(watchlist)
    session.commit()
    session.refresh(watchlist)
    return watchlist

@router.get("/watchlists", response_model=List[GitLabWatchlist])
async def get_watchlists(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(
        select(GitLabWatchlist).where(GitLabWatchlist.owner_id == user.id)
    ).all()

@router.delete("/watchlists/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    watchlist = session.get(GitLabWatchlist, watchlist_id)
    if not watchlist or watchlist.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    session.delete(watchlist)
    session.commit()
    return {"message": "Watchlist deleted"}
@router.get("/metrics")
async def get_gitlab_metrics(
    days: int = 30,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get aggregated GitLab metrics for all user instances
    """
    from datetime import timedelta, timezone
    
    # Use timezone-aware UTC
    end_date = datetime.now(timezone.utc)
    # Shift start date back to cover potential timezone differences
    start_date = end_date - timedelta(days=days) - timedelta(days=1)
    
    instances = session.exec(
        select(GitLabInstance).where(GitLabInstance.owner_id == user.id)
    ).all()
    
    aggregated_heatmap = {} # Date -> Count
    recent_activity = [] # List of formatted activity items
    tech_stack_counts = {} # Ext -> Count
    
    total_commits = 0
    total_mrs = 0
    
    for instance in instances:
        gs = GitLabService(instance)
        print(f"Instance {instance.id} target_projects: {instance.target_projects_json}")
        watchlists = session.exec(
            select(GitLabWatchlist)
            .where(GitLabWatchlist.instance_id == instance.id)
            .where(GitLabWatchlist.is_included == True)
        ).all()
        # print GitLabWatchlist
        print(f"Found {len(watchlists)} watchlists for instance {instance.id}")
        
        for wl in watchlists:
            # print project name
            print(f"Processing {wl.project_name}")
            try:
                # Fetch Commits
                # Add 2 days to end_date to be absolutely sure we cover "future" server time vs client time issues
                commits = await gs.get_commits(wl.gitlab_project_id, start_date, end_date + timedelta(days=2))
                total_commits += len(commits)
                
                # Fetch MRs
                mrs = await gs.get_merge_requests(wl.gitlab_project_id, start_date)
                total_mrs += len(mrs)
                
                # Process Heatmap
                for c in commits:
                    date_str = c["created_at"][:10]
                    aggregated_heatmap[date_str] = aggregated_heatmap.get(date_str, 0) + 1
                    
                    # Tech Stack (Simplified based on file stats in commit if available, 
                    # but gitlab list commit API doesn't give file list without detail fetch.
                    # We can skip exact file counts for dashboard speed, or do sample.)
                
                # Process Recent Activity (Top 10 most recent across all?)
                # We'll just collect all and sort later
                for c in commits:
                    recent_activity.append({
                        "type": "commit",
                        "date": c["created_at"],
                        "project": wl.project_name,
                        "title": c["title"],
                        "author": c["author_name"],
                        "url": c["web_url"],
                        "stats": c.get("stats", {})
                    })
                    
                for mr in mrs:
                    recent_activity.append({
                        "type": "mr",
                        "date": mr["updated_at"], # Use updated or created?
                        "project": wl.project_name,
                        "title": mr["title"],
                        "author": mr["author"].get("name"),
                        "url": mr["web_url"],
                        "state": mr["state"]
                    })
                    
            except Exception as e:
                print(f"Error fetching metrics for {wl.project_name}: {e}")
                continue

    # Sort recent activity
    recent_activity.sort(key=lambda x: x["date"], reverse=True)
    
    return {
        "heatmap": aggregated_heatmap,
        "recent_activity": recent_activity[:50], # Limit to 50
        "stats": {
            "commits": total_commits,
            "mrs": total_mrs,
            "instances": len(instances),
            "projects": sum(1 for i in instances for _ in session.exec(select(GitLabWatchlist).where(GitLabWatchlist.instance_id == i.id)).all())
        }
    }
