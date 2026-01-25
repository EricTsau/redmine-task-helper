FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for potential native python-redmine deps)
# RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

COPY . .

# Create directory for SQLite execution if it doesn't exist (though COPY . . usually handles structure)
# RUN mkdir -p data

EXPOSE 8000

# Run with Gunicorn using Uvicorn workers
# 8 workers as requested
CMD ["gunicorn", "-w", "8", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
