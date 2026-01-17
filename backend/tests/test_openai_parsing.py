import pytest
from unittest.mock import MagicMock, patch
from app.services.openai_service import OpenAIService
from app.models import TimeEntryExtraction

@pytest.fixture
def openai_service():
    return OpenAIService(api_key="fake-key")

def test_extract_time_entry_success(openai_service):
    # Mock OpenAI response
    mock_response = MagicMock()
    mock_response.choices[0].message.content = """
    {
        "issue_id": 1234,
        "project_name": null,
        "hours": 2.5,
        "activity_name": "Development",
        "comments": "Fix login bug",
        "confidence_score": 0.95
    }
    """
    
    with patch.object(openai_service.client.chat.completions, 'create', return_value=mock_response):
        result = openai_service.extract_time_entry("Spent 2.5 hours fixing login bug #1234")
        
        assert isinstance(result, TimeEntryExtraction)
        assert result.issue_id == 1234
        assert result.hours == 2.5
        assert result.comments == "Fix login bug"
        assert result.confidence_score == 0.95

def test_extract_time_entry_invalid_json(openai_service):
    # Mock invalid response
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Not a JSON"
    
    with patch.object(openai_service.client.chat.completions, 'create', return_value=mock_response):
        with pytest.raises(Exception): # Expect json.loads to fail or similar
            openai_service.extract_time_entry("Some text")
