@echo off
REM Redmine Task Helper - Stop Script (Windows)
REM Usage: stop.bat

echo 🛑 Stopping Redmine Task Helper...

REM Try to close windows started by start.bat using window title
echo Closing frontend and backend windows if present...
taskkill /FI "WINDOWTITLE eq Redmine Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Redmine Frontend*" /T /F >nul 2>&1

REM Fallback: kill by listening port 8000 and 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R "0.0.0.0:8000 127.0.0.1:8000"') do (
    echo Killing PID %%a listening on port 8000...
    taskkill /PID %%a /T /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R "0.0.0.0:5173 127.0.0.1:5173"') do (
    echo Killing PID %%a listening on port 5173...
    taskkill /PID %%a /T /F >nul 2>&1
)

echo ✅ All requested services have been signaled to stop.
