@echo off
REM Redmine Task Helper - Start Script (Windows)
REM Usage: start.bat

SETLOCAL ENABLEDELAYEDEXPANSION
echo 🚀 Starting Redmine Task Helper...

REM Start Backend (port 8000)
echo 📦 Starting Backend (port 8000)...
pushd backend
IF NOT EXIST venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
REM Start uvicorn and worker = 4
@REM start "Redmine Backend" cmd /c "uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4"
start "Redmine Backend" cmd /c "uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
REM uvicorn will start in a new window; capture its tasklist name is non-trivial
popd

REM Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

REM Start Frontend (port 5173)
echo 🎨 Starting Frontend (port 5173)...
pushd frontend
@REM npm install --legacy-peer-deps --no-audit --no-fund >nul 2>&1
start "Redmine Frontend" cmd /c "npm run dev"
popd

echo.
echo ✅ Redmine Task Helper has been started.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Use stop.bat to stop services (or close the started windows).
ENDLOCAL
