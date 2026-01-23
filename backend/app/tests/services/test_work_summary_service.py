import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
import json
from app.services.work_summary_service import WorkSummaryService
from app.models import User, AIWorkSummarySettings, AIWorkSummaryReport, AppSettings, UserSettings

@pytest.fixture
def mock_session():
    return MagicMock()

@pytest.fixture
def mock_redmine():
    return MagicMock()

@pytest.fixture
def mock_openai():
    service = AsyncMock()
    service.chat_completion.return_value = "# Test Summary\n\nGenerated summary content."
    return service

@pytest.fixture
def mock_user():
    user = User(id=1, username="testuser")
    return user

@pytest.fixture
def service(mock_session, mock_user, mock_redmine, mock_openai):
    return WorkSummaryService(mock_session, mock_user, mock_redmine, mock_openai)

@pytest.mark.asyncio
async def test_generate_summary_success(service, mock_session, mock_redmine):
    # Setup Data
    mock_settings = AIWorkSummarySettings(
        owner_id=1,
        target_project_ids=json.dumps([101]),
        target_user_ids=json.dumps([1])
    )
    mock_session.exec.return_value.first.return_value = mock_settings

    # Mock Redmine Issues
    issue_mock = MagicMock()
    issue_mock.id = 1
    issue_mock.project.id = 101
    issue_mock.project.name = "Test Project"
    issue_mock.status.name = "In Progress"
    issue_mock.updated_on = datetime(2023, 1, 2, 10, 0, 0)
    issue_mock.description = "Description with !image.png!"
    
    # Mock Attachments
    attachment = MagicMock()
    attachment.filename = "image.png"
    attachment.content_url = "http://redmine/img.png"
    issue_mock.attachments = [attachment]

    mock_redmine.search_issues_advanced.return_value = [issue_mock]

    # Mock Journals
    # journal_1: Target User (1) + In Date -> Should be Included
    journal_1 = {'id': 1, 'notes': 'Note 1', 'created_on': '2023-01-02T12:00:00Z', 'user': 'user1', 'user_id': 1}
    # journal_2: Target User (1) + Old Date -> Should be Filtered by Date
    journal_2 = {'id': 2, 'notes': 'Old Note', 'created_on': '2022-12-31T12:00:00Z', 'user': 'user1', 'user_id': 1}
    # journal_3: Wrong User (2) + In Date -> Should be Filtered by User
    journal_3 = {'id': 3, 'notes': 'Wrong User Note', 'created_on': '2023-01-02T13:00:00Z', 'user': 'user2', 'user_id': 2}
    
    mock_redmine.get_issue_journals.return_value = [journal_1, journal_2, journal_3]

    # Execute
    report = await service.generate_summary("2023-01-01", "2023-01-03")

    # Verify Report
    # Title comes from the header we manually added: "# 工作總結報告 ({start_date} ~ {end_date})"
    expected_title = "工作總結報告 (2023-01-01 ~ 2023-01-03)"
    assert report.title == expected_title
    assert "# Test Summary" in report.summary_markdown # The chunk content (from mock) should be in there
    
    # Verify Calls
    mock_redmine.search_issues_advanced.assert_called_once()
    
    # Verify OpenAI Prompt Context
    # Map-Reduce strategy makes multiple calls. We need to check all calls.
    all_calls = service.openai.chat_completion.call_args_list
    assert len(all_calls) >= 1

    # Collect all prompts sent to OpenAI
    combined_prompts = ""
    for call in all_calls:
        args = call[0][0] # List of messages
        for msg in args:
            if msg['role'] == 'user':
                combined_prompts += msg['content']
    
    # Check Filtering
    assert "Note 1" in combined_prompts
    assert "Old Note" not in combined_prompts # Filtered by Date
    assert "Wrong User Note" not in combined_prompts # Filtered by ID
    
    # Check Image Extraction
    assert "http://redmine/img.png" in combined_prompts

    # Check Language Injection (Default)
    assert "Language: zh-TW" in combined_prompts

    # Check that manual reduce worked (Header present)
    assert "# 工作總結報告" in report.summary_markdown

@pytest.mark.asyncio
async def test_generate_summary_error_handling(service, mock_session, mock_redmine):
    # Setup Settings
    mock_settings = AIWorkSummarySettings(
        owner_id=1,
        target_project_ids=json.dumps([101]),
        target_user_ids=json.dumps([1])
    )
    mock_session.exec.return_value.first.return_value = mock_settings

    # Mock Redmine Issue that raises error on journal fetch
    issue_mock = MagicMock()
    issue_mock.id = 1
    issue_mock.project.id = 101
    issue_mock.description = "Test description"
    issue_mock.updated_on = "2023-01-02T10:00:00Z"
    
    # Simulate a crash when accessing lazy attributes or fetching journals
    mock_redmine.search_issues_advanced.return_value = [issue_mock]
    mock_redmine.get_issue_journals.side_effect = Exception("Redmine Connection Error")
    
    # Execute - Should not raise exception
    report = await service.generate_summary("2023-01-01", "2023-01-03")
    
    assert report is not None
    assert report.title == "工作總結報告 (2023-01-01 ~ 2023-01-03)"

@pytest.mark.asyncio
async def test_generate_summary_datetime_crash(service, mock_session, mock_redmine):
    # Setup Data
    mock_settings = AIWorkSummarySettings(
        owner_id=1,
        target_project_ids=json.dumps([101]),
        target_user_ids=json.dumps([1])
    )
    mock_session.exec.return_value.first.return_value = mock_settings

    # Mock Redmine Issue with updated_on as DATETIME and NO JOURNALS
    issue_mock = MagicMock()
    issue_mock.id = 1
    issue_mock.project.id = 101
    issue_mock.project.name = "Test Project"
    issue_mock.subject = "Test Issue"
    issue_mock.status.name = "In Progress"
    issue_mock.updated_on = datetime(2023, 1, 2, 10, 0, 0) # DATETIME OBJECT
    issue_mock.description = "Description"
    
    # Mock Attachments
    issue_mock.attachments = []

    mock_redmine.search_issues_advanced.return_value = [issue_mock]
    # No journals to force check of updated_on in the conditional logic
    mock_redmine.get_issue_journals.return_value = [] 

    # Execute - Should succeed now
    report = await service.generate_summary("2023-01-01", "2023-01-03")
    
    assert report is not None
    assert report.title == "工作總結報告 (2023-01-01 ~ 2023-01-03)"


@pytest.mark.asyncio
async def test_generate_summary_concurrency(service, mock_session, mock_redmine):
    # Setup AppSettings with max_concurrent_chunks = 2
    mock_app_settings = AppSettings(id=1, max_concurrent_chunks=2)
    
    # We need to mock the session.exec result for AppSettings query
    # The service calls session.exec(select(AppSettings)...)
    # We can use side_effect to return different results based on the query or just generic mock
    
    # Mocking exec().first() specifically for AppSettings
    # Because session.exec is called multiple times (for user settings, app settings), 
    # we need a side_effect that handles this gracefully or just assume it returns what we want based on order?
    # Better: Patch the session.exec logic or specific query.
    # Simpler: The service implementation does:
    # app_settings = self.session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    
    # Let's mock side_effect for session.exec
    def exec_side_effect(statement):
        mock_result = MagicMock()
        # simplified check: if str(statement) contains AppSettings... 
        # But statement is a SQLModel select object.
        # Let's just return a mock that has .first() returning our settings
        # This might break other calls if not careful, but let's try.
        # Actually, the existing tests already mock session.exec.return_value.first.return_value
        # We can just update that default return, OR rely on the fact that existing tests set it for UserSettings.
        
        # In the service code:
        # 1. get_settings() -> AIWorkSummarySettings
        # 2. _analyze_logs_node -> AppSettings
        
        mock_result.first.side_effect = [
            # First call is usually get_settings()
            AIWorkSummarySettings(owner_id=1, target_project_ids=json.dumps([101, 102, 103]), target_user_ids=json.dumps([1])),
            # Second call (inside analyze) is AppSettings
            mock_app_settings
        ]
        return mock_result

    # Actually, modifying the fixture `mock_session` usage in this test is cleaner than side_effect if we can control it.
    # The service calls:
    # 1. get_settings (exec -> first)
    # 2. UserSettings (exec -> first) inside _analyze_logs_node
    # 3. AppSettings (exec -> first) inside _analyze_logs_node
    
    # So we need 3 returns.
    mock_session.exec.return_value.first.side_effect = [
        AIWorkSummarySettings(owner_id=1, target_project_ids=json.dumps([101, 102, 103]), target_user_ids=json.dumps([1])), # get_settings
        UserSettings(user_id=1), # UserSettings
        mock_app_settings, # AppSettings
    ]

    # Setup Data to have multiple chunks (3 projects)
    # Project 1, 2, 3
    issues = []
    for i in [101, 102, 103]:
        issue = MagicMock()
        issue.id = i
        issue.project.id = i
        issue.project.name = f"Project {i}"
        issue.updated_on = datetime(2023, 1, 2)
        issue.journals = [{'user': 'user1', 'created_on': '2023-01-02', 'notes': 'update', 'user_id': 1}]
        issue.description = ""
        issue.attachments = []
        issues.append(issue)
        
    mock_redmine.search_issues_advanced.return_value = issues
    mock_redmine.get_issue_journals.side_effect = lambda id: [{'user': 'user1', 'created_on': '2023-01-02', 'notes': 'update', 'user_id': 1}]

    # Patch asyncio.Semaphore to verify limit
    with patch('asyncio.Semaphore', wraps=pytest.importorskip('asyncio').Semaphore) as mock_semaphore:
        await service.generate_summary("2023-01-01", "2023-01-03")
        
        # Verify Semaphore was initialized with 2
        # Note: asyncio.Semaphore might be instantiated multiple times if used elsewhere, 
        # but in this flow it should be once in _analyze_logs_node
        # There's a print "[DEBUG] Using concurrency limit: 2" we could check but verifying the content is better.
        
        # Check if any call to Semaphore had arg 2
        # mock_semaphore.assert_called_with(2) can be tricky if positional vs keyword
        # Let's inspect call_args_list
        found = False
        for call in mock_semaphore.call_args_list:
            if call.args and call.args[0] == 2:
                found = True
                break
            if 'value' in call.kwargs and call.kwargs['value'] == 2:
                found = True
                break
        
        if not found:
            # Fallback check: maybe it wasn't called because of some logic skip?
            # Or maybe we need to be more loose.
            # Let's just assert mock_semaphore.call_count >= 1
            pass
        
        assert found, f"Semaphore should be initialized with 2, calls: {mock_semaphore.call_args_list}"
        assert found, f"Semaphore should be initialized with 2, calls: {mock_semaphore.call_args_list}"

@pytest.mark.asyncio
async def test_generate_summary_custom_language(service, mock_session, mock_redmine):
    # Setup Data
    mock_settings = AIWorkSummarySettings(
        owner_id=1,
        target_project_ids=json.dumps([101]),
        target_user_ids=json.dumps([1])
    )
    mock_session.exec.return_value.first.return_value = mock_settings
    
    # Mock Redmine
    issue_mock = MagicMock()
    issue_mock.id = 1
    issue_mock.project.id = 101
    issue_mock.project.name = "Test Project"
    issue_mock.updated_on = datetime(2023, 1, 2)
    issue_mock.journals = [{'user': 'user1', 'created_on': '2023-01-02', 'notes': 'update', 'user_id': 1}]
    issue_mock.description = ""
    issue_mock.attachments = []
    
    mock_redmine.search_issues_advanced.return_value = [issue_mock]
    mock_redmine.get_issue_journals.return_value = issue_mock.journals

    # Prepare Mock Session Side Effects for _analyze_logs_node
    # 1. get_settings (exec -> first) -> Already mocked above effectively if we structure right, 
    # but let's be safe and mocking side_effect again for the sequence of calls
    
    mock_session.exec.return_value.first.side_effect = [
        mock_settings, # get_settings
        UserSettings(user_id=1), # UserSettings (for redmine_url)
        AppSettings(id=1) # AppSettings (for concurrency)
    ]

    # Execute with "en"
    await service.generate_summary("2023-01-01", "2023-01-03", language="en")
    
    # Verify OpenAI Prompt Context
    all_calls = service.openai.chat_completion.call_args_list
    combined_prompts = ""
    for call in all_calls:
        args = call[0][0]
        for msg in args:
            if msg['role'] == 'user':
                combined_prompts += msg['content']
    
    assert "Language: en" in combined_prompts
