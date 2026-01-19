---
name: count-lines-of-code
description: 計算專案程式碼行數，統計 Python、JavaScript、TypeScript、CSS 和 README.md 檔案的總行數，自動排除 node_modules 目錄
---

# Count Lines of Code Skill

此技能用於計算專案中的程式碼行數，統計以下檔案類型：
- `.py` (Python)
- `.js` (JavaScript)  
- `.ts` (TypeScript)
- `.css` (CSS)
- `README.md` (文件)

自動排除 `node_modules` 目錄以避免計入第三方依賴。

## 使用方式

根據作業系統選擇適當的指令：

### Linux / macOS

```bash
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.css" -o -name "README.md" \) -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/.venv/*" | xargs wc -l
```

### macOS (替代方案，使用 fd)

如果安裝了 `fd` 工具，可使用更簡潔的語法：

```bash
fd -e py -e js -e ts -e css --glob "README.md" --exclude node_modules | xargs wc -l
```

### Windows (PowerShell)

```powershell
Get-ChildItem -Path . -Recurse -Include *.py,*.js,*.ts,*.css,README.md | Where-Object { $_.FullName -notlike "*\node_modules\*" } | ForEach-Object { Get-Content $_.FullName } | Measure-Object -Line
```

#### Windows PowerShell (詳細版本 - 顯示每個檔案行數)

```powershell
$files = Get-ChildItem -Path . -Recurse -Include *.py,*.js,*.ts,*.css,README.md | Where-Object { $_.FullName -notlike "*\node_modules\*" }
$total = 0
foreach ($file in $files) {
    $lines = (Get-Content $file.FullName | Measure-Object -Line).Lines
    Write-Host "$lines`t$($file.FullName)"
    $total += $lines
}
Write-Host "`nTotal: $total lines"
```

### Windows (CMD / Batch)

```cmd
@echo off
setlocal enabledelayedexpansion
set /a total=0
for /r %%f in (*.py *.js *.ts *.css README.md) do (
    echo %%f | findstr /i "node_modules" >nul
    if errorlevel 1 (
        for /f %%a in ('find /c /v "" ^< "%%f"') do (
            set /a total+=%%a
            echo %%a	%%f
        )
    )
)
echo.
echo Total: !total! lines
```

## 輸出範例

```
   45 ./backend/app/main.py
  120 ./backend/app/routers/auth.py
   89 ./frontend/src/App.tsx
  234 ./frontend/src/components/Layout.tsx
   56 ./README.md
  ----
  544 total
```

## 進階選項

### 統計更多檔案類型

如需加入更多檔案類型（例如 `.tsx`, `.jsx`, `.json`），可修改指令：

**Linux / macOS:**
```bash
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.css" -o -name "*.json" -o -name "README.md" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | xargs wc -l
```

**Windows PowerShell:**
```powershell
Get-ChildItem -Path . -Recurse -Include *.py,*.js,*.ts,*.tsx,*.jsx,*.css,*.json,README.md | Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*\.git\*" } | ForEach-Object { Get-Content $_.FullName } | Measure-Object -Line
```

### 排除更多目錄

常見需要排除的目錄：
- `node_modules` - Node.js 依賴
- `.git` - Git 版本控制
- `__pycache__` - Python 快取
- `dist` / `build` - 編譯輸出
- `venv` / `.venv` - Python 虛擬環境

**Linux / macOS:**
```bash
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.css" -o -name "README.md" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/__pycache__/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.venv/*" \
  | xargs wc -l
```

**Windows PowerShell:**
```powershell
$excludePatterns = @("*\node_modules\*", "*\.git\*", "*\__pycache__\*", "*\dist\*", "*\build\*", "*\.venv\*")
Get-ChildItem -Path . -Recurse -Include *.py,*.js,*.ts,*.css,README.md | Where-Object { 
    $path = $_.FullName
    -not ($excludePatterns | Where-Object { $path -like $_ })
} | ForEach-Object { Get-Content $_.FullName } | Measure-Object -Line
```

## 使用工具替代方案

如果專案需要更詳細的程式碼統計，建議使用專業工具：

### cloc (Count Lines of Code)

```bash
# 安裝
# Linux: sudo apt install cloc
# macOS: brew install cloc  
# Windows: choco install cloc

# 使用
cloc . --exclude-dir=node_modules
```

### tokei

```bash
# 安裝
# cargo install tokei
# 或 brew install tokei

# 使用
tokei . --exclude node_modules
```

這些工具能提供更詳細的統計，包含程式碼行數、註解行數、空白行數等。
