#!/bin/bash

# Redmine Task Helper - Stop Script
# Usage: ./stop.sh

echo "🛑 Stopping Redmine Task Helper..."

# Kill by saved PIDs
if [ -f ".pids" ]; then
    while read pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null && echo "Stopped process $pid"
        fi
    done < .pids
    rm -f .pids
fi

# Kill by port (fallback)
fuser -k 8000/tcp 2>/dev/null && echo "Stopped backend (port 8000)"
fuser -k 5173/tcp 2>/dev/null && echo "Stopped frontend (port 5173)"

echo "✅ All services stopped"
