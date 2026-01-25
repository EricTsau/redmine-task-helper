import pytest
from app.routers.okr_copilot import extract_images_from_issue

def test_extract_images_markdown_basic():
    """Test standard Markdown image syntax"""
    issue = {
        "id": 1,
        "description": "Here is an image ![test image](https://example.com/img.png)",
        "notes": "",
        "attachments": []
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://example.com/img.png"
    assert images[0]["caption"] == "test image"
    assert images[0]["issue_id"] == 1

def test_extract_images_markdown_with_title():
    """Test Markdown image syntax with title"""
    issue = {
        "id": 1,
        "description": '![test image](https://example.com/img.png "Title")',
        "notes": "",
        "attachments": []
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://example.com/img.png"
    assert images[0]["caption"] == "test image"

def test_extract_images_html():
    """Test HTML img tag syntax"""
    issue = {
        "id": 1,
        "description": 'Some text <img src="https://example.com/img.jpg" alt="test">',
        "notes": "",
        "attachments": []
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://example.com/img.jpg"

def test_extract_images_textile_basic():
    """Test Redmine Textile basic syntax"""
    issue = {
        "id": 1,
        "description": "Text !image.png! Text",
        "notes": "",
        "attachments": [
            {"filename": "image.png", "content_url": "https://redmine.example/attachments/1/image.png"}
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://redmine.example/attachments/1/image.png"
    assert "image.png" in images[0]["caption"]

def test_extract_images_textile_styles():
    """Test Redmine Textile syntax with styles and alignment"""
    issue = {
        "id": 1,
        "description": "Align right !>image1.png! and style !{width:50%}image2.png!",
        "notes": "",
        "attachments": [
            {"filename": "image1.png", "content_url": "https://redmine.example/att/1.png"},
            {"filename": "image2.png", "content_url": "https://redmine.example/att/2.png"}
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 2
    urls = [img["url"] for img in images]
    assert "https://redmine.example/att/1.png" in urls
    assert "https://redmine.example/att/2.png" in urls

def test_extract_images_textile_with_alt():
    """Test Redmine Textile syntax with alt text"""
    issue = {
        "id": 1,
        "description": "!image.png(Alt Text)!",
        "notes": "",
        "attachments": [
            {"filename": "image.png", "content_url": "https://redmine.example/att/1.png"}
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["caption"] == "Alt Text"

def test_extract_images_from_notes():
    """Test extracting images from issue notes"""
    issue = {
        "id": 1,
        "description": "",
        "notes": "Here is a note image ![note-img](https://example.com/note.png)",
        "attachments": []
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://example.com/note.png"

def test_attachment_mapping_markdown():
    """Test mapping attachment filenames in Markdown syntax"""
    issue = {
        "id": 1,
        "description": "![screenshot](screenshot.png)",
        "notes": "",
        "attachments": [
            {"filename": "screenshot.png", "content_url": "https://redmine.example/att/100/screenshot.png"}
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert images[0]["url"] == "https://redmine.example/att/100/screenshot.png"

def test_redmine_url_resolution():
    """Test resolving relative URLs using redmine_url"""
    issue = {
        "id": 1,
        "description": "![relative](/images/foo.png)",
        "notes": "",
        "attachments": []
    }
    redmine_url = "https://my-redmine.com"
    
    images = extract_images_from_issue(issue, redmine_url)
    assert len(images) == 1
    assert images[0]["url"] == "https://my-redmine.com/images/foo.png"

def test_mixed_content():
    """Test mixed content type in one issue"""
    issue = {
        "id": 1,
        "description": "MD: ![md](md.png) and Textile: !textile.png!",
        "notes": "HTML: <img src='html.jpg'>",
        "attachments": [
            {"filename": "md.png", "content_url": "http://url/md.png"},
            {"filename": "textile.png", "content_url": "http://url/textile.png"}
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 3
    urls = {img["url"] for img in images}
    assert "http://url/md.png" in urls
    assert "http://url/textile.png" in urls
    assert "html.jpg" in urls or "html.jpg" in [img["url"] for img in images]

def test_extract_images_textile_with_spaces():
    """Test Redmine Textile syntax with spaces in filename"""
    issue = {
        "id": 192,
        "description": "",
        "notes": "Here is an image !Screenshot from 2026-01-24 19-58-54.png!",
        "attachments": [
            {
                "filename": "Screenshot from 2026-01-24 19-58-54.png",
                "content_url": "http://127.0.0.1:10083/attachments/download/30/Screenshot%20from%202026-01-24%2019-58-54.png"
            }
        ]
    }
    
    images = extract_images_from_issue(issue)
    assert len(images) == 1
    assert "Screenshot%20from%202026-01-24%2019-58-54.png" in images[0]["url"]

