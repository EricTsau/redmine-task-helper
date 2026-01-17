# Tasks: Add Task Import and Tracking

## 1. Backend - Task Query API
- [x] 1.1 新增 `GET /api/v1/tasks/search` 端點，支援 `project_id`, `assigned_to`, `status`, `q`, `updated_after` 參數 <!-- id: 1 -->
- [x] 1.2 新增 `TrackedTask` SQLModel 模型 (`redmine_issue_id`, `project_id`, `project_name`, `subject`, `status`, `custom_group`, `last_synced_at`) <!-- id: 2 -->

## 2. Backend - Task Tracking
- [x] 2.1 新增 `POST /api/v1/tracked-tasks/import` 端點，接受 issue IDs 陣列匯入追蹤 <!-- id: 3 -->
- [x] 2.2 新增 `GET /api/v1/tracked-tasks` 端點，回傳所有追蹤中的任務 <!-- id: 4 -->
- [x] 2.3 新增 `DELETE /api/v1/tracked-tasks/{id}` 端點，移除追蹤 <!-- id: 5 -->
- [x] 2.4 新增 `PATCH /api/v1/tracked-tasks/{id}/group` 端點，更新自定義分組 <!-- id: 6 -->

## 3. Backend - Sync
- [x] 3.1 實作 `sync_tracked_tasks()` 背景任務，每 5 分鐘同步 Redmine 狀態 <!-- id: 7 -->
- [x] 3.2 新增 `POST /api/v1/tracked-tasks/sync` 手動觸發同步 <!-- id: 8 -->

## 4. Frontend - Task Import Modal
- [x] 4.1 建立 `TaskImportModal.tsx` 元件，包含搜尋表單 (Project, Status, Keyword) <!-- id: 9 -->
- [x] 4.2 實作搜尋結果清單，支援 checkbox 多選 <!-- id: 10 -->
- [x] 4.3 實作「匯入選取」按鈕，呼叫 import API <!-- id: 11 -->

## 5. Frontend - Task List View
- [x] 5.1 建立 `TaskGroupView.tsx` 元件，支援 By Project / By Status / Custom Group 切換 <!-- id: 12 -->
- [x] 5.2 整合到 Dashboard，取代或擴充現有 TaskListView <!-- id: 13 -->
- [x] 5.3 實作右鍵選單或 UI 設定自定義 Group <!-- id: 14 -->

## 6. Testing
- [x] 6.1 後端：Pytest 測試 search, import, sync 端點 <!-- id: 15 -->
- [x] 6.2 前端：Vitest 測試 TaskImportModal 互動 <!-- id: 16 -->

