from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import create_db_and_tables
from app.tasks.forget_safe import start_forget_safe_task
from app.tasks.sync_tasks import start_sync_task

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    start_forget_safe_task()
    start_sync_task()
    yield

app = FastAPI(title="Redmine Flow API", version="0.1.0", lifespan=lifespan)

from app.routers import auth, tasks, timer

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(timer.router, prefix="/api/v1/timer", tags=["timer"])
from app.routers import settings
app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
from app.routers import ai
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
from app.routers import upload
app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])
from app.routers import notifications
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
from app.routers import tracked_tasks
app.include_router(tracked_tasks.router, prefix="/api/v1/tracked-tasks", tags=["tracked-tasks"])
from app.routers import projects
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
from app.routers import chat
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
from app.routers import watchlist
app.include_router(watchlist.router, prefix="/api/v1/watchlist", tags=["watchlist"])
from app.routers import analysis
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])

@app.get("/")
async def root():
    return {"message": "Redmine Flow API is running"}
