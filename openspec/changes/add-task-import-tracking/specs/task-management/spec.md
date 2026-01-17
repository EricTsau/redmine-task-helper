# task-management Specification

## Purpose
提供 Redmine 任務的匯入、追蹤與分組管理功能。

## ADDED Requirements

### Requirement: Task Search and Import
The system SHALL allow users to search and import Redmine tasks into a local tracking list.

#### Scenario: Search tasks from Redmine
- **WHEN** 使用者開啟「匯入任務」對話框
- **THEN** 系統顯示搜尋表單，包含 Project、Status、Keyword 篩選條件
- **AND** 使用者可執行搜尋取得符合條件的 Redmine 任務

#### Scenario: Import selected tasks
- **WHEN** 使用者從搜尋結果中勾選一個或多個任務
- **AND** 點擊「匯入」按鈕
- **THEN** 系統將選取的任務加入本地追蹤清單
- **AND** 這些任務顯示在 Dashboard 的任務清單中

### Requirement: Task Status Tracking
The system SHALL automatically synchronize the status of tracked tasks from Redmine.

#### Scenario: Automatic sync
- **WHEN** 系統啟動或每隔 5 分鐘
- **THEN** 系統背景同步所有追蹤中任務的最新狀態
- **AND** 更新本地緩存的 status、進度等資訊

#### Scenario: Manual sync
- **WHEN** 使用者點擊「重新整理」按鈕
- **THEN** 系統立即同步所有追蹤中任務的狀態

#### Scenario: Status change display
- **WHEN** 追蹤中的任務狀態發生變化 (例如從 In Progress 變為 Resolved)
- **THEN** 任務清單中顯示更新後的狀態
- **AND** 可選擇顯示變更提示 (視覺標記)

### Requirement: Task Grouping
The system SHALL provide multiple grouping options for viewing tracked tasks.

#### Scenario: Group by Project
- **WHEN** 使用者選擇「依專案」分組
- **THEN** 任務清單依 Project 名稱分組顯示

#### Scenario: Group by Status
- **WHEN** 使用者選擇「依狀態」分組
- **THEN** 任務清單依 Status (New, In Progress, Resolved, etc.) 分組顯示

#### Scenario: Custom Group
- **WHEN** 使用者為任務指定自定義 Group 標籤
- **THEN** 該任務出現在對應的自定義分組中
- **AND** 使用者可選擇「依自定義分組」檢視
