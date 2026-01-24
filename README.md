# Redmine Task Helper

![License: GPL 2.0](https://img.shields.io/badge/License-GPL_2.0-blue.svg)

**Redmine Task Helper** 是一款專為 Redmine 使用者量身打造的任務管理與效率提升工具。結合現代化的 UI 設計與強大的 AI 輔助功能，讓您的工作流程更加流暢。

---

## 🚀 核心功能

### 🤖 AI PM Copilot (最強專案助手)
- **PRD 生成器**: 透過與 AI 對話，自動產出詳細的需求說明書 (PRD)。
- **WBS 拆解**: 自動將需求拆解為 Redmine 任務，並預估工時與時程。
- **互動式甘特圖**: 拖拉式調整時程，自動處理任務相依性，並排除系統設定的假日。
- **工作總結 (Report)**: 每週自動生成工作報告，支援 Markdown 下載及 Redmine 連結串接。

### ⏱️ 工時追蹤與管理
- **高效計時器**: 支援「暫停/繼續」功能，計時數據自動回寫 Redmine。
- **專注模式 (Focus Mode)**: 簡潔的介面，讓您排除干擾，專注於當前任務。
- **全域導航 (Cmd+K)**: 快速切換功能、搜尋任務或啟動命令。

### 📊 任務看板
- **樹狀結構視圖**: 清晰展示任務與子任務的相依關係。
- **關注清單**: 同時監控多個專案與成員的最新進度。
- **快速操作**: 無需開啟 Redmine，直接在工具內建立任務或更新狀態。

---

## 🛠️ 技術棧

| 類型 | 技術 |
|------|------|
| **Backend** | FastAPI, SQLModel, SQLite, Alembic |
| **Frontend** | React 19, Vite, TypeScript |
| **Styling** | Tailwind CSS, Shadcn UI (現代科技風格) |
| **AI** | OpenAI API, LangChain/LangGraph 整合 |
| **Deployment** | Docker, Docker Compose |

---

## 📦 快速開始

### 開發環境設定

#### 1. 後端 (Backend)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### 2. 前端 (Frontend)
```bash
cd frontend
npm install
npm run dev
```

### Windows 一鍵啟動
根目錄提供常用批次檔：
- `start.bat`: 同時啟動前後端服務。
- `stop.bat`: 停止執行中的進程。

> [!IMPORTANT]
> **首次使用必看**：啟動程式後，請務必先前往 **System Settings (系統設定)** 頁面配置您的 **Redmine URL/Token** 以及 **OpenAI API Key**。若未完成這些設定，AI 規劃、任務同步與計時器等核心功能將無法正常運作。

---

## ⚙️ 設定說明

啟動後，請先至 **System Settings** 完成以下配置：
- **Redmine**: URL 地址與 API Key。
- **OpenAI**: API Key 與選擇模型 (建議使用 `gpt-4o` 或 `gpt-4o-mini`)。
- **假日設定**: 在 Admin 頁面設定排除的週末或特定國定假日。

---

## 📜 詳細規格

更多詳細的設計邏輯與開發規範，請參閱 [SPEC.md](file:///home/eric/projects/redmine-desktop-tool/SPEC.md)。

## 授權

GPL 2.0


