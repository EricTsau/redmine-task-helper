"""
Tests for Tracked Tasks API
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.main import app
from app.database import get_session
from app.models import TrackedTask, AppSettings


# Test database setup
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Add default settings
        settings = AppSettings(
            id=1,
            redmine_url="https://redmine.example.com",
            api_key="test_api_key"
        )
        session.add(settings)
        session.commit()
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


class TestTrackedTasksAPI:
    """Test cases for tracked tasks endpoints"""
    
    def test_list_empty_tracked_tasks(self, client):
        """Should return empty list when no tasks are tracked"""
        response = client.get("/api/v1/tracked-tasks/")
        assert response.status_code == 200
        assert response.json() == []
    
    @patch("app.routers.tracked_tasks.RedmineService")
    def test_import_tasks(self, mock_service_class, client, session):
        """Should import tasks from Redmine"""
        # Mock Redmine issue
        mock_issue = MagicMock()
        mock_issue.id = 123
        mock_issue.subject = "Test Task"
        mock_issue.project.id = 1
        mock_issue.project.name = "Test Project"
        mock_issue.status.name = "In Progress"
        mock_issue.assigned_to = None
        
        mock_service = MagicMock()
        mock_service.redmine.issue.get.return_value = mock_issue
        mock_service_class.return_value = mock_service
        
        response = client.post(
            "/api/v1/tracked-tasks/import",
            json={"issue_ids": [123]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["redmine_issue_id"] == 123
        assert data[0]["subject"] == "Test Task"
    
    def test_delete_tracked_task(self, client, session):
        """Should delete a tracked task"""
        # Create a tracked task first
        task = TrackedTask(
            redmine_issue_id=456,
            project_id=1,
            project_name="Test Project",
            subject="Task to delete",
            status="Open",
            last_synced_at=datetime.utcnow()
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        
        response = client.delete(f"/api/v1/tracked-tasks/{task.id}")
        assert response.status_code == 200
        
        # Verify task is deleted
        response = client.get("/api/v1/tracked-tasks/")
        assert response.json() == []
    
    def test_update_task_group(self, client, session):
        """Should update the custom group of a task"""
        # Create a tracked task
        task = TrackedTask(
            redmine_issue_id=789,
            project_id=1,
            project_name="Test Project",
            subject="Task to group",
            status="Open",
            last_synced_at=datetime.utcnow()
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        
        response = client.patch(
            f"/api/v1/tracked-tasks/{task.id}/group",
            json={"custom_group": "Priority High"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["custom_group"] == "Priority High"
    
    def test_delete_nonexistent_task(self, client):
        """Should return 404 for nonexistent task"""
        response = client.delete("/api/v1/tracked-tasks/99999")
        assert response.status_code == 404


class TestTaskSearchAPI:
    """Test cases for task search endpoint"""
    
    def test_search_tasks_with_status_filter(self, client):
        """Should search tasks with status filter"""
        mock_service = MagicMock()
        mock_service.search_issues_advanced.return_value = []
        
        # Override dependency
        from app.dependencies import get_redmine_service
        app.dependency_overrides[get_redmine_service] = lambda: mock_service
        
        try:
            response = client.get(
                "/api/v1/tasks/search",
                params={"status": "open"}
            )
            
            assert response.status_code == 200
            mock_service.search_issues_advanced.assert_called_once()
        finally:
            del app.dependency_overrides[get_redmine_service]
