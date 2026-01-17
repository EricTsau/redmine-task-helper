# 新增 Redmine 任務匯入與追蹤功能

## Why
目前系統僅顯示「指派給我的任務」，使用者無法主動從 Redmine 搜尋並匯入特定任務進行追蹤。使用者需要能夠：
- 依 Project、Task Name、指派者、時間範圍等條件查詢 Redmine 任務
- 選擇單一或多個任務匯入系統追蹤
- 追蹤任務狀態變化
- 以 Project 或自定義分組方式檢視任務

## What Changes
- **Task Query API**: 後端新增彈性查詢端點，支援多條件篩選
- **Task Import**: 使用者可單選或多選匯入任務到本地追蹤清單
- **Task Sync**: 背景同步 Redmine 任務狀態
- **Task Grouping**: 前端支援依 Project、Status、自定義 Group 分類檢視

## Impact
- **New Capabilities**: task-management
- **Modified Capabilities**: dashboard (任務清單整合)
- **New Code**: 
  - Backend: `routers/tracked_tasks.py`, `tasks/sync_tasks.py`
  - Frontend: `TaskImportModal.tsx`, `TaskGroupView.tsx`
- **Breaking Changes**: None
