# 專案規格書: 智慧型甘特圖側邊欄模組 (Intelligent Gantt Sidebar Module)

## 1. 專案概述 (Project Overview)

本模組旨在為專案 Leader 提供一個整合於 Sidebar 的高階專案管理介面。透過整合 **DHTMLX Gantt** 套件與 **Redmine** 數據，實現可視化的任務 CRUD、自動排程、資源管理與 AI 輔助決策功能。

- **核心技術:** React (Frontend), Python FastAPI (Middleware), Redmine (Data Source), DHTMLX Gantt (Library).
    
- **目標用戶:** 專案經理 (Project Leader).
    
- **關鍵價值:** 視覺化互動排程、自動化衝突解決、資源負載平衡。
    

---

## 2. 系統架構與資料流 (Architecture & Data Flow)

### 2.1 實體關係對應 (Entity Mapping)

AI 需處理 Redmine 資料格式與 DHTMLX 格式之間的轉換 (ETL)。

|**DHTMLX 欄位**|**Redmine 欄位 (原生/自定義)**|**備註**|
|---|---|---|
|`id`|`issue.id`|唯一識別碼|
|`text`|`issue.subject`|任務名稱|
|`start_date`|`issue.start_date`|需轉換格式 YYYY-MM-DD ↔ JS Date|
|`duration`|(計算欄位)|DHTMLX 自動計算，或由 `due_date` 反推|
|`parent`|`issue.parent_id`|建立 WBS 階層結構|
|`progress`|`issue.done_ratio`|0.0 ~ 1.0|
|`type`|`issue.tracker`|若 Tracker="里程碑" 則 type="milestone"|
|**Custom**|**Redmine Custom Fields**|**進階功能用**|
|`constraint_type`|CF: `Gantt Constraint Type`|值: MSO, FNLT, ASAP 等|
|`constraint_date`|CF: `Gantt Constraint Date`|限制日期|
|`baseline_start`|CF: `Baseline Start`|基準開始時間 (Snapshot)|
|`baseline_end`|CF: `Baseline End`|基準結束時間 (Snapshot)|

### 2.2 系統互動

1. **Frontend (React):** 負責 DHTMLX 渲染、事件捕捉 (onAfterTaskUpdate)、觸發 AI 建議。
    
2. **Middleware (Python):** 負責封裝 Redmine API，處理日期格式轉換、遞迴撈取子專案、寫入 Custom Fields。
    
3. **Backend (Redmine):** 資料持久層。
    

---

## 3. 功能需求詳細規格 (Detailed Functional Requirements)

### 3.1 MVP 核心功能 (Basic Features Integration)

#### A. 視圖與層級 (View & Hierarchy)

- **WBS 結構:** 依據 `parent_id` 渲染樹狀結構。父任務需設為 `project` 類型，鎖定編輯，其工期/進度由子任務自動匯總 (Rollup)。
    
- **時間軸控制:** Sidebar 頂部需實作 Toolbar，呼叫 `gantt.ext.zoom.setLevel("day"|"week"|"month")`。
    
- **虛擬滾動 (Virtual Scrolling):** 啟用 `gantt.config.smart_rendering = true` 以支援千筆以上任務流暢顯示。
    

#### B. 互動式 CRUD (Interactive CRUD)

- **任務拖拽:**
    
    - 監聽 `onAfterTaskUpdate` 事件。
        
    - Action: 將變更後的 `start_date`, `end_date` 透過 API 回寫 Redmine。
        
- **相依性 (Links):**
    
    - 視覺化: 支援 FS (Finish-to-Start) 連線。
        
    - 邏輯: 對應 Redmine `Precedes/Follows` 關係。
        
- **狀態視覺化:**
    
    - CSS Class 對應 Redmine `status_id` (e.g., `.gantt_task_line.status_in_progress { background: #3db9d3; }`).
        
    - 里程碑顯示為菱形。
        

### 3.2 進階功能 (Advanced Features)

#### C. 自動排程引擎 (Auto-Scheduling Engine)

- **關鍵路徑 (CPM):** 啟用 `gantt.plugins({ critical_path: true })`，並提供 Toggle 按鈕切換顯示。
    
- **假日管理:**
    
    - Python API `GET /api/holidays` 回傳全域非工作日設定。
        
    - 前端使用 `gantt.setWorkTime` 載入設定，確保自動排程跳過假日。
        
- **延遲傳導 (Lag/Lead):** 當任務 A 延遲，透過 `auto_scheduling` plugin 自動推移任務 B。
    

#### D. 資源管理與 AI 建議 (Resource & AI)

- **資源視圖:** 於甘特圖下方渲染 `resource_diagram` (Histogram)。
    
- **過載偵測 (AI Hook):**
    
    - 前端邏輯: 監測資源圖表的 Over-allocation 狀態。
        
    - AI Trigger: 當紅色超載發生，Sidebar 彈出 Toast: _"偵測到 [User] 下週工時過載，建議調整..."_。
        
    - Action: 使用者點擊「優化」後，自動調整任務分配或時間。
        

#### E. 基線管理 (Baselines)

- **Snapshot 機制:**
    
    - UI Action: Sidebar 按鈕 "建立基線 (Create Snapshot)"。
        
    - Logic: Python 遍歷當前所有任務，將 `start_date` / `due_date` 複製到 Custom Fields (`Baseline Start`/`End`)。
        
- **對比視圖:** 啟用 DHTMLX Baseline 顯示模式，同時渲染「計劃 (灰色)」與「實際 (藍色)」條。
    

#### F. 跨專案與匯出 (Portfolio & Export)

- **跨專案讀取:** Python 後端需實作遞迴查詢 (Recursive Fetch)，當選取主專案時，自動撈取所有子專案 Issue。
    
- **匯出:** 呼叫 Python 後端生成 PDF/Excel 報表 (使用 Pandas/ReportLab)，避免資料上傳第三方伺服器。