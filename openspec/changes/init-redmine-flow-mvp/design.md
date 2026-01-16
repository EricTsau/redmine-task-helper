## Context
We are building a desktop-class web application "Redmine Flow" to modernize the Redmine experience. The focus is on low-friction time tracking and task management.

## Goals / Non-Goals
- **Goals**:
    - "Focus Mode" for single-task attention.
    - Robust time tracking that survives browser restarts (Backend-side timing).
    - AI-assisted log writing and image uploading.
    - Low latency UI (React 19 + Vite).
- **Non-Goals**:
    - Replacing all Redmine features (e.g., Gantt charts, heavy administration).
    - Mobile native app (PWA is sufficient).

## Decisions
- **Decision**: Use FastAPI as the backend intermediary.
    - **Why**: Handles API key security (keys not in frontend), allows async AI processing, and manages local SQLite persistence for the timer.
- **Decision**: Use SQLite for local state.
    - **Why**: Persist timer state and user preferences (favorites) locally without needing a heavy database setup, while ensuring data survives restarts.
- **Decision**: React 19 + Tailwind + Shadcn UI.
    - **Why**: Modern, fast development, beautiful defaults (Glassmorphism), and dark mode support.

## Risks / Trade-offs
- **Risk**: Synchronization conflicts if multiple tabs/devices are used.
    - **Mitigation**: Timer state is single-source-of-truth in the local backend.
- **Risk**: API Rate limiting from OpenAI or Redmine.
    - **Mitigation**: Backend queue/throttling if necessary (Phase 2).
