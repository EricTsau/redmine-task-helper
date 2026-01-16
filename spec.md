這是一份針對 2026 年現代化辦公需求設計的 **Redmine Flow 網頁版完整規格書**。本設計核心在於「**極簡操作（Low Friction）**」與「**高回饋感（High Value）**」，讓成員感覺是在使用一個「聰明的助手」而非「填報工具」。

---

Redmine Flow：智慧工時與任務管理系統 (Web 版)

1. 系統架構 (System Architecture)

- **前端：** React 19 + Vite (高速開發與打包) + Tailwind CSS (美化)。
- **UI 組件：** Shadcn UI (現代感、乾淨、支援深藍色模式)。
- **後端：** FastAPI (Python 3.12+) - 高併發、非同步處理 AI 與 API。
- **資料庫：** SQLite (儲存本地配置、最愛任務、未同步的計時快照)。
- **部署：** 支援 Docker 一鍵部署或單機 Python 執行。

---

2. 核心功能規格 (Detailed Features)

A. 極簡化工作台 (The Dashboard)

- **「Focus Mode」聚焦視窗：**
    - 頁面中央只顯示「目前正在進行」的一個任務，並伴隨大型動態計時器。
    - 顯示該任務的剩餘預估工時與進度條。
- **快速任務導航：**
    - **全域搜尋 (Cmd+K / Ctrl+K)：** 模仿 Raycast 介面，輸入編號或關鍵字瞬間切換任務。
    - **最愛列表：** 側邊欄固定顯示「常用任務」，點擊即可將計時器切換至該 Task。
- **指派清單：** 自動過濾並顯示「指派給我」且狀態為「執行中」的列表。

B. AI 驅動的報告系統 (AI-Assisted Logging)

- **口語轉專業 (Rewrite)：**
    - 成員在 `Notes` 欄位輸入：「修好了登入頁面的閃退 bug，改了 auth.py」。
    - 點擊 **[AI 魔法棒]**，自動轉化為：「1. 修正登入模組異常崩潰問題 2. 優化 auth.py 驗證邏輯 3. 完成單元測試」。
- **截圖即上傳：**
    - 支援直接在編輯區 `Ctrl+V`。
    - 系統自動將圖片上傳至 Redmine 附件，並在文字框生成 `!image.png!` 的 Markdown 語法。

C. 智慧工時紀錄 (Smart Timer)

- **後端計時機制：** 計時邏輯存在於 FastAPI。即便關閉瀏覽器，再次開啟時，秒數會自動從後端校準。
- **防忘記關閉 (Forget-Safe)：**
    - **強制停止：** 達到預設上限（如 4 小時）自動停止，並發送 Browser Notification。
    - **閒置提醒：** 若電腦偵測到長時間無動作（選配功能，需 PWA 權限），彈窗詢問是否還在工作。
- **自動同步：** 停止計時後，跳出「今日成就總結」視窗，確認後一次性寫回 Redmine 的 `Spent Time` 與 `Notes`。

---

3. 使用者體驗 (UX) 與美觀設計

- **毛玻璃效果 (Glassmorphism)：** 使用現代透明感 UI，降低工作的枯燥感。
- **自動切換深色模式：** 隨系統設定自動切換 Dark/Light Mode。
- **狀態燈號：**
    - 🟢 正在計時：分頁標題動態顯示 `(01:22:10) Task#123`。
    - 🟡 暫停中。
    - 🔴 強制停止提醒。

---

4. 資料安全與整合

- **API 金鑰管理：** 使用者 API Key 儲存在後端資料庫，傳輸過程加密，不暴露於前端代碼中。
- **OpenAI 格式相容：** 可串接 ChatGPT、Claude 或企業內部的 Local LLM (如 Ollama / vLLM)。

---

5. 實施開發進度 (Roadmap)

第一階段：MVP 骨幹 (Week 1-2)

1. **FastAPI 核心：** 實作 Redmine 登入驗證、任務列表 API。
2. **React 基礎介面：** 實作側邊欄、任務卡片、基礎計時按鈕。
3. **後端計時器：** 實作 SQLite 儲存計時狀態，支援重啟網頁不丟失秒數。

第二階段：效率增強 (Week 3)

1. **AI 整合：** 串接 OpenAI API 實作文字優化。
2. **圖片上傳：** 實作剪貼簿監聽與 Redmine 附件上傳。
3. **全域搜尋：** 實作快捷鍵喚起搜尋介面。

第三階段：智慧化與部署 (Week 4)

1. **強制停止機制：** 實作背景檢查任務與瀏覽器通知。
2. **PWA 封裝：** 讓網頁可以被「安裝」在桌面上當作獨立軟體。
3. **Docker 化：** 提供 `docker-compose.yml` 方便公司內部架設。

---

6. 技術規格總結 (For Developers)

|項目|技術|
|---|---|
|**前端框架**|React 19 (Vite)|
|**後端框架**|FastAPI (Async)|
|**樣式解決方案**|Tailwind CSS + Lucide Icons|
|**資料庫**|SQLite + SQLModel (SQLAlchemy 封裝)|
|**Redmine 串接**|`python-redmine` 庫|
|**AI 串接**|`openai` Python SDK (httpx)|
|**通知系統**|Web Notification API + FastAPI Background Tasks|
