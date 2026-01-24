import asyncio
import sys
import os
from datetime import datetime, timedelta
from sqlmodel import select

# If running from backend dir, current dir is in path
from app.database import get_session
from app.models import GitLabInstance, GitLabWatchlist
from app.services.gitlab_service import GitLabService

async def main():
    session = next(get_session())
    instances = session.exec(select(GitLabInstance)).all()
    
    print(f"Found {len(instances)} GitLab instances.")
    
    # Check for 1/24 specifically
    end_date = datetime.utcnow()
    # Wide range
    start_date = datetime.utcnow() - timedelta(days=2) 
    
    print(f"Querying from {start_date} to {end_date}")

    for instance in instances:
        print(f"\nInstance: {instance.instance_name} ({instance.url})")
        gs = GitLabService(instance)
        
        watchlists = session.exec(select(GitLabWatchlist).where(GitLabWatchlist.instance_id == instance.id)).all()
        print(f"  Watchlists: {len(watchlists)}")
        
        for wl in watchlists:
            print(f"  - Project: {wl.project_name} (ID: {wl.gitlab_project_id})")
            try:
                commits = await gs.get_commits(wl.gitlab_project_id, start_date, end_date + timedelta(days=1))
                print(f"    Fetched {len(commits)} commits.")
                for c in commits[:5]:
                    print(f"      [{c['created_at']}] {c['author_name']}: {c['title']} (Stats: {c.get('stats')})")
            except Exception as e:
                print(f"    Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
