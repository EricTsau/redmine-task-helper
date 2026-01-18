# 專案背景 (Project Context)

## 目標 (Purpose)
**Redmine Task Helper** 是一個針對 2026 年現代化辦公需求設計的 Redmine 伴侶網頁應用。
**願景**：將 Redmine 從單純的「填報工具」轉變為「智慧助手」(High Value, Low Friction)。
**核心理念**：極小化使用者在工時追蹤與狀態更新上的阻力，同時最大化視覺回饋與操作滿足感。

## 技術堆疊 (Tech Stack)
- **前端**：React 19 (Vite), Tailwind CSS, Shadcn UI, Lucide Icons。
- **後端**：FastAPI (Python 3.12+, Async), Pydantic。
- **資料庫**：SQLite (本地配置、緩存、未同步快照) 搭配 SQLModel (SQLAlchemy wrapper)。
- **運行環境**：Docker / Python 3.12+。
- **AI 整合**：OpenAI API (或兼容介面) 用於內容優化。

## 專案慣例 (Project Conventions)

### 程式碼風格 (Code Style)
- **Python**：嚴格遵循 PEP8。I/O 操作優先使用 `async/await`。強制使用 Type Hints。
- **React**：使用 Functional Components 與 Hooks。嚴格使用 TypeScript (React 19 標準)。
- **UI/UX**：
    - **毛玻璃效果 (Glassmorphism)**：現代透明感設計。
    - **深色模式 (Dark Mode)**：自動隨系統切換。

### 架構模式 (Architecture Patterns)
- **混合狀態 (Hybrid State)**：採用本地 SQLite 緩存「智慧計時器」狀態，防止瀏覽器關閉導致資料遺失。
- **API First**：前端僅透過 FastAPI 端點通訊；後端負責所有 Redmine API 請求 (安全性：API Key 僅存在後端)。
- **變更管理**：嚴格遵循 **OpenSpec** 工作流 (`openspec/changes/`)。

### 測試策略 (Testing Strategy)
- **後端**：Pytest (針對 API 端點與邏輯)。
- **前端**：Vitest / React Testing Library。
- **驗證**：所有變更必須依據 OpenSpec 任務中的成功標準 (Success Criteria) 進行驗證。

### Git 工作流 (Git Workflow)
- **分支**：功能分支需關聯 OpenSpec Change ID (例如 `feature/add-auth-module`)。
- **提交信息**：使用語意化提交 (Semantic Commits)。
- **文檔**：隨架構演進同步更新 `openspec/project.md` 與 `spec.md`。

## 領域背景 (Domain Context)
- **Redmine**：上游資料源，靈活的專案管理系統。
- **工時追蹤 (Time Tracking)**：核心領域。概念包含：`Spent Time` (耗時), `Estimated Hours` (預估), `Activity` (活動)。
- **任務管理**：概念包含：`Issues` (議題), `Status` (狀態), `Trackers` (追蹤標籤), `Notes` (註釋)。

## 重要限制 (Important Constraints)
- **安全性**：使用者的 Redmine API Key 絕對不可暴露於前端。
- **UX**：「Focus Mode (聚焦模式)」必須保持無干擾。
- **持久性**：計時器必須能在瀏覽器重啟後存活 (依賴後端計時與校準)。
- **效能**：針對 AI 重寫與 API 代理處理需具備高併發能力。

## 外部依賴 (External Dependencies)
- **Redmine API**：透過 `python-redmine` 介接。
- **AI 服務**：OpenAI Python SDK (httpx)。
