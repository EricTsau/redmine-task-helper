import pytest
import io
from app.services.export_service import ExportService
from unittest.mock import MagicMock, patch, AsyncMock
import json

@pytest.mark.asyncio
async def test_export_pdf_converts_tables():
    service = ExportService()
    markdown_text = """
# Test Report

| Header A | Header B |
|----------|----------|
| Cell 1   | Cell 2   |
"""
    # We want to inspect the HTML conversion logic. 
    # Since export_to_pdf does it internally, we might need to expose a helper or check the output pdf (hard).
    # Strategy: Mock `pdf.write_html` to see what HTML it receives.
    
    with patch("fpdf.FPDF.write_html") as mock_write_html, \
         patch("fpdf.FPDF.output") as mock_output:
        
        await service.export_to_pdf(markdown_text)
        
        # Check arguments passed to write_html
        args, _ = mock_write_html.call_args
        html_content = args[0]
        
        # Verify it contains table tags, not raw markdown
        assert '<table border="1" width="100%">' in html_content
        assert "<th>Header A</th>" in html_content
        assert "<td>Cell 1</td>" in html_content

@pytest.mark.asyncio
async def test_export_pdf_fetches_images():
    service = ExportService()
    markdown_text = "![Test Image](http://example.com/img.png)"
    
    # Mock httpx response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-image-bytes"
    
    with patch("httpx.AsyncClient.get", return_value=mock_response) as mock_get, \
         patch("fpdf.FPDF.write_html") as mock_write_html:
        
        await service.export_to_pdf(markdown_text)
        
        # Verify get was called
        mock_get.assert_called_once()
        
        # Verify HTML contains base64
        args, _ = mock_write_html.call_args
        html_content = args[0]
        assert "data:image/png;base64" in html_content # Our logic defaults to jpeg/png based on extension? 
        # Wait, extension in url is .png, logic says mime=image/png
        assert "data:image/png;base64" in html_content

@pytest.mark.asyncio
async def test_export_pdf_resilience_to_missing_images():
    service = ExportService()
    # Markdown with a 'broken' image link (file-...)
    markdown_text = """
# Report
![Bad Image](file-1769255103083-89od0qysm)
Text content.
"""
    
    # Mock _fetch_image to return None for this file (simulating not found)
    with patch.object(service, "_fetch_image", return_value=None) as mock_fetch:
        with patch("fpdf.FPDF.write_html") as mock_write_html:
            # We are testing that this does NOT raise an exception
            pdf_io = await service.export_to_pdf(markdown_text)
            
            # Verify fetch was validly SKIPPED for invalid protocol
            # Update: New logic tries to fetch all clean srcs to be safe, so we accept a call.
            # But it should return None and result in placeholder.
            # mock_fetch.assert_not_called() 
            
            # Verify the HTML passed to write_html has the broken src replaced
            args, _ = mock_write_html.call_args
            html_content = args[0]
            
            # We fail if the original broken src is still present in a way fpdf would try to load
            # i.e. src="file-..." should NOT be present.
            assert 'src="file-1769255103083-89od0qysm"' not in html_content
            
            # It should have been replaced by our fallback (1x1 pixel gif)
            assert 'data:image/gif;base64' in html_content
            # assert 'alt="Image not found"' in html_content # Old Logic replaced tag
            # New logic preserves alt text if present
            assert 'alt="Bad Image"' in html_content

@pytest.mark.asyncio
async def test_export_pdf_with_temp_image():
    service = ExportService()
    markdown_text = "![Temp]( /temp_images/test.png )"
    
    # Mock _fetch_image directly for this test too, to ignore FS
    with patch.object(service, "_fetch_image", return_value=b"fake-bytes") as mock_fetch:
        await service.export_to_pdf(markdown_text)
        # Verify it stripped spaces and tried to fetch
        mock_fetch.assert_called_with("/temp_images/test.png", None, None)

@pytest.mark.asyncio
async def test_generate_gitlab_section():
    service = ExportService()
    metrics = {
        "instances": [
            {
                "name": "Test GitLab",
                "impact": {"total_commits": 10},
                "cycle": {"average_cycle_time_seconds": 3600},
                "heatmap": [{"day": 0, "hour": 1, "count": 5}]
            }
        ]
    }
    json_metrics = json.dumps(metrics)
    
    html = service._generate_gitlab_section(json_metrics)
    
    assert "GitLab Pulse Dashboard" in html
    assert "Test GitLab" in html
    assert "Total Commits" in html
    assert "data:image/png;base64" in html # Check heatmap generation

@pytest.mark.asyncio
async def test_export_docx_structure():
    service = ExportService()
    markdown_text = """
# Title
- Item 1
- Item 2

| Col1 | Col2 |
|---|---|
| A | B |
"""
    # Mock _fetch_image just in case, though no images here
    with patch.object(service, "_fetch_image", return_value=None):
        docx_io = await service.export_to_docx(markdown_text, "Docx Title")
        
        assert docx_io is not None
        # We can't easily assert docx content without unzip, but if it runs without error 
        # and returns bytes, it's a good sign the BS4 parsing logic didn't crash.

@pytest.mark.asyncio
async def test_heatmap_generation():
    service = ExportService()
    data = [{"day": 0, "hour": 0, "count": 10}]
    img_b64 = service._generate_gitlab_heatmap_img(data)
    assert img_b64.startswith("data:image/png;base64,")

