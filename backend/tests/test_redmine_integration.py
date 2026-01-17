import pytest
from unittest.mock import MagicMock, patch
from app.services.redmine_client import RedmineService

@pytest.fixture
def redmine_service():
    service = RedmineService(url="https://redmine.example.com", api_key="fake-key")
    service.redmine = MagicMock()
    return service

def test_create_time_entry_success(redmine_service):
    # Setup mock
    redmine_service.redmine.time_entry.create.return_value = True
    
    result = redmine_service.create_time_entry(
        issue_id=1234,
        hours=2.5,
        comments="Fix bug"
    )
    
    assert result is True
    redmine_service.redmine.time_entry.create.assert_called_once_with(
        issue_id=1234,
        hours=2.5,
        activity_id=9,
        comments="Fix bug"
    )

def test_create_time_entry_failure(redmine_service):
    # Mock exception
    with patch.object(redmine_service.redmine.time_entry, 'create', side_effect=Exception("API Error")):
        result = redmine_service.create_time_entry(
            issue_id=1234,
            hours=1
        )
        
        assert result is False

def test_get_project_stats_success(redmine_service):
    # Setup mock
    mock_issues = MagicMock()
    mock_issues.total_count = 10
    redmine_service.redmine.issue.filter.return_value = mock_issues

    stats = redmine_service.get_project_stats(project_id=1)
    
    assert stats["open_issues_count"] == 10
    # Note: verification of arguments might need to be adjusted if implementation changes, 
    # but based on current code it should match.
    redmine_service.redmine.issue.filter.assert_called_once()
    call_kwargs = redmine_service.redmine.issue.filter.call_args.kwargs
    assert call_kwargs['project_id'] == 1
    assert call_kwargs['status_id'] == 'open'
    # assert 'subproject_id' not in call_kwargs # We removed it

def test_get_project_stats_error(redmine_service):
    # Mock exception
    redmine_service.redmine.issue.filter.side_effect = Exception("Connection Error")
    
    stats = redmine_service.get_project_stats(project_id=1)
    
    assert stats["open_issues_count"] == 0
    assert "error" in stats
