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
