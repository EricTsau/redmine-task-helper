<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

### Note:
- 請一律用繁體中文回答跟撰寫說明
- 工作完成後要Review README.md確認是否需要更新，要的話請調整
- 資料庫版控與遷移規格 (Database Migration Spec)
    - 為確保開發紀律與可追溯性，強制執行以下規範：
    - 4.1 工具與配置
        • 使用 Alembic 進行遷移管理。
        • alembic.ini 設定：file_template = %%(slug)s_%%(year)d%%(month)02d%%(day)02d (或自定義格式)。
    - 4.2 命名規範 (Naming Convention)
        • 所有遷移腳本檔名必須符合：{序號}_{日期時間}_{簡易描述}.py
            • 範例： 001_20231027123456_init_settings_table.py
            • 範例： 002_20231101123456_add_watchlist_column.py
- UI 訊息顯示規範 (Toast Notification Spec)
    - 禁止使用 `alert()` 或 `confirm()` 等瀏覽器彈窗，可用modern window或toast取代
    - 使用 Toast 通知，都顯示在右上角，且四周有原角
    - 顏色規範：
        • Error (錯誤): 紅色底色 (`bg-red-500`)
        • Warning (警告): 黃色底色 (`bg-yellow-500`)
        • Success (成功/其他): 綠色底色 (`bg-green-500`)
    - 使用 `useToast()` hook: `showSuccess()`, `showWarning()`, `showError()`