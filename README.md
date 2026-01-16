# Redmine Flow

時間追蹤與任務管理工具，專為 Redmine 使用者設計。

## 功能特色

### Stage 1: MVP 核心
- ⏱️ **計時器** - 開始/停止/繼續計時，即時顯示經過時間
- 📋 **儀表板** - 專注模式顯示當前任務，任務清單快速開始計時
- ⚙️ **設定** - Redmine URL 和 API Key 配置

### Stage 2: 效率提升
- ✨ **AI 文字重寫** - OpenAI 驅動的文字改寫 (專業/休閒/正式/簡潔)
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
# 設定環境變數
export OPENAI_API_KEY=your_key_here

# 啟動
docker-compose up --build
```

訪問:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API 文檔: http://localhost:8000/docs

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

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 金鑰 (AI 重寫功能需要) | - |
| `OPENAI_BASE_URL` | OpenAI API 端點 | `https://api.openai.com/v1` |

## 授權

MIT License
