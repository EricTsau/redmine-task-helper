## 1. Stage 1: MVP Backbone (Week 1-2)
- [ ] 1.1 **Backend Core**: Initialize FastAPI project with `python-redmine` integration (Login, Task List API).
- [ ] 1.2 **Frontend Core**: Initialize React 19 + Vite project with Tailwind & Shadcn UI. Implement basic Sidebar and Layout.
- [ ] 1.3 **Database**: Setup SQLite + SQLModel for local state persistence.
- [ ] 1.4 **Time Tracking Basic**: Implement Backend Timer logic (start/stop/resume) and Frontend Timer UI component.
- [ ] 1.5 **Dashboard Basic**: Implement "Focus Mode" view showing current active task.
- [ ] 1.6 **Settings Core**: Implement Configuration page (URL/API Key) and Connection Validation.
- [ ] 1.7 **Testing Stage 1**:
    - [ ] Add Pytest unit tests for Timer logic and Local State (mocking SQLModel/FastAPI).
    - [ ] Add Vitest tests for Timer Hook and Dashboard rendering (mocking API calls).

## 2. Stage 2: Efficiency Boost (Week 3)
- [ ] 2.1 **AI Service**: Implement OpenAI integration in FastAPI for text rewriting.
- [ ] 2.2 **UI - AI Features**: Add "Rewrite" button in Notes field and connect to backend.
- [ ] 2.3 **Image Upload**: Implement paste-listener in Frontend and upload-to-Redmine endpoint in Backend.
- [ ] 2.4 **Navigation**: Implement Global Search (Cmd+K) command palette UI.

## 3. Stage 3: Smart & Deploy (Week 4)
- [ ] 3.1 **Forget-Safe**: Implement backend background task for "Force Stop" after 4 hours.
- [ ] 3.2 **Offline Handling**: Implement local request buffering and retry mechanism for Time Logging.
- [ ] 3.3 **Notifications**: Implement Browser Notification triggering from Backend events.
- [ ] 3.4 **Packaging**: Create `docker-compose.yml` for easy deployment.
- [ ] 3.5 **PWA**: Configure Vite PWA plugin for desktop installation.
