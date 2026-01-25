
import pytest
from app.routers.okr_copilot import extract_images_from_issue

def test_extract_markdown_images():
    issue = {
        "id": 1,
        "description": 'Test image ![Alt](http://example.com/img.png)',
        "notes": "",
        "attachments": []
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://example.com/img.png"
    assert images[0]["caption"] == "Alt"

def test_extract_html_images():
    issue = {
        "id": 1,
        "description": 'Test image <img src="http://example.com/img.png" />',
        "notes": "",
        "attachments": []
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://example.com/img.png"

def test_extract_textile_simple():
    issue = {
        "id": 1,
        "description": 'Test image !test.png!',
        "notes": "",
        "attachments": [
            {"filename": "test.png", "content_url": "http://redmine/attachments/1/test.png"}
        ]
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://redmine/attachments/1/test.png"
    assert images[0]["caption"] == "Issue #1 (test.png)"

def test_extract_textile_with_styles():
    issue = {
        "id": 1,
        "description": 'Test image !{width:50%}test.png!',
        "notes": "",
        "attachments": [
            {"filename": "test.png", "content_url": "http://redmine/attachments/1/test.png"}
        ]
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://redmine/attachments/1/test.png"

def test_extract_textile_with_caption_and_align():
    issue = {
        "id": 1,
        "description": 'Test image !>test.png(My Caption)!',
        "notes": "",
        "attachments": [
            {"filename": "test.png", "content_url": "http://redmine/attachments/1/test.png"}
        ]
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://redmine/attachments/1/test.png"
    assert images[0]["caption"] == "My Caption"

def test_extract_textile_complex():
    # !>{width:200px}image.png(Caption)!
    issue = {
        "id": 1,
        "description": 'Complex !>{width:200px}image.png(Caption)!',
        "notes": "",
        "attachments": [
            {"filename": "image.png", "content_url": "http://redmine/attachments/1/image.png"}
        ]
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://redmine/attachments/1/image.png"
    assert images[0]["caption"] == "Caption"

def test_extract_textile_missing_attachment():
    # Should be skipped if not in attachments
    issue = {
        "id": 1,
        "description": 'Missing !missing.png!',
        "notes": "",
        "attachments": []
    }

def test_extract_textile_external_url():
    issue = {
        "id": 1,
        "description": 'External image !http://example.com/external.png!',
        "notes": "",
        "attachments": []
    }
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "http://example.com/external.png"


