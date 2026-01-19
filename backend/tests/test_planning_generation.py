import pytest
from unittest.mock import MagicMock
from sqlmodel import select
from app.models import User, PlanningProject, PlanningTask, PRDDocument, UserSettings
from app.dependencies import get_current_user, get_openai_service
from app.main import app

# Mock OpenAIService
class MockOpenAIService:
    def __init__(self, api_key="test", base_url="test", model="test"):
        pass
        
    def parse_prd_to_tasks(self, conversation, project_context):
        return {
            "message": "Tasks generated",
            "tasks": [
                {
                    "subject": "Task 1",
                    "description": "Goal: T1. DOD: Done.",
                    "estimated_hours": 4,
                    "start_date": "2026-01-20",
                    "due_date": "2026-01-20"
                },
                {
                    "subject": "Task 2",
                    "estimated_hours": 2
                }
            ]
        }

@pytest.fixture
def override_dependencies(session):
    # Create test user
    user = User(username="testuser", is_admin=False)
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Create user settings (needed for get_openai_service if we didn't override it, but we are)
    settings = UserSettings(user_id=user.id)
    session.add(settings)
    session.commit()
    
    # Override get_current_user
    app.dependency_overrides[get_current_user] = lambda: user
    
    # Override get_openai_service
    mock_service = MockOpenAIService()
    app.dependency_overrides[get_openai_service] = lambda: mock_service
    
    yield user
    
    app.dependency_overrides = {}

@pytest.mark.asyncio
async def test_generate_tasks_success(client, session, override_dependencies):
    user = override_dependencies
    
    # Create PRD
    prd = PRDDocument(
        content="This is a PRD content.",
        owner_id=user.id,
        title="Test PRD"
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)
    
    # Create Project linked to PRD
    project = PlanningProject(
        name="Test Project",
        owner_id=user.id,
        prd_document_id=prd.id
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    
    # Call generate-tasks endpoint
    response = await client.post(f"/api/v1/planning/projects/{project.id}/generate-tasks")
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Tasks generated"
    assert data["tasks_count"] == 2
    
    # Verify description is saved
    tasks = session.exec(select(PlanningTask).where(PlanningTask.planning_project_id == project.id)).all()
    assert tasks[0].description == "Goal: T1. DOD: Done."
    
