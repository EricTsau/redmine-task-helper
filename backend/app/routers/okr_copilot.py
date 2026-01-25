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
import re
import os
import subprocess
import tempfile
import shutil

from app.database import get_session
from app.dependencies import get_current_user, get_redmine_service, get_openai_service
from app.models import User, UserSettings, AIWorkSummarySettings, GitLabInstance, GitLabWatchlist, OKRReport
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
    format: str      # "pptx", "pdf", "md"
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


def extract_images_from_issue(issue: Dict[str, Any], redmine_url: str = "") -> List[Dict[str, Any]]:
    """
    從 Issue 的 Description 和 Notes 中提取圖片
    支援 Markdown, HTML 和 Redmine Textile 格式
    """
    images = []
    issue_id = issue.get('id', 0)
    if not issue_id:
        return []
    
    # Create issue attachments map (filename -> content_url)
    attachments_map = {a['filename']: a['content_url'] for a in issue.get('attachments', [])}
    
    # Helper to process text for images
    def extract_images_from_text(text, source_type):
        if not text:
            return
        
        # 1. Standard Markdown/HTML images
        # Matches ![alt](url) or ![alt](url "title") or <img src="url">
        md_pattern = r'!\[([^\]]*)\]\(\s*([^\s\)]+)(?:\s+["\'].*?["\'])?\s*\)|<img[^>]+src=["\']([^"\']+)["\']'
        matches = re.findall(md_pattern, text)
        for match in matches:
            url = match[1] or match[2]
            caption = match[0] or f"Issue #{issue_id} {source_type}"
            
            if url:
                # URL resolution
                if not url.startswith(('http://', 'https://')):
                    if url in attachments_map:
                        url = attachments_map[url]
                    elif redmine_url:
                        clean_url = url.lstrip('/')
                        url = f"{redmine_url}/{clean_url}"
                
                images.append({
                    "url": url,
                    "caption": caption,
                    "issue_id": issue_id
                })

        # 2. Redmine Textile syntax: !image.png!, !>image.png!, !{style}image.png!, !image.png(Alt)!
        textile_pattern = r'!([<>=]?)(?:\{[^}]+\})?([^!\(\)\n]+)(?:\(([^)]+)\))?!'
        textile_matches = re.findall(textile_pattern, text)
        
        for align, filename, caption in textile_matches:
            url = None
            # Try to find in attachments
            if filename in attachments_map:
                url = attachments_map[filename]
            elif filename.startswith(('http://', 'https://')):
                url = filename
            elif redmine_url:
                # Fallback: assume it might be a relative path if not in attachments (rare for textile but possible)
                pass
            
            if url:
                images.append({
                    "url": url,
                    "caption": caption or f"Issue #{issue_id} ({filename})",
                    "issue_id": issue_id
                })

    # Check description
    extract_images_from_text(issue.get("description", ""), "Description")
    
    # Check notes
    extract_images_from_text(issue.get("notes", ""), "Note")
    
    return images



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
    
    # Detailed lists for reporting
    completed_issue_list = []
    in_progress_issue_list = []
    
    # Get Redmine URL from settings for relative image resolution
    user_settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == user.id)
    ).first()
    redmine_url = user_settings.redmine_url.rstrip('/') if user_settings and user_settings.redmine_url else ""

    # Iterate through project_ids and user_ids to fetch issues
    # If user_ids is empty, it implies fetching for all users in the project
    # If project_ids is empty, it implies fetching for all projects assigned to user_ids (if any)
    # For simplicity, we'll iterate through project_ids and apply user_ids as a filter if present.
    
    # If no specific projects are configured, try to fetch issues assigned to the user directly
    # This logic might need refinement based on how AIWorkSummarySettings are intended to be used.
    
    # For now, let's assume project_ids are the primary filter.
    # If user_ids are specified, we'll filter by assigned_to.
    
    # Combine project_ids and user_ids for comprehensive search
    # If project_ids is empty, we might need a different strategy (e.g., search all projects user has access to)
    # For now, we'll proceed with the assumption that project_ids will be populated.
    
    # If both project_ids and user_ids are empty, this loop won't run.
    # We need to ensure at least one is present for a meaningful search.
    
    # Let's create a list of (project_id, user_id) tuples to iterate over
    search_params = []
    if not project_ids and not user_ids:
        # Fallback: if no specific settings, try to get issues assigned to the current user
        search_params.append((None, user.id)) # project_id=None means search across projects
    elif not project_ids:
        # If only user_ids are specified, search across all projects for these users
        for uid in user_ids:
            search_params.append((None, uid))
    elif not user_ids:
        # If only project_ids are specified, search all issues in these projects
        for pid in project_ids:
            search_params.append((pid, None))
    else:
        # Both project_ids and user_ids are specified
        for pid in project_ids:
            for uid in user_ids:
                search_params.append((pid, uid))

    # To avoid duplicate issues if a user is in multiple projects, we'll use a set of issue IDs
    processed_issue_ids = set()
    
    for pid, uid in search_params:
        # 1. Fetch Completed Issues (Closed)
        try:
            closed_issues_raw = redmine.search_issues_advanced(
                project_id=pid,
                assigned_to=uid,
                status='closed',
                updated_after=start_date,
                updated_before=end_date,
                limit=100 # increased limit
            )
            for issue in closed_issues_raw:
                if issue.id in processed_issue_ids:
                    continue
                processed_issue_ids.add(issue.id)

                # Fetch detailed info (journals + attachments)
                details = redmine.get_issue_with_journals(issue.id)
                if not details:
                    continue
                    
                issue_dict = {
                     "id": issue.id,
                     "subject": issue.subject,
                     "status": getattr(issue.status, 'name', 'Closed'),
                     "updated_on": str(issue.updated_on),
                     "description": getattr(issue, 'description', ''),
                     "notes": "\n".join([j.get('notes', '') for j in details['journals']]),
                     "journals": details['journals'],
                     "attachments": details.get('attachments', [])
                }
                completed_issue_list.append(issue_dict)
                completed_issues += 1
                
        except Exception as e:
            print(f"Error fetching closed issues for project {pid} and user {uid}: {e}")

        # 2. Fetch In-Progress Issues (Open)
        try:
            open_issues_raw = redmine.search_issues_advanced(
                project_id=pid,
                assigned_to=uid,
                status='open',
                updated_after=start_date, # Active in this period
                limit=100
            )
            for issue in open_issues_raw:
                if issue.id in processed_issue_ids:
                    continue
                processed_issue_ids.add(issue.id)

                # Fetch detailed info
                details = redmine.get_issue_with_journals(issue.id)
                if not details:
                    continue

                issue_dict = {
                     "id": issue.id,
                     "subject": issue.subject,
                     "status": getattr(issue.status, 'name', 'Open'),
                     "updated_on": str(issue.updated_on),
                     "description": getattr(issue, 'description', ''),
                     "notes": "\n".join([j.get('notes', '') for j in details['journals']]),
                     "journals": details['journals'],
                     "attachments": details.get('attachments', [])
                }
                in_progress_issue_list.append(issue_dict)
                in_progress_issues += 1
                
        except Exception as e:
            print(f"Error fetching open issues for project {pid} and user {uid}: {e}")
            
    # Re-implement image extraction based on the fetched detailed lists
    all_fetched_issues = completed_issue_list + in_progress_issue_list
    
    for issue in all_fetched_issues:
        extracted = extract_images_from_issue(issue, redmine_url)
        images.extend(extracted)
    
    return {
        "completed_issues": completed_issues,
        "in_progress_issues": in_progress_issues,
        "images": images,
        "completed_issue_list": completed_issue_list,
        "in_progress_issue_list": in_progress_issue_list
    }


async def summarize_issue_progress(
    openai: OpenAIService,
    issue_list: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    使用 AI 總結每個 Issue 的進度和狀態
    """
    if not issue_list:
        return []

    summarized_list = []
    
    # Process efficiently: we could batch, but for now simple loop is safer for error handling
    # To speed up, we can use asyncio.gather if we refactor, but here we await sequentially or use simple optimization
    
    # Optimization: Only summarize top 20 issues to avoid hitting rate limits or timeouts
    target_issues = issue_list[:20]
    
    for issue in target_issues:
        notes = issue.get('notes', '')
        # Skip if no notes and description is short
        if not notes and len(issue.get('description', '')) < 50:
             issue['ai_summary'] = issue.get('description', '')[:100]
             summarized_list.append(issue)
             continue
             
        prompt = f"""請用一句話簡潔總結這個任務的當前進度狀態。
任務: {issue.get('subject')}
描述: {issue.get('description', '')[:200]}
最近更新筆記:
{notes[:500]}

請用中文回答，類似「完成了初步 UI 設計」或「正在排查 API 連線錯誤」。
"""
        try:
            summary = await openai.chat_completion([
                {"role": "system", "content": "你是一個專案經理助理，負責精簡匯報進度。"},
                {"role": "user", "content": prompt}
            ], temperature=0.3)
            issue['ai_summary'] = summary.strip()
        except Exception as e:
            print(f"Error summarizing issue {issue['id']}: {e}")
            issue['ai_summary'] = issue.get('subject', '')
            
        summarized_list.append(issue)
        
    return summarized_list


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
    completed_issue_list: Optional[List[Dict[str, Any]]] = None,
    in_progress_issue_list: Optional[List[Dict[str, Any]]] = None
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
        # 取前 10 筆
        top_issues = completed_issue_list[:10]
        
        table_rows = []
        for issue in top_issues:
            subject = issue.get('subject', 'N/A')
            if len(subject) > 20:
                subject = subject[:18] + "..."
            
            summary = issue.get('ai_summary', issue.get('notes', '')[:30].replace('\n', ' '))
            if len(summary) > 40:
                summary = summary[:38] + "..."
                
            status_name = issue.get('status', 'Done')
            
            table_rows.append(f"| {status_name} | {subject} | {summary} |")

        rows_md = "\n".join(table_rows)
        
        slides.append(f"""---

## ✅ 已完成工作詳情 (Top 10)

| 狀態 | 主題 | 進度摘要 |
|------|------|----------|
{rows_md}

""")

    # 添加進行中工作列表
    if in_progress_issue_list:
        top_issues = in_progress_issue_list[:10]
        table_rows = []
        for issue in top_issues:
            subject = issue.get('subject', 'N/A')
            if len(subject) > 20:
                subject = subject[:18] + "..."
            
            summary = issue.get('ai_summary', issue.get('notes', '')[:30].replace('\n', ' '))
            if len(summary) > 40:
                summary = summary[:38] + "..."
            
            status_name = issue.get('status', 'In Progress')
            table_rows.append(f"| {status_name} | {subject} | {summary} |")
            
        rows_md = "\n".join(table_rows)
        
        slides.append(f"""---

## 🚧 進行中工作詳情 (Top 10)

| 狀態 | 主題 | 進度摘要 |
|------|------|----------|
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


@router.get("/api/okr-copilot/reports", response_model=List[Dict[str, Any]])
async def get_report_history(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """取得報告歷史紀錄"""
    reports = session.exec(
        select(OKRReport)
        .where(OKRReport.owner_id == current_user.id)
        .order_by(OKRReport.created_at.desc())
    ).all()
    
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "report_type": r.report_type,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "created_at": r.created_at,
            "meta_data": json.loads(r.meta_data) if r.meta_data else {}
        }
        for r in reports
    ]


@router.get("/api/okr-copilot/reports/{report_id}/download")
async def download_history_report(
    report_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """下載歷史報告"""
    report = session.get(OKRReport, report_id)
    if not report or report.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if not os.path.exists(report.file_path):
        # Clean up if file is missing
        session.delete(report)
        session.commit()
        raise HTTPException(status_code=404, detail="Report file missing")
    
    # MIME types
    content_types = {
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pdf": "application/pdf",
        "md": "text/markdown"
    }
    media_type = content_types.get(report.report_type, "application/octet-stream")
    
    return FileResponse(
        report.file_path,
        media_type=media_type,
        filename=report.filename
    )


@router.delete("/api/okr-copilot/reports/{report_id}")
async def delete_report(
    report_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """刪除報告"""
    report = session.get(OKRReport, report_id)
    if not report or report.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Delete file
    if os.path.exists(report.file_path):
        try:
            os.remove(report.file_path)
        except OSError:
            pass
            
    session.delete(report)
    session.commit()
    return {"status": "success"}


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
    
    completed_issues = redmine_data.get("completed_issues", 0)
    gitlab_commits = gitlab_data["commits"]
    gitlab_releases = gitlab_data["releases"]
    
    # New Detailed Lists
    raw_completed_list = redmine_data.get("completed_issue_list", [])
    raw_in_progress_list = redmine_data.get("in_progress_issue_list", [])
    
    # AI 分析 (Phase 4.1-4.3 & Phase 9.2)
    kr_status = None
    code_summary = None
    next_steps = None
    summarized_completed = []
    summarized_in_progress = []
    
    try:
        # 9.2 Summarize Issues
        # Run specific summaries first
        import asyncio
        # Run standard analysis and issue summarization concurrently? 
        # For simplicity and creating proper task flow, we do sequential or gathered.
        
        # Summarize lists
        summarized_completed, summarized_in_progress = await asyncio.gather(
            summarize_issue_progress(openai, raw_completed_list),
            summarize_issue_progress(openai, raw_in_progress_list)
        )
        
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
        # AI 分析失敗不影響報告生成, use raw lists if summarized are empty
        if not summarized_completed: summarized_completed = raw_completed_list
        if not summarized_in_progress: summarized_in_progress = raw_in_progress_list
    
    
    # 建立暫存目錄 (Early creation for image downloading)
    temp_dir = tempfile.mkdtemp()
    
    # Download selected images locally for Marp
    local_image_paths = []
    if request.selected_images:
        images_dir = os.path.join(temp_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        
        for idx, img_url in enumerate(request.selected_images):
            # Try to download using RedmineService (handles auth)
            content = None
            if img_url.startswith(('http://', 'https://')):
                 content = redmine.download_file(img_url)
            
            if content:
                # determine extension
                ext = "png"
                # weak check, but better than nothing
                filename_part = img_url.split("?")[0].split("/")[-1]
                if "." in filename_part:
                     possible_ext = filename_part.split(".")[-1]
                     if possible_ext.lower() in ["png", "jpg", "jpeg", "gif", "bmp", "webp"]:
                         ext = possible_ext
                
                local_filename = f"image_{idx}.{ext}"
                local_path = os.path.join(images_dir, local_filename)
                try:
                    with open(local_path, "wb") as f:
                        f.write(content)
                    local_image_paths.append(local_path)
                except Exception as e:
                    print(f"Error saving image {img_url}: {e}")
                    local_image_paths.append(img_url)
            else:
                # Fallback to original if not downloaded (e.g. already local or failed)
                local_image_paths.append(img_url)

    # 生成 Marp Markdown (含 AI 分析結果)
    markdown = generate_marp_markdown(
        request.start_date,
        request.end_date,
        completed_issues,
        gitlab_commits,
        gitlab_releases,
        local_image_paths, # Use local paths
        kr_status=kr_status,
        code_summary=code_summary,
        next_steps=next_steps,
        completed_issue_list=summarized_completed,
        in_progress_issue_list=summarized_in_progress
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
    
    # 其他格式需要使用 Marp CLI 轉換
    try:
        # temp_dir already created above
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
        
        if output_path and os.path.exists(output_path):
            # 複製到持久化目錄
            output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "temp_files")
            os.makedirs(output_dir, exist_ok=True)
            
            filename = f"okr_report_{current_user.id}_{int(datetime.now().timestamp())}.{request.format}"
            final_path = os.path.join(output_dir, filename)
            shutil.copy(output_path, final_path)
            
            # 清理暫存目錄
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            # 10.2 Save Report History
            try:
                # Meta data for quick display
                meta = {
                    "completed_count": completed_issues,
                    "in_progress_count": len(summarized_in_progress),
                    "status_color": kr_status.get("status", "yellow") if kr_status else "gray"
                }
                
                new_report = OKRReport(
                    owner_id=current_user.id,
                    filename=filename,
                    file_path=final_path,
                    report_type=request.format,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    meta_data=json.dumps(meta)
                )
                session.add(new_report)
                session.commit()
                
                # 10.3 Auto-cleanup (Keep max 20)
                reports = session.exec(
                    select(OKRReport)
                    .where(OKRReport.owner_id == current_user.id)
                    .order_by(OKRReport.created_at.desc())
                ).all()
                
                if len(reports) > 20:
                    for old_report in reports[20:]:
                        # Delete file
                        if os.path.exists(old_report.file_path):
                            try:
                                os.remove(old_report.file_path)
                            except OSError:
                                pass
                        # Delete DB record
                        session.delete(old_report)
                    session.commit()
                    
            except Exception as e:
                print(f"Error saving report history: {e}")
            
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
