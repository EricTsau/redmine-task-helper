from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_redmine_service
from app.services.redmine_client import RedmineService

# Mock Redmine Service
def mock_get_redmine_service():
    service = MagicMock(spec=RedmineService)
    
    # Mock get_current_user
    mock_user = MagicMock()
    mock_user.id = 152
    mock_user.firstname = "Test"
    mock_user.lastname = "User"
    service.get_current_user.return_value = mock_user
    
    # Mock other metadata methods
    tracker = MagicMock()
    tracker.id = 1
    tracker.name = "Bug"
    service.get_trackers.return_value = [tracker]
    
    status_obj = MagicMock()
    status_obj.id = 1
    status_obj.name = "New"
    service.get_issue_statuses.return_value = [status_obj]
    
    priority = MagicMock()
    priority.id = 1
    priority.name = "Normal"
    service.get_priorities.return_value = [priority]
    
    service.get_project_members.return_value = [{"id": 152, "name": "Test User"}]
    
    return service

def test_get_project_metadata_includes_current_user():
    # Override dependency
    app.dependency_overrides[get_redmine_service] = mock_get_redmine_service
    
    client = TestClient(app)
    response = client.get("/api/v1/projects/1/metadata")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify structure
    assert "trackers" in data
    assert "statuses" in data
    assert "priorities" in data
    assert "members" in data
    assert "current_user" in data
    
    # Verify current_user data
    assert data["current_user"]["id"] == 152
    assert data["current_user"]["name"] == "Test User"
    
    # Clean up
    app.dependency_overrides = {}
