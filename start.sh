#!/bin/bash

# Redmine Flow - Start Script
# Usage: ./start.sh

set -e

echo "🚀 Starting Redmine Flow..."

# Start Backend
echo "📦 Starting Backend (port 8000)..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to be ready
sleep 2

# Start Frontend
echo "🎨 Starting Frontend (port 5173)..."
cd frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Save PIDs
echo "$BACKEND_PID" > .pids
echo "$FRONTEND_PID" >> .pids

echo ""
echo "✅ Redmine Flow is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Run ./stop.sh to stop all services"
