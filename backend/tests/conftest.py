import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlmodel import Session, SQLModel, create_engine
from app.main import app
from app.database import get_session

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:", # In-memory DB for tests
        connect_args={"check_same_thread": False},
        poolclass=None # No pooling for in-memory
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest_asyncio.fixture(name="client")
async def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    
    # Use AsyncClient for FastAPI testing
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()

