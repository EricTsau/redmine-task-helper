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


# Validate access token early for protected API routes
@app.middleware("http")
async def log_requests_middleware(request, call_next):
    print(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"Response status: {response.status_code} for {request.method} {request.url.path}")
    if response.status_code == 302:
        print(f"Redirecting to: {response.headers.get('location')}")
    return response

@app.middleware("http")
async def validate_access_token_middleware(request, call_next):
    from app.auth_utils import decode_access_token

    path = request.url.path
    # Only validate API v1 routes (skip auth endpoints)
    if path.startswith("/api/v1") and not path.startswith("/api/v1/auth"):
        # Allow CORS preflight requests through
        if request.method == "OPTIONS":
            return await call_next(request)
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=401, content={"detail": "Missing Authorization header"})

        token = auth_header.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload is None:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

    response = await call_next(request)
    return response


# Fallback middleware: ensure CORS headers are present on all responses (including errors)
@app.middleware("http")
async def ensure_cors_headers(request, call_next):
    from fastapi import HTTPException
    try:
        response = await call_next(request)
    except HTTPException as e:
        # Preserve HTTPException status and detail instead of converting to 500
        response = JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except Exception as e:
        import traceback as _tb
        print("Unhandled exception in ensure_cors_headers middleware:")
        _tb.print_exc()
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

# 通用 AI Copilot (migrated to openai_proxy)
from app.routers import openai_proxy
app.include_router(openai_proxy.router, prefix="/api/v1", tags=["copilot"])

# OKR Copilot 報告模組
from app.routers import okr_copilot
app.include_router(okr_copilot.router, prefix="/api/v1", tags=["okr-copilot"])

from fastapi.staticfiles import StaticFiles
import os

# Create temp_files directory if not exists
os.makedirs("temp_files", exist_ok=True)
app.mount("/temp_images", StaticFiles(directory="temp_files"), name="temp_images")

@app.get("/")
async def root():
    return {"message": "Redmine Task Helper API is running"}
