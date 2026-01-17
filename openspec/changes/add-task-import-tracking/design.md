# Design: Task Import and Tracking

## Context
使用者需要從 Redmine 匯入任務到本地系統進行追蹤。目前系統僅顯示「指派給我的任務」，無法追蹤其他任務。

## Goals
1. 提供彈性的任務搜尋功能
2. 支援批次匯入任務
3. 自動同步任務狀態
4. 提供多種分組檢視方式

## Non-Goals
- 不會修改 Redmine 上的任務資料 (唯讀)
- 不會實現任務編輯功能 (Phase 2)

## Decisions

### D1: 本地追蹤清單
使用 SQLite `TrackedTask` 表儲存使用者選擇追蹤的任務 ID，包含：
- `redmine_issue_id` (PK)
- `project_id`, `project_name`
- `subject`, `status`
- `custom_group` (使用者自定義分組)
- `last_synced_at`

**Rationale**: 避免每次重新查詢 Redmine，提供離線檢視能力。

### D2: 查詢 API 設計
```
GET /api/v1/tasks/search?project_id=1&assigned_to=me&status=open&q=keyword
```
支援參數：
- `project_id`: 專案 ID
- `assigned_to`: `me` 或使用者 ID
- `status`: `open`, `closed`, `all`
- `q`: 關鍵字搜尋 (Subject)
- `updated_after`: 時間範圍

**Rationale**: RESTful 設計，與現有 `/tasks/` 端點一致。

### D3: 分組方式
前端提供三種分組：
1. **By Project**: 預設，依專案分類
2. **By Status**: 依狀態分類
3. **Custom Group**: 使用者自定義標籤

**Rationale**: 滿足不同工作流需求，自定義分組提供彈性。

### D4: 同步策略
- 啟動時同步一次
- 每 5 分鐘背景同步
- 手動重新整理按鈕

**Rationale**: 平衡即時性與 API 負載。

## Risks and Trade-offs
| Risk | Mitigation |
|------|------------|
| 大量任務導致效能問題 | 分頁查詢，每次最多 50 筆 |
| Redmine API 限流 | 合併請求，緩存結果 |
| 離線時資料過期 | 顯示 `last_synced_at` 提示 |
