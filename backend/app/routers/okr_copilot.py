"""
OKR Copilot 路由
提供策略報告生成與多格式輸出功能
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import os
import subprocess
import tempfile
import shutil

from app.database import get_session
from app.dependencies import get_current_user, get_redmine_service, get_openai_service
from app.models import User, UserSettings, AIWorkSummarySettings, GitLabInstance, GitLabWatchlist
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.services.gitlab_service import GitLabService

router = APIRouter(tags=["okr-copilot"])


# ============ Request/Response Models ============

class PreviewRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD


class ImageInfo(BaseModel):
    url: str
    caption: Optional[str] = None
    issue_id: Optional[int] = None


class DataPreviewResponse(BaseModel):
    completed_issues: int
    in_progress_issues: int  # 新增：進行中的 issues
    gitlab_commits: int
    gitlab_releases: int
    available_images: List[ImageInfo]


class GenerateRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    format: str      # "pptx", "pdf", "docx", "md"
    selected_images: List[str] = []


class GenerateResponse(BaseModel):
    download_url: Optional[str] = None
    markdown: Optional[str] = None
    ai_analysis: Optional[Dict[str, Any]] = None  # AI 分析結果


# ============ Helper Functions ============

def get_gitlab_instances(session: Session, user: User) -> List[GitLabInstance]:
    """取得使用者的 GitLab 實例"""
    return session.exec(
        select(GitLabInstance).where(GitLabInstance.owner_id == user.id)
    ).all()


def get_gitlab_watchlist(session: Session, user: User) -> List[GitLabWatchlist]:
    """取得使用者的 GitLab 關注專案"""
    return session.exec(
        select(GitLabWatchlist)
        .where(GitLabWatchlist.owner_id == user.id)
        .where(GitLabWatchlist.is_included == True)
    ).all()


async def fetch_gitlab_data(
    session: Session, 
    user: User, 
    start_date: datetime, 
    end_date: datetime
) -> Dict[str, Any]:
    """取得 GitLab 資料"""
    instances = get_gitlab_instances(session, user)
    watchlist = get_gitlab_watchlist(session, user)
    
    total_commits = 0
    total_releases = 0
    
    for instance in instances:
        service = GitLabService(instance)
        
        # 取得此實例的關注專案
        instance_projects = [w for w in watchlist if w.instance_id == instance.id]
        
        for project in instance_projects:
            try:
                # 使用 gitlab_project_id 而非 project_id
                commits = await service.get_commits(
                    project.gitlab_project_id, 
                    start_date, 
                    end_date
                )
                total_commits += len(commits)
                
                # GitLab releases 通常需要另外的 API 呼叫
                # 這裡簡化處理，使用 tags 或 releases endpoint
            except Exception as e:
                print(f"Error fetching GitLab data for project {project.gitlab_project_id}: {e}")
    
    return {
        "commits": total_commits,
        "releases": total_releases
    }


async def fetch_redmine_data(
    redmine: RedmineService,
    session: Session,
    user: User,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """取得 Redmine 資料 (已完成 + 進行中)"""
    # 取得 AI Summary 設定中的專案和人員
    settings = session.exec(
        select(AIWorkSummarySettings).where(AIWorkSummarySettings.owner_id == user.id)
    ).first()
    
    project_ids = []
    user_ids = []
    
    if settings:
        try:
            project_ids = json.loads(settings.target_project_ids)
            user_ids = json.loads(settings.target_user_ids)
        except:
            pass
    
    completed_issues = 0
    in_progress_issues = 0
    images = []
    issue_list = []
    
    # Get Redmine URL from settings for relative image resolution
    user_settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == user.id)
    ).first()
    redmine_url = user_settings.redmine_url.rstrip('/') if user_settings and user_settings.redmine_url else ""

    for project_id in project_ids:
        try:
            # 1. 取得專案在時間區間內關閉的 issues
            closed_issues = redmine.search_issues_advanced(
                project_id=project_id,
                status="closed",
                updated_after=start_date,
                updated_before=end_date,
                include=["journals", "attachments"],
                limit=100
            )
            completed_issues += len(closed_issues)
            issue_list.extend(closed_issues)
            
            # 2. 取得專案在時間區間內更新過的進行中 issues
            open_issues = redmine.search_issues_advanced(
                project_id=project_id,
                status="open",
                updated_after=start_date,
                updated_before=end_date,
                include=["journals", "attachments"],
                limit=100
            )
            in_progress_issues += len(open_issues)
            issue_list.extend(open_issues)
            
        except Exception as e:
            print(f"Error fetching Redmine issues for project {project_id}: {e}")
    
    # 從 issues 的 notes 中提取圖片
    import re
    for issue in issue_list:
        try:
            # Redmine issue 是物件，使用 .id 屬性
            issue_id = getattr(issue, 'id', 0) if hasattr(issue, 'id') else issue.get('id', 0) if isinstance(issue, dict) else 0
            if not issue_id:
                continue
            
            # 建立 issue attachments 對照表 (filename -> content_url)
            attachments_map = {}
            if hasattr(issue, 'attachments'):
                for attachment in issue.attachments:
                    filename = getattr(attachment, 'filename', '')
                    content_url = getattr(attachment, 'content_url', '')
                    if filename and content_url:
                        attachments_map[filename] = content_url
            
            # 直接使用 issue.journals (因已透過 include 載入) 或是如果 unavailable 則 fallback
            journals = getattr(issue, 'journals', [])
            # 若 issue 物件中無 journals，嘗試重新獲取 (Backward Compatibility)
            if not journals: 
                try:
                    journals = redmine.get_issue_journals(issue_id)
                except:
                    pass

            for journal in journals:
                notes = journal.get("notes", "") if isinstance(journal, dict) else getattr(journal, 'notes', '')
                if notes:
                    # 提取 Markdown 圖片語法和 HTML img 標籤
                    img_pattern = r'!\[([^\]]*)\]\(([^)]+)\)|<img[^>]+src=["\']([^"\']+)["\']'
                    matches = re.findall(img_pattern, notes)
                    for match in matches:
                        url = match[1] or match[2]
                        if url:
                            # URL Resolution Logic
                            if not url.startswith(('http://', 'https://')):
                                # 1. Try finding in attachments (Redmine often references by filename)
                                if url in attachments_map:
                                    url = attachments_map[url]
                                # 2. If valid Redmine URL exists, treat as relative path
                                elif redmine_url:
                                    clean_url = url.lstrip('/')
                                    url = f"{redmine_url}/{clean_url}"
                            
                            images.append({
                                "url": url,
                                "caption": match[0] or f"Issue #{issue_id}",
                                "issue_id": issue_id
                            })
        except Exception as e:
            print(f"Error extracting images from issue: {e}")
    
    return {
        "completed_issues": completed_issues,
        "in_progress_issues": in_progress_issues,
        "images": images
    }


# ============ AI 分析函數 ============

async def analyze_kr_status(
    openai: OpenAIService,
    completed_issues: int,
    gitlab_commits: int,
    gitlab_releases: int,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """
    4.1 AI 紅綠燈判斷 - 分析 KR 狀態
    返回: {"status": "green"/"yellow"/"red", "reason": "說明"}
    """
    prompt = f"""你是一個 OKR 分析專家。請根據以下數據評估團隊的進度狀態。

報告區間: {start_date} ~ {end_date}
已完成 Issues: {completed_issues}
GitLab Commits: {gitlab_commits}
GitLab Releases: {gitlab_releases}

請用 JSON 格式回覆，包含:
- status: "green"(進度良好)、"yellow"(需注意)、"red"(進度落後)
- reason: 簡短說明判斷理由 (中文，50字內)
- suggestions: 改善建議陣列 (中文，最多3條)

只輸出 JSON，不要其他文字。
"""
    
    try:
        response = await openai.chat_completion([
            {"role": "system", "content": "你是一個 OKR 分析專家，請用 JSON 格式回覆。"},
            {"role": "user", "content": prompt}
        ], temperature=0.3)
        
        # 解析 JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"KR status analysis error: {e}")
    
    # 預設回傳
    return {"status": "yellow", "reason": "無法分析", "suggestions": []}


async def generate_code_contribution_summary(
    openai: OpenAIService,
    gitlab_commits: int,
    gitlab_releases: int,
    start_date: str,
    end_date: str
) -> str:
    """
    4.2 代碼貢獻摘要 - Release Impact 分析
    """
    if gitlab_commits == 0 and gitlab_releases == 0:
        return "本期間無代碼變更活動。"
    
    prompt = f"""請根據以下 GitLab 活動數據，撰寫一段簡潔的代碼貢獻摘要，說明這些變更對業務的影響。

報告區間: {start_date} ~ {end_date}
GitLab Commits: {gitlab_commits}
GitLab Releases: {gitlab_releases}

請用 2-3 句話總結，用中文回答，重點在於業務價值和技術成果。
"""
    
    try:
        response = await openai.chat_completion([
            {"role": "system", "content": "你是一個技術總監，擅長將技術工作轉化為業務價值說明。"},
            {"role": "user", "content": prompt}
        ], temperature=0.5)
        return response.strip()
    except Exception as e:
        print(f"Code contribution summary error: {e}")
    
    return f"本期間共有 {gitlab_commits} 次提交和 {gitlab_releases} 個版本發布。"


async def generate_next_steps(
    openai: OpenAIService,
    completed_issues: int,
    gitlab_commits: int,
    kr_status: Dict[str, Any]
) -> List[str]:
    """
    4.3 下週計畫自動補完 - Next Step Generation
    """
    status_text = {
        "green": "進度良好",
        "yellow": "需要注意",
        "red": "進度落後"
    }.get(kr_status.get("status", "yellow"), "未知")
    
    prompt = f"""根據以下團隊狀態，請建議 3-5 條下週的工作計畫。

當前狀態: {status_text}
已完成 Issues: {completed_issues}本期間 Commits: {gitlab_commits}
分析理由: {kr_status.get('reason', '')}

請用 JSON 陣列格式回覆，每條建議是一個字串，用中文。
只輸出 JSON 陣列，不要其他文字。
"""
    
    try:
        response = await openai.chat_completion([
            {"role": "system", "content": "你是一個專案經理，請用 JSON 陣列格式回覆工作建議。"},
            {"role": "user", "content": prompt}
        ], temperature=0.6)
        
        # 解析 JSON 陣列
        import re
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Next steps generation error: {e}")
    
    # 預設回傳
    return ["繼續清除待處理的 Issues", "針對關鍵功能進行測試", "準備下一次發布"]


def generate_marp_markdown(
    start_date: str,
    end_date: str,
    completed_issues: int,
    gitlab_commits: int,
    gitlab_releases: int,
    selected_images: List[str],
    kr_status: Optional[Dict[str, Any]] = None,
    code_summary: Optional[str] = None,
    next_steps: Optional[List[str]] = None,
    completed_issue_list: Optional[List[Dict[str, Any]]] = None
) -> str:
    """生成 Marp 格式的 Markdown (含 AI 分析)"""
    
    # 狀態圖示
    status_icons = {
        "green": "🟢",
        "yellow": "🟡", 
        "red": "🔴"
    }
    status = kr_status.get("status", "yellow") if kr_status else "yellow"
    status_icon = status_icons.get(status, "🟡")
    status_text = {
        "green": "進度良好",
        "yellow": "需要注意",
        "red": "進度落後"
    }.get(status, "需要注意")
    
    slides = [
        f"""---
marp: true
theme: uncover
class: invert
paginate: true
---

# OKR 成果匯報
### 報告區間: {start_date} ~ {end_date}

---

## 📊 成果摘要

| 指標 | 數量 |
|------|------|
| 已完成 Issues | {completed_issues} |
| GitLab Commits | {gitlab_commits} |
| GitLab Releases | {gitlab_releases} |

"""
    ]

    # 添加詳細工作列表 (如果有)
    if completed_issue_list:
        # 取前 10 筆或根據需求調整
        top_issues = completed_issue_list[:10]
        
        # 建構表格 rows
        table_rows = []
        for issue in top_issues:
            subject = issue.get('subject', 'N/A')
            # 截斷過長標題
            if len(subject) > 30:
                subject = subject[:28] + "..."
            
            status_name = issue.get('status', {}).get('name', 'Done') if isinstance(issue.get('status'), dict) else issue.get('status', 'Done')
            
            # 嘗試取得描述或最後筆記作為簡述 (這裡假設 issue 結構可能有 description 或 notes)
            # 為了簡化，我們先只顯示標題和狀態
            table_rows.append(f"| {status_name} | {subject} |")

        rows_md = "\n".join(table_rows)
        
        slides.append(f"""---

## ✅ 已完成工作詳情 (Top 10)

| 狀態 | 主題 |
|------|------|
{rows_md}

""")

    slides.append(f"""---

## {status_icon} 進度狀態: {status_text}

{kr_status.get('reason', '') if kr_status else ''}

""")
    
    # 添加建議頁面
    if kr_status and kr_status.get('suggestions'):
        suggestions_text = "\n".join([f"- {s}" for s in kr_status['suggestions'][:3]])
        slides.append(f"""---

## 💡 改善建議

{suggestions_text}

""")
    
    # 添加代碼貢獻摘要
    if code_summary:
        slides.append(f"""---

## 🚀 技術成果

{code_summary}

""")
    
    # 添加下週計畫
    if next_steps:
        steps_text = "\n".join([f"- {s}" for s in next_steps[:5]])
        slides.append(f"""---

## 📋 下週計畫

{steps_text}

""")
    
    # 添加選中的圖片作為證據頁
    for i, img_url in enumerate(selected_images[:5]):  # 最多 5 張圖片
        slides.append(f"""---

## 🖼️ 成果展示 {i + 1}

![width:800px]({img_url})

""")
    
    slides.append("""---

# 謝謝觀看

*由 OKR Copilot 自動生成*
""")
    
    return "\n".join(slides)


# ============ API Endpoints ============

@router.post("/api/okr-copilot/preview", response_model=DataPreviewResponse)
async def preview_data(
    request: PreviewRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service)
):
    """預覽區間內的資料統計"""
    try:
        start_dt = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(request.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # 取得 Redmine 資料
    redmine_data = await fetch_redmine_data(
        redmine, session, current_user, 
        request.start_date, request.end_date
    )
    
    # 取得 GitLab 資料
    gitlab_data = await fetch_gitlab_data(session, current_user, start_dt, end_dt)
    
    return DataPreviewResponse(
        completed_issues=redmine_data["completed_issues"],
        in_progress_issues=redmine_data["in_progress_issues"],
        gitlab_commits=gitlab_data["commits"],
        gitlab_releases=gitlab_data["releases"],
        available_images=[ImageInfo(**img) for img in redmine_data["images"]]
    )


@router.post("/api/okr-copilot/generate", response_model=GenerateResponse)
async def generate_report(
    request: GenerateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    redmine: RedmineService = Depends(get_redmine_service),
    openai: OpenAIService = Depends(get_openai_service)
):
    """生成報告 (含 AI 分析)"""
    try:
        start_dt = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(request.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # 取得資料
    redmine_data = await fetch_redmine_data(
        redmine, session, current_user,
        request.start_date, request.end_date
    )
    gitlab_data = await fetch_gitlab_data(session, current_user, start_dt, end_dt)
    
    completed_issues = redmine_data["completed_issues"]
    gitlab_commits = gitlab_data["commits"]
    gitlab_releases = gitlab_data["releases"]
    
    # AI 分析 (Phase 4.1-4.3)
    kr_status = None
    code_summary = None
    next_steps = None
    
    try:
        # 4.1 紅綠燈判斷
        kr_status = await analyze_kr_status(
            openai, completed_issues, gitlab_commits, gitlab_releases,
            request.start_date, request.end_date
        )
        
        # 4.2 代碼貢獻摘要
        code_summary = await generate_code_contribution_summary(
            openai, gitlab_commits, gitlab_releases,
            request.start_date, request.end_date
        )
        
        # 4.3 下週計畫
        next_steps = await generate_next_steps(
            openai, completed_issues, gitlab_commits, kr_status
        )
    except Exception as e:
        print(f"AI analysis error (non-fatal): {e}")
        # AI 分析失敗不影響報告生成
    
    # 生成 Marp Markdown (含 AI 分析結果)
    markdown = generate_marp_markdown(
        request.start_date,
        request.end_date,
        completed_issues,
        gitlab_commits,
        gitlab_releases,
        request.selected_images,
        kr_status=kr_status,
        code_summary=code_summary,
        next_steps=next_steps,
        completed_issue_list=completed_issues # Pass the list directly as it is already a list of dicts/objects from fetch_redmine_data
    )
    
    # 構建 AI 分析結果
    ai_analysis = {
        "kr_status": kr_status,
        "code_summary": code_summary,
        "next_steps": next_steps
    } if any([kr_status, code_summary, next_steps]) else None
    
    # 如果只需要 Markdown，直接返回
    if request.format == "md":
        return GenerateResponse(markdown=markdown, ai_analysis=ai_analysis)
    
    # 其他格式需要使用 Marp CLI 或 Pandoc 轉換
    try:
        # 建立暫存目錄
        temp_dir = tempfile.mkdtemp()
        md_path = os.path.join(temp_dir, "report.md")
        
        # 寫入 Markdown
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        
        output_path = None
        
        if request.format == "pptx":
            output_path = os.path.join(temp_dir, "report.pptx")
            # 使用 Marp CLI 轉換
            result = subprocess.run(
                ["npx", "@marp-team/marp-cli", md_path, "--pptx", "-o", output_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode != 0:
                print(f"Marp error: {result.stderr}")
                # 如果 Marp 失敗，返回 Markdown
                return GenerateResponse(markdown=markdown)
                
        elif request.format == "pdf":
            output_path = os.path.join(temp_dir, "report.pdf")
            result = subprocess.run(
                ["npx", "@marp-team/marp-cli", md_path, "--pdf", "-o", output_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode != 0:
                print(f"Marp error: {result.stderr}")
                return GenerateResponse(markdown=markdown)
                
        elif request.format == "docx":
            output_path = os.path.join(temp_dir, "report.docx")
            # 使用 Pandoc 轉換
            result = subprocess.run(
                ["pandoc", md_path, "-o", output_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode != 0:
                print(f"Pandoc error: {result.stderr}")
                return GenerateResponse(markdown=markdown)
        
        if output_path and os.path.exists(output_path):
            # 複製到持久化目錄
            output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "temp_files")
            os.makedirs(output_dir, exist_ok=True)
            
            filename = f"okr_report_{current_user.id}_{int(datetime.now().timestamp())}.{request.format}"
            final_path = os.path.join(output_dir, filename)
            shutil.copy(output_path, final_path)
            
            # 清理暫存目錄
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            return GenerateResponse(download_url=f"/api/okr-copilot/download/{filename}")
        
        # 清理
        shutil.rmtree(temp_dir, ignore_errors=True)
        
    except subprocess.TimeoutExpired:
        print("Conversion timeout")
    except FileNotFoundError as e:
        print(f"Tool not found: {e}")
    except Exception as e:
        print(f"Conversion error: {e}")
    
    # 預設返回 Markdown
    return GenerateResponse(markdown=markdown)


@router.get("/api/okr-copilot/download/{filename}")
async def download_report(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """下載生成的報告"""
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "temp_files")
    file_path = os.path.join(output_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # 安全檢查：確保檔案名稱包含使用者 ID
    if f"_{current_user.id}_" not in filename:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 根據副檔名設定 content type
    content_types = {
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "md": "text/markdown"
    }
    
    ext = filename.split(".")[-1]
    media_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename
    )
