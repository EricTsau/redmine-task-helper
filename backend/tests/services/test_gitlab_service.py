import pytest
from app.services.gitlab_service import GitLabService
from datetime import datetime

def test_process_commits_for_heatmap():
    commits = [
        {"created_at": "2024-01-01T10:00:00Z"},
        {"created_at": "2024-01-01T12:00:00Z"},
        {"created_at": "2024-01-02T09:00:00Z"},
    ]
    heatmap = GitLabService.process_commits_for_heatmap(commits)
    assert heatmap["2024-01-01"] == 2
    assert heatmap["2024-01-02"] == 1
    assert len(heatmap) == 2

def test_analyze_impact():
    commits = [
        {"stats": {"additions": 10, "deletions": 5}},
        {"stats": {"additions": 20, "deletions": 10}},
    ]
    extensions = [["py", "tsx"], ["py", "css"]]
    
    impact = GitLabService.analyze_impact(commits, extensions)
    assert impact["total_commits"] == 2
    assert impact["additions"] == 30
    assert impact["deletions"] == 15
    
    # Check tech stack
    ts = impact["tech_stack"]
    assert len(ts) == 3
    # "py" appears twice in 4 files -> 50%
    py_stat = next(x for x in ts if x["language"] == "py")
    assert py_stat["percentage"] == 50.0
    assert py_stat["count"] == 2

def test_calculate_cycle_time():
    # 1 hour duration
    mr1 = {
        "created_at": "2024-01-01T10:00:00Z",
        "merged_at": "2024-01-01T11:00:00Z",
        "state": "merged"
    }
    # 2 hours duration
    mr2 = {
        "created_at": "2024-01-02T10:00:00Z",
        "merged_at": "2024-01-02T12:00:00Z",
        "state": "merged"
    }
    # Opened MR
    mr3 = {
        "created_at": "2024-01-02T15:00:00Z",
        "state": "opened"
    }
    
    mrs = [mr1, mr2, mr3]
    notes_counts = [5, 10, 2] # mr1 has 5, mr2 has 10, mr3 has 2
    
    stats = GitLabService.calculate_cycle_time(mrs, notes_counts)
    # (3600 + 7200) / 2 = 5400
    assert stats["average_cycle_time_seconds"] == 5400
    assert stats["merged_count"] == 2
    assert stats["opened_count"] == 1
    assert stats["total_review_notes"] == 17
