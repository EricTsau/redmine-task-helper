# Change: Initialize Redmine Flow MVP

## Why
Redmine is currently viewed as a "reporting tool" requiring high effort. We want to transform it into a "smart assistant" (Redmine Flow) that minimizes friction and maximizes value for users. The goal is to provide a modern, fast, and intelligent interface for time tracking and task management.

## What Changes
Initialize the Redmine Flow application with the following core capabilities:
- **Architecture**: React 19 frontend + FastAPI backend + SQLite local cache.
- **Settings**: Initial Configuration flow (URL/Key) and Connection Validation.
- **Dashboard**: Focus Mode, Global Search with Recent Tasks cache, Favorites, and Assignment lists.
- **Time Tracking**: Smart Timer with backend persistence, offline buffering/retry, and auto-stop (Forget-Safe).
- **AI Assistance**: AI-powered note rewriting and clipboard-to-Redmine image upload.

## Impact
- **New Capabilities**: Dashboard, Time Tracking, AI Assistance.
- **New Code**: Complete greenfield implementation of Frontend and Backend.
- **Breaking Changes**: None (New project).
