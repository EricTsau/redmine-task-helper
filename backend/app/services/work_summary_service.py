from typing import List, Dict, Any, Optional, TypedDict
from datetime import datetime, timedelta
import json
import traceback
from sqlmodel import Session, select
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.models import User, AIWorkSummarySettings, AIWorkSummaryReport, AppSettings, GitLabInstance, GitLabWatchlist
from app.services.redmine_client import RedmineService
from app.services.openai_service import OpenAIService
from app.services.gitlab_service import GitLabService
from app.models import UserSettings

class AgentState(TypedDict):
    project_ids: List[int]
    user_ids: List[int]
    start_date: str
    end_date: str
    language: str
    raw_logs: List[Dict[str, Any]]
    summary_markdown: str
    messages: List[Any]
    issues: List[Dict[str, Any]]
    time_entries: List[Dict[str, Any]]
    gitlab_commits: List[Dict[str, Any]]
    gitlab_mrs: List[Dict[str, Any]]
    gitlab_metrics: Dict[str, Any]

class WorkSummaryService:
    def __init__(self, session: Session, user: User, redmine: RedmineService, openai: OpenAIService):
        self.session = session
        self.user = user
        self.redmine = redmine
        self.openai = openai

    def get_settings(self) -> AIWorkSummarySettings:
        settings = self.session.exec(
            select(AIWorkSummarySettings).where(AIWorkSummarySettings.owner_id == self.user.id)
        ).first()
        
        if not settings:
            settings = AIWorkSummarySettings(owner_id=self.user.id)
            self.session.add(settings)
            self.session.commit()
            self.session.refresh(settings)
        return settings

    def update_settings(self, project_ids: List[int], user_ids: List[int], gitlab_project_ids: List[int] = []) -> AIWorkSummarySettings:
        settings = self.get_settings()
        settings.target_project_ids = json.dumps(project_ids)
        settings.target_user_ids = json.dumps(user_ids)
        settings.target_gitlab_project_ids = json.dumps(gitlab_project_ids)
        settings.updated_at = datetime.utcnow()
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings

    def get_history(self) -> List[AIWorkSummaryReport]:
        return self.session.exec(
            select(AIWorkSummaryReport)
            .where(AIWorkSummaryReport.owner_id == self.user.id)
            .order_by(AIWorkSummaryReport.created_at.desc())
        ).all()

    def get_report(self, report_id: int) -> Optional[AIWorkSummaryReport]:
        return self.session.exec(
            select(AIWorkSummaryReport)
            .where(AIWorkSummaryReport.id == report_id)
            .where(AIWorkSummaryReport.owner_id == self.user.id)
        ).first()

    async def generate_summary(self, start_date: str, end_date: str, language: str = "zh-TW") -> AIWorkSummaryReport:
        print(f"[DEBUG] Generating summary for user {self.user.id} from {start_date} to {end_date} (Language: {language})")
        settings = self.get_settings()
        project_ids = json.loads(settings.target_project_ids)
        user_ids = json.loads(settings.target_user_ids)
        
        print(f"[DEBUG] Target Projects: {project_ids}, Users: {user_ids}")

        if not project_ids or not user_ids:
            return AIWorkSummaryReport(
                owner_id=self.user.id,
                title="Error",
                summary_markdown="請先設定關注的專案與人員"
            )

        # Build Graph
        workflow = StateGraph(AgentState)
        workflow.add_node("fetch_logs", self._fetch_logs_node)
        workflow.add_node("analyze_logs", self._analyze_logs_node)
        workflow.set_entry_point("fetch_logs")
        workflow.add_edge("fetch_logs", "analyze_logs")
        workflow.add_edge("analyze_logs", END)
        app = workflow.compile()

        inputs = {
            "project_ids": project_ids,
            "user_ids": user_ids,
            "start_date": start_date,
            "end_date": end_date,
            "raw_logs": [],
            "summary_markdown": "",
            "summary_markdown": "",
            "messages": [],
            "language": language,
            "gitlab_commits": [],
            "gitlab_mrs": [],
            "gitlab_metrics": {}
        }

        try:
            print("[DEBUG] Invoking workflow...")
            result = await app.ainvoke(inputs)
            print("[DEBUG] Workflow finished.")
        except Exception as e:
            print(f"[DEBUG] Workflow failed: {e}")
            traceback.print_exc()
            raise e

        # Extract title from markdown (first H1/H2) if present
        md = result.get("summary_markdown", "") or ""
        title = None
        for line in md.splitlines():
            line = line.strip()
            if line.startswith('#'):
                # remove leading hashes and whitespace
                title = line.lstrip('#').strip()
                break

        if not title:
            title = f"工作總結 {start_date} ~ {end_date}"

        # Save Report
        try:
            report = AIWorkSummaryReport(
                owner_id=self.user.id,
                title=title,
                date_range_start=start_date,
                date_range_end=end_date,
                summary_markdown=md,
                gitlab_metrics=json.dumps(result.get("gitlab_metrics", {})),
                conversation_history="[]"
            )
            self.session.add(report)
            self.session.commit()
            self.session.refresh(report)
            print(f"[DEBUG] Report saved with ID: {report.id}")
            return report
        except Exception as e:
            print(f"[DEBUG] Error saving report: {e}")
            traceback.print_exc()
            raise e

    async def _fetch_logs_node(self, state: AgentState) -> Dict:
        start_date = state.get('start_date')
        end_date = state.get('end_date') or start_date

        users_set = set(state["user_ids"])
        projects_set = set(state["project_ids"])

        # 1. Fetch Issues updated in range
        try:
            issues = self.redmine.search_issues_advanced(
                updated_after=start_date,
                include=['attachments'],
                limit=500
            )
        except Exception as e:
            print(f"Error fetching issues: {e}")
            issues = []

        filtered_issues = []
        structured_issues = []
        for issue in issues:
            try:
                pid = issue.project.id
            except Exception:
                continue
            if pid in projects_set:
                # Handle updated_on which might be a datetime object or string
                updated_on = getattr(issue, 'updated_on', None)
                updated_on_str = ""
                if updated_on:
                    if isinstance(updated_on, str):
                        updated_on_str = updated_on
                    elif isinstance(updated_on, datetime):
                        updated_on_str = updated_on.isoformat()
                    else:
                        updated_on_str = str(updated_on)

                include_issue = True
                # client-side end_date filter if server didn't apply
                if updated_on_str:
                    if updated_on_str.split('T')[0] > end_date:
                        include_issue = False
                
                if include_issue:
                    try:
                        filtered_issues.append(issue)
                        # fetch journals
                        journals = []
                        try:
                            journals = self.redmine.get_issue_journals(issue.id)
                        except Exception:
                            journals = []
                        
                        # Process attachments for this issue
                        # Use updated_on safe getter or default to empty if lazy load fails
                        attachments = []
                        try:
                            attachments = getattr(issue, 'attachments', [])
                        except Exception:
                            attachments = []
                        
                        attachment_map = {}
                        for a in attachments:
                            # content_url is usually full URL to download
                            if hasattr(a, 'filename') and hasattr(a, 'content_url'):
                                attachment_map[a.filename] = a.content_url

                        # Safely get description
                        description = ''
                        try:
                            description = getattr(issue, 'description', '') or ''
                        except Exception:
                            description = ''

                        structured_issues.append({
                            'id': issue.id,
                            'project_id': pid,
                            'project_name': getattr(issue.project, 'name', ''),
                            'subject': getattr(issue, 'subject', ''),
                            'status': getattr(issue.status, 'name', ''),
                            'created_on': getattr(issue, 'created_on', ''),
                            'closed_on': getattr(issue, 'closed_on', ''),
                            'updated_on': updated_on_str,
                            'journals': journals,
                            'description': description,
                            'attachment_map': attachment_map
                        })
                    except Exception as e:
                        print(f"Error processing issue {issue.id}: {e}")
                        continue

        # 2. Fetch time entries for the projects / users in the date range
        time_entries = []
        for pid in projects_set:
            try:
                entries = self.redmine.search_time_entries(
                    user_ids=list(users_set) if users_set else None,
                    project_id=pid,
                    from_date=start_date,
                    to_date=end_date,
                    limit=500
                )
            except Exception:
                entries = []

            for e in entries:
                te_date = getattr(e, 'spent_on', None) or getattr(e, 'created_on', None) or ''
                te_hours = getattr(e, 'hours', getattr(e, 'hours', 0))
                te_user = getattr(e, 'user', None)
                te_user_name = getattr(te_user, 'name', '') if te_user else ''
                te_issue = getattr(e, 'issue', None)
                te_issue_id = getattr(te_issue, 'id', '') if te_issue else ''
                time_entries.append({
                    'date': te_date,
                    'hours': te_hours,
                    'user': te_user_name,
                    'issue_id': te_issue_id,
                    'comments': getattr(e, 'comments', '')
                })

        # Build raw_logs structured for analysis + summary
        raw_summary_lines = []
        raw_summary_lines.append(f"Found {len(structured_issues)} updated issues in targeted projects.")
        
        # Regex for finding images in Textile (!image!) or Markdown (![alt](url))
        import re
        img_re = re.compile(r'!([^!]+)!|!\[.*?\]\((.*?)\)')
        
        for i in structured_issues:
            # Filter journals by date range AND user_id strict match
            filtered_journals = []
            issue_images = []
            attachment_map = i.get('attachment_map', {})
            
            def resolve_url(url_or_filename):
                # Try to map filename to content_url
                if url_or_filename in attachment_map:
                    return attachment_map[url_or_filename]
                return url_or_filename

            # Check issue description for images
            description = i.get('description', '')
            found_desc_imgs = img_re.findall(description)
            for m in found_desc_imgs:
                # m is tuple ('url_textile', 'url_markdown')
                raw_ref = m[0] or m[1]
                if raw_ref:
                    resolved = resolve_url(raw_ref)
                    issue_images.append(resolved)

            # Filter journals
            all_journals = i.get('journals', [])
            for j in all_journals:
                j_date_str = j.get('created_on', '')
                j_user_id = j.get('user_id')
                
                # Filter by User ID (Strict) if available
                # target_user_ids are INTs
                is_target_user = False
                if j_user_id and j_user_id in users_set:
                    is_target_user = True
                
                # Check date range
                j_date_day = j_date_str.split('T')[0] if 'T' in j_date_str else j_date_str
                in_date_range = start_date <= j_date_day <= end_date

                if is_target_user and in_date_range:
                    filtered_journals.append(j)
                    # Check for images in journal notes
                    notes = j.get('notes', '')
                    found_imgs = img_re.findall(notes)
                    for m in found_imgs:
                        raw_ref = m[0] or m[1]
                        if raw_ref:
                            resolved = resolve_url(raw_ref)
                            issue_images.append(resolved)
            
            # Update the structured issue with filtered journals and images
            i['journals'] = filtered_journals
            i['images'] = list(set(issue_images)) # Deduplicate

            # Add to raw summary lines for LLM context (Classic/Fallback)
            updated_on_val = i['updated_on']
            updated_on_day = updated_on_val.split('T')[0] if updated_on_val else ''
            
            if filtered_journals or (updated_on_day and updated_on_day >= start_date): 
                raw_summary_lines.append(f"- [{i['id']}] {i['subject']} (Project: {i['project_name']}, Status: {i['status']}, Updated: {i['updated_on']})")
                
                for j in filtered_journals:
                    raw_summary_lines.append(f"  - Journal by {j.get('user')} ({j.get('created_on')}): {j.get('notes')}")
                
                if issue_images:
                     raw_summary_lines.append(f"  - Detected Images: {', '.join(issue_images)}")

        raw_summary_lines.append(f"\nFound {len(time_entries)} time entries in range.")
        for te in time_entries:
            raw_summary_lines.append(f"- [{te.get('date')}] Issue:{te.get('issue_id')} User:{te.get('user')} Hours:{te.get('hours')} Comments:{te.get('comments')}")

        raw_text = "\n".join(raw_summary_lines)

        # 3. Fetch GitLab Data
        gitlab_commits = []
        gitlab_mrs = []
        gitlab_metrics = {
            "instances": []
        }

        # Fetch all gitlab instances for this user
        instances = self.session.exec(
            select(GitLabInstance).where(GitLabInstance.owner_id == self.user.id)
        ).all()

        since = datetime.fromisoformat(start_date.replace("Z", "+00:00")) - timedelta(days=1)
        until = datetime.fromisoformat(end_date.replace("Z", "+00:00")) + timedelta(days=1)

        for instance in instances:
            gs = GitLabService(instance)
            # Find watchlists for this instance
            watchlists = self.session.exec(
                select(GitLabWatchlist)
                .where(GitLabWatchlist.owner_id == self.user.id)
                .where(GitLabWatchlist.instance_id == instance.id)
            ).all()

            instance_commits = []
            instance_mrs = []

            for wl in watchlists:
                try:
                    commits = await gs.get_commits(wl.gitlab_project_id, since, until)
                    # Inject project_id into commits
                    for c in commits:
                        c["project_id"] = wl.gitlab_project_id
                    instance_commits.extend(commits)
                    
                    mrs = await gs.get_merge_requests(wl.gitlab_project_id, since)
                    # Inject project_id into MRs
                    for mr in mrs:
                        mr["project_id"] = wl.gitlab_project_id
                    instance_mrs.extend(mrs)
                except Exception as e:
                    print(f"Error fetching GitLab data for {wl.project_name}: {e}")

            # Parallel fetch for Commit Extensions and MR Notes
            # Caution: If there are hundreds of commits, this might be slow or hit rate limits.
            # We limit to first 50 commits/MRs for performance if needed, but for weekly summary it should be fine.
            commit_extensions = []
            if instance_commits:
                # Limit to 50 most recent for tech stack analysis to avoid massive overhead
                sample_commits = instance_commits[:50]
                tasks = [gs.get_commit_diff_extensions(c["project_id"], c["id"]) for c in sample_commits]
                commit_extensions = await asyncio.gather(*tasks)

            mr_notes_counts = []
            mr_notes_snippets = []
            if instance_mrs:
                # Limit to recent 10 MRs to avoid too many note requests
                sample_mrs = instance_mrs[:10]
                tasks_count = [gs.get_mr_notes_count(mr["project_id"], mr["iid"]) for mr in instance_mrs]
                tasks_snippet = [gs.get_mr_notes_snippet(mr["project_id"], mr["iid"]) for mr in sample_mrs]
                
                results = await asyncio.gather(*(tasks_count + tasks_snippet))
                mr_notes_counts = results[:len(tasks_count)]
                mr_notes_snippets = results[len(tasks_count):]
                
                # Attach snippets to sample MRs
                for i, snippet in enumerate(mr_notes_snippets):
                    sample_mrs[i]["notes_summary"] = snippet

            gitlab_commits.extend(instance_commits)
            gitlab_mrs.extend(instance_mrs)
            
            # Calculate metrics for this instance
            impact = gs.analyze_impact(instance_commits, commit_extensions)
            cycle = gs.calculate_cycle_time(instance_mrs, mr_notes_counts)
            heatmap = gs.process_commits_for_heatmap(instance_commits)
            
            gitlab_metrics["instances"].append({
                "name": instance.instance_name,
                "impact": impact,
                "cycle": cycle,
                "heatmap": heatmap
            })

        # Return structured data including GitLab
        return {
            "raw_logs": [{"summary": raw_text}],
            'time_entries_count': len(time_entries),
            'issues': structured_issues,
            'time_entries': time_entries,
            'gitlab_commits': gitlab_commits,
            'gitlab_mrs': gitlab_mrs,
            'gitlab_metrics': gitlab_metrics
        }

    async def error_dump_to_txt(self, prompt, p_name, u_name, error=None):
        # Error Dump Feature
        should_dump = False
        try:
            # Check DB setting first
            app_settings = self.session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
            if app_settings and app_settings.enable_ai_debug_dump:
                should_dump = True
        except Exception:
            # Fallback or just ignore if DB fails, maybe check env var as backup?
            # For now, strict DB setting as requested. or keep env var as override?
            # User asked to "Change to Admin setting", implying env var is replaced or secondary.
            pass

        if should_dump:
            try:
                dump_dir = "logs/ai_error_dumps"
                import os
                os.makedirs(dump_dir, exist_ok=True)
                ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                filename = f"{dump_dir}/error_{ts}_{p_name}_{u_name}.txt"
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(f"Error: {str(error)}\n\n")
                    f.write(f"Prompt:\n{prompt}\n")
                print(f"[DEBUG] Dumped error context to {filename}")
            except Exception as dump_err:
                print(f"[DEBUG] Failed to dump error context: {dump_err}")

    async def _analyze_logs_node(self, state: AgentState) -> Dict:
        print("[DEBUG] Entering _analyze_logs_node (Map-Reduce Strategy)")
        
        issues = state.get('issues', []) or []
        time_entries = state.get('time_entries', []) or []
        start_date = state.get('start_date')
        end_date = state.get('end_date')
        
        # 1. Group Data by (Project, User)
        # Groups: Dict[project_id, Dict[user_name, List[str]]]
        grouped_data: Dict[str, Dict[str, List[str]]] = {}
        
        # Determine redmine base URL
        user_settings = self.session.exec(
            select(UserSettings).where(UserSettings.user_id == self.user.id)
        ).first()
        redmine_base = ''
        if user_settings and getattr(user_settings, 'redmine_url', None):
            redmine_base = user_settings.redmine_url.rstrip('/')
        else:
            redmine_base = getattr(self.redmine, 'base_url', '') if hasattr(self.redmine, 'base_url') else ''

        def add_to_group(project_name, user_name, line):
            if project_name not in grouped_data:
                grouped_data[project_name] = {}
            if user_name not in grouped_data[project_name]:
                grouped_data[project_name][user_name] = []
            grouped_data[project_name][user_name].append(line)

        # Image Placeholder Logic
        img_placeholder_map = {}
        img_counter = 0
        
        def get_img_placeholder(url):
            nonlocal img_counter
            # Check if url already mapped? (O(N) search or reverse map? keeping it simple for now)
            for k, v in img_placeholder_map.items():
                if v == url:
                    return k
            
            key = f"IMG_PLACEHOLDER_{img_counter}"
            img_placeholder_map[key] = url
            img_counter += 1
            return key


        # Process Issues
        for i in issues:
            p_name = i.get('project_name', 'Unknown Project')
            link = f"{redmine_base}/issues/{i['id']}" if redmine_base else f"issues/{i['id']}"
            subject_clean = i['subject'].replace('|', '-') 
            
            # Images context with Placeholder
            img_context = ""
            if i.get('images'):
                placeholders = []
                for img_url in i['images']:
                    ph = get_img_placeholder(img_url)
                    placeholders.append(ph)
                img_context = f"\n  - Images: {', '.join(placeholders)}"

            # 1. Journals (Filtered)
            # Only add if we have journals (User Activity)
            for j in i.get('journals', []):
                u_name = j.get('user', 'Unknown User')
                # Include issue subject in the log line for context
                note_preview = j.get('notes', '').replace('\n', ' ')
                
                # Replace any image URLs in the note text with placeholders too (optimization)
                if i.get('images'):
                    for img_url in i['images']:
                         # Simple text replacement if exact match found
                         if img_url in note_preview:
                             ph = get_img_placeholder(img_url)
                             note_preview = note_preview.replace(img_url, ph)
                
                # Format dates
                created_date = i.get('created_on', '')
                if created_date and 'T' in str(created_date):
                     created_date = str(created_date).split('T')[0]
                
                closed_date = i.get('closed_on', '')
                if closed_date and 'T' in str(closed_date):
                     closed_date = str(closed_date).split('T')[0]

                line = f"- {j.get('created_on', '')[:10]} | [#{i['id']} {subject_clean}]({link}) | Created:{created_date} | Closed:{closed_date} | {note_preview} {img_context}"
                add_to_group(p_name, u_name, line)
            
            # If no journals but updated_on is recent, and we have images or key info, add a general line
            updated_on_day = i['updated_on'].split('T')[0] if i['updated_on'] else ''
            if not i.get('journals') and updated_on_day and start_date <= updated_on_day <= end_date:
                u_name = "General" # Default if no specific user journal
                created_date = i.get('created_on', '')
                if created_date and 'T' in str(created_date):
                     created_date = str(created_date).split('T')[0]
                closed_date = i.get('closed_on', '')
                if closed_date and 'T' in str(closed_date):
                     closed_date = str(closed_date).split('T')[0]
                
                line = f"- {updated_on_day} | [#{i['id']} {subject_clean}]({link}) | Created:{created_date} | Closed:{closed_date} | (Issue Updated) {img_context}"
                add_to_group(p_name, u_name, line)

        # Process Time Entries
        for te in time_entries:
            u_name = te.get('user', 'Unknown User')
            # Try to infer project or use "Time Entries"
            # Since we don't have project name in TE struct easily without map, we group by User under "Time Entries"
            line = f"- {te.get('date')} | Issue #{te.get('issue_id')} | {te.get('hours')}h | {te.get('comments')}"
            add_to_group("Time Logs", u_name, line)

        # Process GitLab Commits
        gitlab_commits = state.get("gitlab_commits", [])
        for c in gitlab_commits:
            u_name = c.get("author_name", "Unknown Dev")
            project_name = "Code Updates" # Or map from project_id if available
            date = c.get("created_at", "")[:10]
            message = c.get("message", "").replace("\n", " ")
            stats = c.get("stats", {})
            line = f"- {date} | COMMIT | {message} (+{stats.get('additions', 0)} -{stats.get('deletions', 0)}) | [View]({c.get('web_url')})"
            add_to_group(project_name, u_name, line)

        # Process GitLab MRs
        gitlab_mrs = state.get("gitlab_mrs", [])
        for mr in gitlab_mrs:
            u_name = mr.get("author", {}).get("name", "Unknown Dev")
            project_name = "Code Updates"
            date = mr.get("updated_at", "")[:10]
            status = mr.get("state", "")
            notes = f" | Notes: {mr['notes_summary']}" if mr.get("notes_summary") else ""
            line = f"- {date} | MR | {mr.get('title')} ({status}){notes} | [View]({mr.get('web_url')})"
            add_to_group(project_name, u_name, line)

        # 2. Map Phase: Summarize each (Project, User) chunk
        import asyncio
        
        async def analyze_chunk(p_name, u_name, lines):
            if not lines: return ""
            lang = state.get('language', 'zh-TW')

            text = "\n".join(lines)
            prompt = f"""
            Task: Summarize the work logs for this user in this project.
            Language: {lang}
            Report End Date: {end_date} (or Today)
            
            Project: {p_name}
            User: {u_name}
            Logs:
            {text}
            
            Instruction:
            1. **Overall Summary**: Provide a high-level summary of the user's main contributions and focus areas in this project for the given period.
            2. **Work Items List**: Create a markdown table with the following columns:
               - Issue ID (with link if using markdown []())
               - **Subject** (Exact title from logs - THIS IS MANDATORY AND MUST BE PRESERVED)
               - Status
               - **Duration / Timeline**:
                 - If Open: "Created <date> (Open for X days)" - Calculate days from Created Date to Report End Date.
                 - If Closed: "Created <date>, Closed <date>"
               - Updated Time (Last update in logs)
               - Spent Hours (Sum up time entries if any)
               - **Item Summary** (Critical): Explain what was done, key results, and any pending action items or follow-ups required.
               
            CRITICAL REQUIREMENTS:
            - The Subject column must ALWAYS contain the exact issue title from the logs
            - Never leave the Subject column empty or use generic text like "Untitled"
            - If an issue appears in the logs, its subject must be included in the table
            - Double-check that every issue in the input logs has its subject properly displayed in the table
            - Verify that each row in the table corresponds to a unique issue from the logs
            
            3. **Git Log Translation (Critical)**:
               - For COMMIT items, do NOT just copy the git log.
               - Translate technical commit messages into human-readable descriptions of "Feature Development" or "Bug Fix".
               - Try to correlate them with Redmine Issue IDs if mentioned in the message or related issues.

            4. **Attachments Footer**:
               - Identify any images mentioned in logs (they will have placeholders like IMG_PLACEHOLDER_0, IMG_PLACEHOLDER_1, etc.).
               - For each image placeholder, output using this EXACT format: `![Issue #ID - Description](IMG_PLACEHOLDER_N)`
               - Example: If you see IMG_PLACEHOLDER_0, write `![Issue #123 - Screenshot](IMG_PLACEHOLDER_0)`
               - **CRITICAL**: Keep the placeholder exactly as provided. Do NOT try to replace it with a URL.
               - Group all images at the very bottom under "#### Attachments".

            Output Format (Markdown):
            ### {p_name} - {u_name}
            
            #### Overall Summary
            (Summary content here...)

            #### Work Items
            | Issue | Subject | Status | Duration/Timeline | Updated | Hours | Summary & Actions |
            |-------|---------|--------|-------------------|---------|-------|-------------------|
            | ...   | ...     | ...    | ...               | ...     | ...   | ...               |

            #### Attachments
            (Images here...)
            """
            try:
                # Use standard chat completion
                res = await self.openai.chat_completion([
                    {"role": "system", "content": "You are a Project Manager Assistant."},
                    {"role": "user", "content": prompt}
                ])
                final_res = res
                # Restore happens after try block or logic flow needs adjustment? 
                # Better to return here and restore in caller? No, analyze_chunk returns the string summary.
                # So we must restore HERE before returning.
                
                # We do restoration at end of function.
                pass 
            except Exception as e:
                print(f"Error analyzing chunk {p_name}-{u_name}: {e}")
                
                # Error Dump Feature
                should_dump = False
                try:
                    # Check DB setting first
                    app_settings = self.session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
                    if app_settings and app_settings.enable_ai_debug_dump:
                        should_dump = True
                except Exception:
                    # Fallback or just ignore if DB fails, maybe check env var as backup?
                    # For now, strict DB setting as requested. or keep env var as override?
                    # User asked to "Change to Admin setting", implying env var is replaced or secondary.
                    pass

                if should_dump:
                     try:
                         dump_dir = "logs/ai_error_dumps"
                         import os
                         os.makedirs(dump_dir, exist_ok=True)
                         ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                         filename = f"{dump_dir}/error_{ts}_{p_name}_{u_name}.txt"
                         
                         with open(filename, "w", encoding="utf-8") as f:
                             f.write(f"Error: {str(e)}\n\n")
                             f.write(f"Prompt:\n{prompt}\n")
                         print(f"[DEBUG] Dumped error context to {filename}")
                     except Exception as dump_err:
                         print(f"[DEBUG] Failed to dump error context: {dump_err}")
                
                return f"**{p_name} - {u_name}**: (AI Analysis Failed: {str(e)})"
            
            # Restore Image Placeholders
            if isinstance(final_res, str): # Verify it's string (it should be)
                for ph, original_url in img_placeholder_map.items():
                    if ph in final_res:
                        final_res = final_res.replace(ph, original_url)
            
            return final_res

        # Get Concurrency Limit from App Settings
        try:
            app_settings = self.session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
            concurrency_limit = app_settings.max_concurrent_chunks if app_settings else 5
        except Exception:
            concurrency_limit = 5
        
        print(f"[DEBUG] Using concurrency limit: {concurrency_limit}")
        semaphore = asyncio.Semaphore(concurrency_limit)

        async def restricted_analyze_chunk(p_name, u_name, lines):
            async with semaphore:
                return await analyze_chunk(p_name, u_name, lines)

        tasks = []
        for p_name, users_map in grouped_data.items():
            for u_name, lines in users_map.items():
                if lines:
                    tasks.append(restricted_analyze_chunk(p_name, u_name, lines))
        
        chunk_summaries = []
        if tasks:
            print(f"[DEBUG] Processing {len(tasks)} chunks in parallel...")
            chunk_results = await asyncio.gather(*tasks)
            chunk_summaries = list(filter(None, chunk_results))
        
        if not chunk_summaries:
            chunk_summaries = ["(No specific work logs found for target users in this period.)"]

        # 3. Reduce Phase: Manual Aggregate (Optimized for Tokens)
        print("[DEBUG] Manual Reduce - Concatenating summaries...")

        # Add header
        header = f"# 工作總結報告 ({start_date} ~ {end_date})\n\n"
        
        combined_chunk_text = "\n\n".join(chunk_summaries)

        # Optimize: Reduce context size by extracting ONLY the "Overall Summary" section for Grand Summary
        # Strategy: 
        # 1. Keep the Header (### Project - User)
        # 2. Capture text between "#### Overall Summary" and "#### Work Items"
        # 3. Discard everything else (Work Items, Attachments, etc.)
        summary_context = []
        for report in chunk_summaries:
            lines = report.split('\n')
            capturing = False
            
            # Add identity header (assume it's the first non-empty line formatted as header)
            # Or simplified: just look for the standard format we generated: ### {p_name} - {u_name}
            
            for line in lines:
                stripped = line.strip()
                
                # Always keep the main Identity Header
                if stripped.startswith('### ') and ' - ' in stripped:
                    summary_context.append(line)
                    continue

                if "#### Overall Summary" in stripped:
                    capturing = True
                    summary_context.append(line)
                    continue
                
                # Stop capturing when hitting the next section
                if "#### Work Items" in stripped or "#### Attachments" in stripped:
                    capturing = False
                    continue
                
                if capturing:
                    summary_context.append(line)

        combined_chunk_text_for_prompt = "\n".join(summary_context)
        
        # Grand Summary Generation
        grand_summary = ""
        try:
            reduce_prompt = f"""
            Task: Create an Executive Summary for the following project work reports.
            Language: {state.get('language', 'zh-TW')}
            
            Reports:
            {combined_chunk_text_for_prompt}
            
            Instruction:
            - Synthesize a high-level "Grand Summary" that covers the key achievements across ALL projects and users.
            - Do NOT list every detail again. Focus on big picture progress, major milestones completed, and overall status.
            - Keep it concise (1-2 paragraphs).
            """
            
            grand_summary_res = await self.openai.chat_completion([
                {"role": "system", "content": "You are a Project Manager Director."},
                {"role": "user", "content": reduce_prompt}
            ])
            grand_summary = f"## 總體摘要\n{grand_summary_res}\n\n---\n\n"
        except Exception as e:
            print(f"[DEBUG] Grand summary generation failed: {e}")
            await self.error_dump_to_txt(reduce_prompt, "ALL", "ALL", error=e)
            grand_summary = "## 總體摘要\n(自動生成失敗 - 請檢查後台日誌或降低報告範圍)\n\n---\n\n"

        final_report = header + grand_summary + combined_chunk_text
        
        # Add GitLab Metrics Dashboard at the end
        metrics = state.get("gitlab_metrics", {})
        if metrics.get("instances"):
            final_report += "\n\n---\n\n## GitLab 代碼脈動 (GitLab Pulse)\n"
            for inst in metrics["instances"]:
                final_report += f"### {inst['name']}\n"
                impact = inst["impact"]
                cycle = inst["cycle"]
                
                # Impact Highlights
                final_report += f"- **代碼產出**: {impact['total_commits']} Commits, +{impact['additions']} / -{impact['deletions']} Lines\n"
                
                # Tech Stack
                if impact.get("tech_stack"):
                    tech_line = ", ".join([f"{t['language']} ({t['percentage']}%)" for t in impact["tech_stack"]])
                    final_report += f"- **技術重心**: {tech_line}\n"
                
                # Collaboration Metrics
                avg_time = cycle['average_cycle_time_seconds']/3600
                final_report += f"- **審查效率**: 平均 MR 合併時間 {avg_time:.1f} 小時\n"
                final_report += f"- **協作活躍**: {cycle['opened_count']} 個新 MR, {cycle['merged_count']} 個已合併, 共 {cycle['total_review_notes']} 則評論\n"
        
        return {"summary_markdown": final_report, 'issues': issues, 'time_entries': time_entries}

    async def chat_with_report(self, report_id: int, message: str, action: str) -> Dict[str, Any]:
        report = self.get_report(report_id)
        if not report:
            raise Exception("Report not found")
            
        history = json.loads(report.conversation_history or "[]")
        
        # Build context from summary
        system_prompt = f"""
        你是專業的專案經理助手。使用者正在檢視一份工作總結報告。
        
        目前的報告內容:
        {report.summary_markdown}
        
        請根據使用者的指示進行回應。
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history
        # Simplify history to last 5 rounds to save tokens
        for msg in history[-10:]: 
            messages.append(msg)
            
        messages.append({"role": "user", "content": message})
        
        if action == "refine":
            # Add instruction for refinement
            messages.append({"role": "system", "content": "使用者要求根據上述指示「重新撰寫」或「補充」整份報告。請輸出完整的、更新後的 Markdown 報告內容。"})
            
        response_text = await self.openai.chat_completion(messages)
        
        # Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response_text})
        report.conversation_history = json.dumps(history)
        
        result = {"response": response_text}
        
        if action == "refine":
            report.summary_markdown = response_text
            result["updated_summary"] = response_text
            
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        
        return result

    def update_report_content(self, report_id: int, content: Optional[str] = None, title: Optional[str] = None) -> Optional[AIWorkSummaryReport]:
        report = self.get_report(report_id)
        if not report:
            return None
            
        if content is not None:
            report.summary_markdown = content
        
        if title is not None:
            report.title = title

        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    def delete_report(self, report_id: int) -> bool:
        report = self.get_report(report_id)
        if not report:
            return False
        self.session.delete(report)
        self.session.commit()
        return True
