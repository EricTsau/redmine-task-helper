/**
 * TaskImportModal - 從 Redmine 搜尋並匯入任務到追蹤清單
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, X, Loader2, Check, Square, CheckSquare, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

import { api } from '@/lib/api';



interface SearchResult {
    id: number;
    subject: string;
    project_id: number;
    project_name: string;
    status_id: number;
    status_name: string;
    assigned_to_id: number | null;
    assigned_to_name: string | null;
    updated_on: string;
}

interface Project {
    id: number;
    name: string;
    parent_id: number | null;
    level?: number; // Helpers for tree rendering
    children?: Project[];
}

interface TaskImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: () => void;
    onConfirm?: (ids: number[], tasks: SearchResult[]) => Promise<void>;
}

export function TaskImportModal({ isOpen, onClose, onImportSuccess, onConfirm }: TaskImportModalProps) {
    // 搜尋表單狀態
    const [keyword, setKeyword] = useState('');
    const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
    const [assignedToMe, setAssignedToMe] = useState(false);

    // 搜尋結果狀態
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 選取狀態
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [importing, setImporting] = useState(false);

    // 專案狀態
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

    // Fetch projects on mount
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const res = await api.get<Project[]>('/projects');
                setProjects(res || []);
            } catch (error) {
                console.error("Failed to load projects", error);
            }
        };
        loadProjects();
    }, [isOpen]);

    // Helper to build tree for rendering
    const buildProjectTree = (items: Project[]) => {
        if (!Array.isArray(items)) return [];
        const map = new Map<number, Project>();
        const roots: Project[] = [];
        // First pass: create map
        items.forEach(item => {
            map.set(item.id, { ...item, children: [] });
        });
        // Second pass: link parents
        items.forEach(item => {
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id)!.children!.push(map.get(item.id)!);
            } else {
                roots.push(map.get(item.id)!);
            }
        });
        return roots;
    };

    const projectTree = useMemo(() => buildProjectTree(projects), [projects]);

    const handleSearch = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (selectedProjectId) params.append('project_id', selectedProjectId.toString());
            if (keyword) params.append('q', keyword); // 'q' for keyword as per original
            if (status !== 'all') params.append('status', status); // 'status' as per original
            if (assignedToMe) params.append('assigned_to', 'me'); // 'assigned_to' as per original

            // Need API Key again? or use stored one in backend service?
            // The search endpoint in tasks.py uses dependency injection to get settings, so no header needed if backend is updated.
            // Wait, tasks.py search endpoint DOES depend on settings in DB now (since conversation 7fb77952).
            // Let's assume backend handles auth via DB settings.

            // However, the original code didn't send header?
            // Ah, line 127 in original file: fetch(`${API_BASE}/tasks/search?${params.toString()}`)
            // It didn't send headers. So backend must be handling it or it was failing? 
            // Previous conversation said we refactored dependencies.

            const res = await api.get<SearchResult[]>(`/tasks/search?${params.toString()}`);
            setResults(res);
            setSelectedIds(new Set());
        } catch (e) {
            setError(e instanceof Error ? e.message : '搜尋時發生錯誤');
        } finally {
            setLoading(false);
        }
    }, [keyword, status, assignedToMe, selectedProjectId]);

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === results.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(results.map(r => r.id)));
        }
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;

        setImporting(true);
        setError(null);

        try {
            if (onConfirm) {
                // Custom confirm logic (Planner)
                // Pass back selected IDs and maybe map of tasks (or rely on parent to fetch)
                // Let's pass selected IDs. 
                // We should also pass the tasks themselves if needed, but ID is usually sufficient if parent fetches.
                // Actually, TaskListView will call import-redmine with IDs, and backend fetches. So IDs are enough.
                // But wait, TaskListView works on "ImportRedmineModal" which selected a *Project*.
                // Now we select *Tasks*.
                // TaskListView needs the *Project ID* too, to tell backend which Redmine project we are importing from.
                // TaskImportModal selects tasks from potentially *any* project if "All Projects" selected.
                // But usually `selectedProjectId` is used. 
                // The backend needs `redmine_project_id`.
                // If tasks are mixed, we have a problem.
                // But valid use case is probably filtering tasks within ONE project.
                // I should perhaps return the `selectedProjectId` or infer it.
                // If I pass `selectedIds`, parent doesn't know project ID unless I pass it.
                // If I select "All Projects" and pick one task, `selectedProjectId` might be null.
                // But the task has `project_id`.

                // I'll filter selected items from `results`.
                const selectedTasks = results.filter(r => selectedIds.has(r.id));
                await onConfirm(Array.from(selectedIds), selectedTasks);
            } else {
                // Default behavior (Tracked Tasks)
                // The backend ImportTasksRequest expects { issue_ids: number[] }
                await api.post('/tracked-tasks/import', {
                    issue_ids: Array.from(selectedIds)
                });
                onImportSuccess?.();
            }

            onClose();
            setSelectedIds(new Set());
        } catch (e) {
            setError(e instanceof Error ? e.message : '匯入時發生錯誤');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">匯入 Redmine 任務</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Form */}
                <div className="p-4 border-b space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="搜尋關鍵字..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="flex-1 px-3 py-2 border rounded-md bg-background"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            搜尋
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'all')}
                                className="px-2 py-1 border rounded bg-background"
                            >
                                <option value="open">開啟中</option>
                                <option value="closed">已關閉</option>
                                <option value="all">全部</option>
                            </select>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={assignedToMe}
                                onChange={(e) => setAssignedToMe(e.target.checked)}
                                className="rounded"
                            />
                            僅顯示指派給我的
                        </label>
                    </div>
                </div>

                {/* Body: Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Project Tree */}
                    <div className="w-64 border-r bg-muted/10 overflow-y-auto p-2">
                        <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            專案列表
                        </div>
                        <div className="space-y-0.5">
                            <div
                                onClick={() => setSelectedProjectId(null)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${selectedProjectId === null
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <FolderOpen className="h-4 w-4" />
                                <span>所有專案</span>
                            </div>

                            {projectTree.map(project => (
                                <ProjectItem
                                    key={project.id}
                                    project={project}
                                    selectedId={selectedProjectId}
                                    onSelect={setSelectedProjectId}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-auto p-4">
                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive rounded-md mb-4">
                                {error}
                            </div>
                        )}

                        {results.length > 0 ? (
                            <div className="space-y-2">
                                {/* Select All */}
                                <div className="flex items-center gap-2 pb-2 border-b">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                        {selectedIds.size === results.length ? (
                                            <CheckSquare className="h-4 w-4" />
                                        ) : (
                                            <Square className="h-4 w-4" />
                                        )}
                                        {selectedIds.size === results.length ? '取消全選' : '全選'}
                                    </button>
                                    <span className="text-sm text-muted-foreground">
                                        已選取 {selectedIds.size} / {results.length} 項
                                    </span>
                                </div>

                                {/* Task List */}
                                {results.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => toggleSelect(task.id)}
                                        className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${selectedIds.has(task.id)
                                            ? 'bg-primary/10 border border-primary/30'
                                            : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex-shrink-0">
                                            {selectedIds.has(task.id) ? (
                                                <CheckSquare className="h-5 w-5 text-primary" />
                                            ) : (
                                                <Square className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{task.subject}</div>
                                            <div className="text-sm text-muted-foreground">
                                                #{task.id} • {task.project_name} • {task.status_name}
                                                {task.assigned_to_name && ` • ${task.assigned_to_name}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                {loading ? '搜尋中...' : '請輸入搜尋條件開始搜尋'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md hover:bg-muted"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={selectedIds.size === 0 || importing}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {importing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                匯入中...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                匯入選取 ({selectedIds.size})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper Component for Recursive Rendering
function ProjectItem({ project, selectedId, onSelect, depth = 0 }: {
    project: Project;
    selectedId: number | null;
    onSelect: (id: number) => void;
    depth?: number;
}) {
    const isSelected = selectedId === project.id;
    const [expanded, setExpanded] = useState(true);
    const hasChildren = project.children && project.children.length > 0;

    return (
        <div>
            <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm select-none ${isSelected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => onSelect(project.id)}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className="p-0.5 hover:bg-muted rounded"
                    >
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                ) : (
                    <span className="w-4" />
                )}

                <Folder className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="truncate">{project.name}</span>
            </div>

            {hasChildren && expanded && (
                <div>
                    {project.children!.map(child => (
                        <ProjectItem
                            key={child.id}
                            project={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
