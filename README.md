# Redmine Flow

時間追蹤與任務管理工具，專為 Redmine 使用者設計。

## 功能特色

### Stage 1: MVP 核心
- ⏱️ **計時器** - 開始/停止/繼續計時，即時顯示經過時間
- 📋 **儀表板** - 專注模式顯示當前任務，任務清單快速開始計時
- ➕ **任務建立** - 快速建立 Redmine 任務，支援豐富文字編輯與預覽
- ⚙️ **設定** - Redmine 和 OpenAI 設定 (URL, Token, Model)

### Stage 2: 效率提升
- ✨ **AI 文字重寫** - OpenAI 驅動的文字改寫 (專業/休閒/正式/簡潔)
- 📝 **Markdown 編輯器** - 支援 GFM 表格、標題樣式、圖片貼上與預覽
- 🪟 **浮動計時器** - 全域浮動視窗，隨時掌握計時狀態
- 📎 **圖片貼上上傳** - 直接貼上圖片上傳到 Redmine Issue
- 🔍 **Cmd+K 導航** - 全局命令面板快速導航

### Stage 3: 智慧部署
- 🛡️ **忘記保護** - 計時超過 4 小時自動停止
- 📡 **離線佇列** - 斷線時請求暫存，恢復後自動重試
- 🔔 **通知** - 瀏覽器通知支援
- 🐳 **Docker** - 一鍵部署
- 📱 **PWA** - 可安裝為桌面應用

## 快速開始

### 開發環境

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### 生產環境 (Docker)

```bash
docker-compose up --build
```

訪問:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API 文檔: http://localhost:8000/docs

## 設定

啟動後，前往 **Settings** 頁面配置：

| 設定 | 說明 |
|------|------|
| Redmine URL | 你的 Redmine 伺服器位址 |
| Redmine Token | API 存取金鑰 (/my/account) |
| OpenAI URL | API 端點 (預設: api.openai.com) |
| OpenAI Key | API 金鑰 |
| OpenAI Model | 模型名稱 (預設: gpt-4o-mini) |

> 💡 所有設定儲存在本地資料庫，無需環境變數

## 技術棧

| 類型 | 技術 |
|------|------|
| Backend | FastAPI, SQLModel, SQLite |
| Frontend | React 19, Vite, TypeScript |
| 樣式 | Tailwind CSS, Shadcn UI |
| 測試 | Pytest, Vitest |
| 部署 | Docker, Nginx |

## 測試

```bash
# Backend
cd backend && pytest tests/

# Frontend
cd frontend && npm run test
```

## 授權

MIT License
