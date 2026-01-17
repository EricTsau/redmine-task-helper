這是一份彙整了您所有技術要求（React + Vite + Python FastAPI）、架構決策（Headless、瀏覽器端憑證儲存、SQLite/PG 彈性切換）與管理思維（MVP、服務設計）的**最終版軟體需求規格書 (Final Software Requirements Specification)**。

---

# 專案規格書：Redmine AI 智能協作平台 (Redmine AI Wrapper)

## 1. 專案願景與範圍 (Vision & Scope)

### 1.1 核心痛點
*   **成員端**：Redmine 原生介面操作繁瑣，導致工時紀錄不全或延遲，被視為行政負擔,。
*   **主管端**：缺乏即時的可視化報表，資料分散難以統計，無法快速掌握專案風險,。

### 1.2 解決方案
開發一個 **「AI 外掛介面 (Wrapper)」**。不替換 Redmine，而是透過 API 接管「輸入」與「查詢」體驗。利用 **React** 提供互動式儀表板，**Python FastAPI** 處理 AI 邏輯，並透過 **OpenAI** 進行自然語言解析。

### 1.3 預期效益
1.  **無感輸入 (Frictionless Input)**：成員用對話方式即可完成日報，降低抗拒感。
2.  **智慧決策 (Intelligent Insight)**：主管透過對話生成甘特圖與風險報告，效率翻倍。
3.  **隱私與彈性**：敏感憑證不落地，資料庫架構保留企業級擴充彈性。

---

## 2. 系統架構設計 (System Architecture)

採用 **前後端分離 (Headless)** 與 **本地優先 (Local-First)** 的混合架構。

### 2.1 技術堆疊 (Tech Stack)
| 層級 | 技術選型 | 職責描述 |
| :--- | :--- | :--- |
| **Frontend** | **React + Vite** | SPA 單頁應用。負責 UI 渲染、狀態管理、**API Key 加密儲存**。 |
| **Backend** | **Python (FastAPI)** | RESTful API 服務。負責業務邏輯、OpenAI 串接、Redmine API 轉發。 |
| **AI Core** | **OpenAI Python Lib** | 負責 NLP 意圖識別、實體提取 (Entity Extraction)、SQL/Filter 生成。 |
| **Database** | **SQLite (Dev) / PostgreSQL (Prod)** | 儲存非敏感設定（如關注清單、UI 偏好）。透過 SQLAlchemy ORM 切換。 |
| **Migration** | **Alembic** | 資料庫版本控制，嚴格執行命名規範。 |

### 2.2 安全性架構 (Security Spec)
為符合「API Key 存在客戶端」的需求：
1.  **憑證儲存**：OpenAI API Key 與 Redmine API Key 僅存於使用者瀏覽器的 `localStorage` (或加密後的 IndexedDB)。
2.  **傳輸協定**：前端發送請求時，將 Key 放入 HTTP Request Header (如 `X-OpenAI-Key`)。
3.  **後端處理**：FastAPI 透過 Dependency Injection 讀取 Header，僅在 **記憶體 (In-Memory)** 中暫存以完成當次請求，**嚴禁**寫入後端資料庫或 Log 文件。

---

## 3. 功能需求規格 (Functional Requirements)

### 3.1 模組 A：成員端 - 極速回報 (Frictionless Input)
**目標：** 讓成員在 30 秒內完成工時紀錄。

*   **功能 A1：自然語言填單 (NLP Time Logging)**
    *   **介面：** 整合至 Slack/Teams 機器人或 React 手機版網頁。
    *   **流程：**
        1.  成員輸入：「今早花 3 小時修復登入 Bug #1024」。
        2.  Python 後端呼叫 OpenAI 提取實體：`{issue_id: 1024, hours: 3, activity: "Bug Fix", comment: "修復登入..."}`。
        3.  寫入 Redmine `time_entries` API。
    *   **例外處理：** 若資訊缺漏（如沒說專案），AI 自動追問。

*   **功能 A2：自動化站立會議 (Auto Stand-up)**
    *   **流程：** 每日定時推播「今天做了什麼？」，成員回覆即完成日報。若整合 Git，系統自動建議：「偵測到您提交了 commit，是否紀錄？」。

### 3.2 模組 B：主管端 - 智能戰情室 (Intelligent Dashboard)
**目標：** 降低 AI Token 消耗，並提供即時視覺化。

*   **功能 B1：關注專案過濾器 (Project Watchlist & Pre-filtering)**
    *   **邏輯：** 這是降低 Chatbot 處理量的核心。
    *   **設定：** 主管在 React 後台勾選「關注專案 A, B」。此設定存於後端 SQLite。
    *   **運作：** 當主管問「進度如何？」時，Python **先**讀取 SQLite 的關注清單，**只**向 Redmine 撈取這兩個專案的資料，**最後**才把過濾後的少量資料餵給 OpenAI 分析。

*   **功能 B2：三階段對話式查詢 (Conversational BI)**
    *   參考 *JiraGPT Next* 架構,：
    *   **Phase 1 (Intent):** AI 將口語轉譯為 Redmine API Filter (JSON)。*Temperature = 0*。
    *   **Phase 2 (Optimization):** Python 執行查詢，並**清洗資料**（移除描述等長文欄位），僅保留狀態、工時、負責人。
    *   **Phase 3 (Insight):** AI 讀取清洗後的數據，生成管理摘要。*Temperature = 0.5*。

*   **功能 B3：即時甘特圖 (AI-Generated Gantt)**
    *   **前端：** 使用 `Recharts` 或 `d3.js`。
    *   **功能：** 接收後端 JSON，渲染動態甘特圖。
    *   **AI 加值：** 標示「紅色警戒區」（例如：預估工時 < 剩餘時間 的任務）。

---

## 4. 資料庫版控與遷移規格 (Database Migration Spec)

為確保開發紀律與可追溯性，強制執行以下規範：

### 4.1 工具與配置
*   使用 **Alembic** 進行遷移管理。
*   `alembic.ini` 設定：`file_template = %%(slug)s_%%(year)d%%(month)02d%%(day)02d` (或自定義格式)。

### 4.2 命名規範 (Naming Convention)
*   所有遷移腳本檔名必須符合：`{序號}_{日期}_{簡易描述}.py`
    *   **範例：** `001_20231027_init_settings_table.py`
    *   **範例：** `002_20231101_add_watchlist_column.py`

### 4.3 擴充彈性
*   程式碼中禁止寫死 SQL 語法，必須使用 SQLAlchemy ORM 模型。
*   部署時僅需修改環境變數 `DATABASE_URL`，即可從 `sqlite:///./app.db` 無痛切換至 `postgresql://...`。

---

## 5. 交付與部署 (Deployment)

**需求：** 不使用 EXE 打包，採用標準 Web Service 部署。

### 5.1 交付物清單
1.  **Frontend Source:** React + Vite 專案碼。
2.  **Backend Source:** Python FastAPI 專案碼 (含 Alembic 目錄)。
3.  **Docker Compose (選配):** 一鍵啟動前後端服務的設定檔（適用於公司內部伺服器部署）。
4.  **Readme:** 包含 API Key 設定教學與 Alembic 遷移指令說明。

### 5.2 部署環境建議
*   **內部伺服器 (Intranet):** 架設於公司內網，成員透過瀏覽器訪問。
*   **資料儲存:**
    *   **Client:** 瀏覽器 LocalStorage (API Keys)。
    *   **Server:** SQLite 檔案 (初期) 或 Postgres Container (後期) (App Settings)。

---

## 6. 開發路徑 (MVP Roadmap)

採用服務設計思維，分階段驗收。

*   **Phase 1: 驗證輸入 (Week 1-2)**
    *   僅開發 Python Backend + 簡單 Chat UI。
    *   目標：確認成員願意用對話方式記工時。
*   **Phase 2: 戰情室基礎 (Week 3-4)**
    *   開發 React Dashboard + SQLite 設定儲存。
    *   目標：主管能設定關注清單，並看到基礎圖表。
*   **Phase 3: 完整 AI 分析 (Week 5-6)**
    *   實作三階段查詢優化 (3-Phase Workflow)。
    *   目標：產出高品質的 AI 總結報告與風險預警。