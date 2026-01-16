import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_timer(client: AsyncClient):
    response = await client.post("/api/v1/timer/start", json={"issue_id": 101, "comment": "Test Task"})
    assert response.status_code == 200
    data = response.json()
    assert data["issue_id"] == 101
    assert data["is_running"] is True
    assert data["comment"] == "Test Task"

@pytest.mark.asyncio
async def test_stop_timer(client: AsyncClient):
    # Start a timer first
    await client.post("/api/v1/timer/start", json={"issue_id": 102})
    
    response = await client.post("/api/v1/timer/stop", json={"comment": "Done"})
    assert response.status_code == 200
    data = response.json()
    assert data["issue_id"] == 102
    assert data["is_running"] is False
    assert data["duration"] >= 0
    assert data["comment"] == "Done"

@pytest.mark.asyncio
async def test_current_timer(client: AsyncClient):
    # No timer initially
    response = await client.get("/api/v1/timer/current")
    assert response.json() is None

    # Start timer
    await client.post("/api/v1/timer/start", json={"issue_id": 103})
    
    response = await client.get("/api/v1/timer/current")
    assert response.status_code == 200
    data = response.json()
    assert data["issue_id"] == 103
    assert data["is_running"] is True
