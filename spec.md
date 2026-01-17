**「模組 C：AI 專案經理助手 (AI PM Copilot)」**。以下是針對您提出的 **Sidebar 對話、Redmine 整合、互動式甘特圖、以及假日設定** 四大需求的詳細技術規格設計：

新增規格模組：AI 專案經理助手 (AI PM Copilot)

1. 功能 C1：Sidebar 專屬 AI PRD 對話視窗 (AI PRD Chat)

這將是專案啟動的入口，位於 React 側邊欄，提供持續性的對話環境。

• **互動流程設計：**

    1. **Sidebar 入口**：新增「AI 專案規劃」選單。

    2. **Context 鎖定**：主管選擇特定的 Redmine 專案後，AI 會自動載入該專案的背景資訊（如成員名單、現有相關 Issue）作為 Context。

    3. **對話定義 PRD**：

        ▪ 主管輸入：「我們要開發一個新登入頁面，需要兩週，包含 UI 設計和後端 API。」

        ▪ **Backend (Python) 處理**：呼叫 OpenAI API，Prompt 設定為：「你是一位資深 PM，請根據對話內容協助使用者釐清 PRD，並將需求拆解為具體的 Task List (JSON 格式)，包含 `subject` (任務名), `estimated_hours` (預估工時), `start_date` (開始日), `due_date` (結束日), `predecessors` (依賴任務)」,。

    4. **輸出至 Redmine**：

        ▪ 當主管確認內容後，點擊「生成並儲存」。

        ▪ 系統將完整的 PRD 對話紀錄整理成一篇 Note，寫入 Redmine 的 **Parent Task** (主任務) 中。

        ▪ AI 拆解出的 Task List 則自動轉為該 Parent Task 下的 **Sub-tasks (子任務)**，這樣之後重新登入 Redmine 或網頁都能看到並持續追蹤,。

2. 功能 C2：互動式甘特圖編輯器 (Interactive AI Gantt)

文獻中提到的甘特圖主要用於「視覺化」，但您的需求進階到了「編輯與排程」，這需要前端 React 進行較複雜的狀態管理。

• **資料來源 (Data Flow)**：

    ◦ **Step 1 (AI 生成)**：由 C1 對話產生的 JSON 直接渲染成甘特圖初稿。

    ◦ **Step 2 (互動編輯)**：使用 React 甘特圖套件 (如 `dhtmlxGantt`，實作以下功能：

        ▪ **拖拉時長 (Duration)**：滑鼠拖曳任務條邊緣，自動更新 `estimated_hours` 與 `due_date`。

        ▪ **調整順序與依賴 (Dependencies)**：透過連線方式建立任務相依性（例如：任務 A 結束 -> 任務 B 開始）。

        ▪ **顏色顯示**：根據任務狀態 (Status) 或優先級 (Priority) 自動填色（如：紅色代表緊急/落後）。

    ◦ **Step 3 (資料回寫)**：所有編輯操作（如延長時間），都會觸發 Python FastAPI 呼叫 Redmine API 更新對應的 Issue 資料，確保下次登入時資料一致。

3. 功能 C3：Admin 後台 - 假日與工時計算邏輯 (Holiday Management)

為了讓甘特圖的時程預估準確，必須排除非工作日。這部分邏輯將在 Python Backend 處理，並由 React Admin 介面設定。 此假日資訊可以給所有使用者共用，所以不需要每個人都設定只要admin

• **假日設定介面**：

    1. **週末開關**：提供 Checkbox 「排除週六」、「排除週日」。若勾選，AI 在計算 `due_date` 時會自動跳過這些日期。

    2. **自定義假日匯入**：

        ▪ **介面**：提供一個文字輸入框或檔案上傳區。

        ▪ **格式說明**：在匯入處顯示提示：「請上傳 .txt 或 .csv 檔案，格式為 `YYYY-MM-DD, 假日名稱`，每行一筆」。

        ▪ **Python 解析邏輯**：FastAPI 接收檔案後，解析日期並存入 SQLite/PostgreSQL 的 `holidays` 表格中,。

• **AI 排程演算法更新**：

    ◦ 當 AI 或主管設定「任務需耗時 3 天」且起始日為週五時，後端演算法會檢查假日設定：

        ▪ 若週六日為假日：結束日期 = 週五 + 3工作天 = 下週二。

        ▪ 若週六日不為假日：結束日期 = 週日。