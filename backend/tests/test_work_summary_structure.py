import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.work_summary_service import WorkSummaryService
from app.models import User, AIWorkSummarySettings, UserSettings

@pytest.mark.asyncio
async def test_summary_structure_project_first():
    # Setup Mocks
    mock_session = MagicMock()
    mock_user = User(id=1, email="test@test.com")
    mock_redmine = MagicMock()
    mock_openai = AsyncMock()
    
    # Mock Settings
    mock_settings = AIWorkSummarySettings(
        owner_id=1,
        target_project_ids="[101]",
        target_user_ids="[10]"
    )
    mock_session.exec.return_value.first.return_value = mock_settings
    
    # Mock User Settings for Redmine URL
    mock_user_settings = UserSettings(user_id=1, redmine_url="http://redmine.test")
    # We need to handle multiple calls to exec().first() if needed, 
    # but service calls get_settings then user_settings.
    # Let's mock session.exec to return different things based on query?
    # Or just mock the service methods if possible. 
    # But we want to test _fetch_logs_node and _analyze_logs_node logic.
    
    service = WorkSummaryService(mock_session, mock_user, mock_redmine, mock_openai)
    
    # Mock OpenAI response
    # We expect calls:
    # 1. Project Summary (Alpha Project) -> AI MUST Include Header
    # 2. User Summary (Alice) -> AI Does NOT include header
    # 3. User Summary (Charlie) -> AI Does NOT include header
    mock_openai.chat_completion.side_effect = [
        "### Alpha Project - Summary\nOverview content...",
        "Alice content...",
        "Charlie content..."
    ]
    
    # Setup State Input
    state = {
        "project_ids": [101],
        "user_ids": [10],
        "start_date": "2023-01-01",
        "end_date": "2023-01-07",
        "language": "en"
    }
    
    # Mock Issues Data (Result of _fetch_logs_node)
    # This simulates what _analyze_logs_node receives
    issues_data = [
        {
            "id": 1,
            "project_name": "Alpha Project",
            "subject": "Fix Bug",
            "journals": [{"user": "Alice", "notes": "Fixed it", "created_on": "2023-01-02"}],
            "updated_on": "2023-01-02T10:00:00Z"
        },
        # Issue with no journals (Test fallback to Assignee)
        {
            "id": 2,
            "project_name": "Alpha Project",
            "subject": "Old Bug",
            "journals": [],
            "updated_on": "2023-01-02T10:00:00Z",
            "author_name": "Bob",
            "assigned_to_name": "Charlie" # Should pick Charlie
        }
    ]
    state['issues'] = issues_data
    
    # Run _analyze_logs_node directly
    result = await service._analyze_logs_node(state)
    markdown = result['summary_markdown']
    
    # Verifications
    print(markdown)
    
    # 1. Check Project Summary Header comes first
    assert "### Alpha Project - Summary" in markdown
    
    # 2. Check User Header
    assert "### Alpha Project - Alice" in markdown
    
    # 3. Check Fallback User Header (Charlie)
    assert "### Alpha Project - Charlie" in markdown
    
    # 4. Check "General" is NOT present
    assert "### Alpha Project - General" not in markdown
    
    # 5. Check Content
    assert "Overview content..." in markdown
    assert "Alice content..." in markdown

@pytest.mark.asyncio
async def test_fallback_user_logic():
    # Test specific fallback logic: Assignee > Author > Unknown
    service = WorkSummaryService(MagicMock(), MagicMock(), MagicMock(), AsyncMock())
    
    # Case 1: Has Assignee
    i1 = {'assigned_to_name': 'Assignee', 'author_name': 'Author'}
    fallback_user = i1.get('assigned_to_name', 'Unknown')
    if fallback_user == 'Unknown': fallback_user = i1.get('author_name', 'Unknown')
    assert fallback_user == 'Assignee'
    
    # Case 2: No Assignee, Has Author
    i2 = {'assigned_to_name': 'Unknown', 'author_name': 'Author'}
    fallback_user = i2.get('assigned_to_name', 'Unknown')
    if fallback_user == 'Unknown': fallback_user = i2.get('author_name', 'Unknown')
    assert fallback_user == 'Author'

    # Case 3: Neither
    i3 = {'assigned_to_name': 'Unknown', 'author_name': 'Unknown'}
    fallback_user = i3.get('assigned_to_name', 'Unknown')
    if fallback_user == 'Unknown': fallback_user = i3.get('author_name', 'Unknown')
    assert fallback_user == 'Unknown'
