from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.database import create_db_and_tables
from app.tasks.forget_safe import start_forget_safe_task
# from app.tasks.sync_tasks import start_sync_task

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    
    # Initialize default admin user
    from sqlmodel import Session, select
    from app.database import engine
    from app.models import User, AuthSource
    from app.auth_utils import get_password_hash
    
    with Session(engine) as session:
        admin_user = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_user:
            print("Creating default admin user...")
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin"),
                is_admin=True,
                auth_source=AuthSource.STANDARD,
                full_name="Administrator"
            )
            session.add(admin_user)
            session.commit()

    start_forget_safe_task()
    # start_sync_task()
    yield

app = FastAPI(title="Redmine Task Helper API", version="0.1.0", lifespan=lifespan)

from app.routers import auth, tasks, timer

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Fallback middleware: ensure CORS headers are present on all responses (including errors)
@app.middleware("http")
async def ensure_cors_headers(request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        response = JSONResponse(status_code=500, content={"detail": str(e)})

    origin = request.headers.get("origin")
    if origin:
        allowed = ["http://localhost:5173", "http://127.0.0.1:5173"]
        response.headers.setdefault("Access-Control-Allow-Origin", origin if origin in allowed else "http://localhost:5173")
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        response.headers.setdefault("Access-Control-Allow-Methods", "*")
        response.headers.setdefault("Access-Control-Allow-Headers", "*")

    return response

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(timer.router, prefix="/api/v1/timer", tags=["timer"])
from app.routers import settings, admin
app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
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
from app.routers import chat, ai_summary
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(ai_summary.router, prefix="/api/v1/ai-summary", tags=["ai-summary"])
from app.routers import watchlist
app.include_router(watchlist.router, prefix="/api/v1/watchlist", tags=["watchlist"])
from app.routers import analysis
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])
from app.routers import issues
app.include_router(issues.router, prefix="/api/v1/issues", tags=["issues"])

# AI PM Copilot 模組
from app.routers import pm_copilot, holidays, prd
app.include_router(pm_copilot.router, prefix="/api/v1/pm-copilot", tags=["pm-copilot"])
app.include_router(holidays.router, prefix="/api/v1/holidays", tags=["holidays"])
app.include_router(prd.router, prefix="/api/v1", tags=["prd"])
from app.routers import planning
app.include_router(planning.router, prefix="/api/v1", tags=["planning"])
from app.routers import dashboard, gitlab
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(gitlab.router, prefix="/api/v1/gitlab", tags=["gitlab"])

from fastapi.staticfiles import StaticFiles
import os

# Create temp_files directory if not exists
os.makedirs("temp_files", exist_ok=True)
app.mount("/temp_images", StaticFiles(directory="temp_files"), name="temp_images")

@app.get("/")
async def root():
    return {"message": "Redmine Task Helper API is running"}
