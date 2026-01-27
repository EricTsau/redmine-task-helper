/**
 * TaskGroupView - 追蹤任務分組檢視
 * 支援依 Project / Status / Custom Group 分類
 */
import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, Trash2, Tag, FolderOpen, CheckCircle, Loader2, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Edit2, Network } from 'lucide-react';

import { api } from '@/lib/api';
import { getTaskHealthStatus, getTaskHealthColorClass, formatRedmineIssueUrl, type TaskHealthStatus } from '../tasks/taskUtils';
import { TaskMetaInfo } from '../tasks/TaskMetaInfo';
import { TaskGroupStats } from '../tasks/TaskGroupStats';
import { RedmineTaskDetailModal } from '../tasks/RedmineTaskDetailModal';
import { StatusSelect } from '../tasks/StatusSelect';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface TrackedTask {
    id: number;
    redmine_issue_id: number;
    project_id: number;
    project_name: string;
    subject: string;
    status_id: number;
    status: string;
    estimated_hours: number | null;
    spent_hours: number;
    updated_on: string | null;
    assigned_to_id: number | null;
    assigned_to_name: string | null;
    custom_group: string | null;
    last_synced_at: string | null;
    created_at: string;
    parent_id?: number | null;
    parent_subject?: string | null;
    author_id?: number | null;
    author_name?: string | null;
    // Legacy support for older mapping if needed, but we used parent_id now
    parent?: {
        id: number;
        subject: string;
    };
    relations?: string; // JSON string
}

interface Relation {
    id: number;
    subject: string;
    status: string;
    estimated_hours: number | null;
    updated_on: string | null;
    author_name: string | null;
    assigned_to_name: string | null;
    relation_type: string;
}

type GroupBy = 'project' | 'status' | 'custom';

interface TaskGroupViewProps {
    startTimer: (id: number, comment?: string) => void;
    onRefresh?: () => void;
}

export function TaskGroupView({ startTimer }: TaskGroupViewProps) {
    const [tasks, setTasks] = useState<TrackedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<GroupBy>('project');


    const [editingTask, setEditingTask] = useState<TrackedTask | null>(null);
    const [redmineUrl, setRedmineUrl] = useState<string>('');

    // State to track expanded groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Helper helper to expand/collapse groups
    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) {
                next.delete(groupName);
            } else {
                next.add(groupName);
            }
            return next;
        });
    };



    const [warningDays, setWarningDays] = useState(2);
    const [severeDays, setSevereDays] = useState(3);

    const loadTasks = useCallback(async () => {
        try {
            const [tasksRes, settingsRes] = await Promise.all([
                api.get<TrackedTask[]>('/tracked-tasks/'),
                api.get<any>('/settings')
            ]);
            setTasks(tasksRes);
            if (settingsRes) {
                setWarningDays(settingsRes.task_warning_days ?? 2);
                setSevereDays(settingsRes.task_severe_warning_days ?? 3);
                if (settingsRes.redmine_url) setRedmineUrl(settingsRes.redmine_url);
            }
            setError(null);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : '載入失敗');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load from local DB
        loadTasks();

        // Trigger background sync on mount (on-demand refresh)
        // We use a separate async call to not block the initial UI render
        api.post('/tracked-tasks/sync')
            .then(() => loadTasks()) // Reload after sync completes
            .catch(console.error);
    }, [loadTasks]);

    // Update expanded groups when tasks or grouping changes
    useEffect(() => {
        // Initially expand all groups when groupedData changes significantly (e.g. first load)
        // Or maintain state if just refreshing tasks. 
        // For simplicity, let's auto-expand all if the expanded set is empty on load
        if (tasks.length > 0 && expandedGroups.size === 0) {
            const groups = new Set<string>();
            tasks.forEach(task => {
                let key: string;
                switch (groupBy) {
                    case 'project': key = task.project_name; break;
                    case 'status': key = task.status; break;
                    case 'custom': key = task.custom_group || '未分類'; break;
                    default: key = 'Other';
                }
                groups.add(key);
            });
            setExpandedGroups(groups);
        }
    }, [tasks.length, groupBy]); // Only re-calc default expansion on major changes

    const handleSync = async () => {
        setSyncing(true);
        try {
            await api.post('/tracked-tasks/sync');
            await loadTasks();
            setError(null);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : '同步失敗');
        } finally {
            setSyncing(false);
        }
    };

    const handleRemove = async (taskId: number) => {
        if (!confirm('Stop tracking this task?')) return;
        try {
            await api.delete(`/tracked-tasks/${taskId}`);
            setTasks(prev => prev.filter(t => t.id !== taskId));
            setError(null);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : '移除失敗');
        }
    };



    // Helper to determine status based on updated_on
    // Helper to determine status based on updated_on
    const getTaskStatus = (task: TrackedTask): TaskHealthStatus => {
        return getTaskHealthStatus(task, { warningDays, severeDays });
    };

    // Helper to build tree for Tracked Tasks
    const buildTaskTree = (flatTasks: TrackedTask[]) => {
        const taskMap = new Map<number, TrackedTask & { children: any[] }>();
        // Initialize map with all tasks
        flatTasks.forEach(t => {
            // Use redmine_issue_id as key for mapping
            taskMap.set(t.redmine_issue_id, { ...t, children: [] });
        });

        const roots: (TrackedTask & { children: any[] })[] = [];

        flatTasks.forEach(t => {
            const node = taskMap.get(t.redmine_issue_id);
            if (!node) return;

            // Check if parent exists in our tracked list by parent_id
            // Note: DB field is parent_id (pointing to Redmine ID of parent)
            if (t.parent_id && taskMap.has(t.parent_id)) {
                taskMap.get(t.parent_id)!.children.push(node);
            } else if (t.parent && taskMap.has(t.parent.id)) {
                // Fallback for legacy structure if API returns it
                taskMap.get(t.parent.id)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    // Tree Node State (Expand/Collapse)
    const [treeExpanded, setTreeExpanded] = useState<Set<number>>(new Set());
    const toggleTreeNode = (id: number) => {
        setTreeExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Auto-expand all on first load
    useEffect(() => {
        if (tasks.length > 0 && treeExpanded.size === 0) {
            const allIds = tasks.map(t => t.redmine_issue_id);
            setTreeExpanded(new Set(allIds));
        }
    }, [tasks.length]);

    // Tree view expand/collapse all functions
    const expandAllTree = () => {
        const allIds = tasks.map(t => t.redmine_issue_id);
        setTreeExpanded(new Set(allIds));
    };

    const collapseAllTree = () => {
        setTreeExpanded(new Set());
    };


    const renderTreeNodes = (nodes: (TrackedTask & { children: (TrackedTask & { children: any[] })[] })[]) => {
        return nodes.map(node => {
            const status = getTaskStatus(node);
            const bgClass = getTaskHealthColorClass(status);
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = treeExpanded.has(node.redmine_issue_id);

            return (
                <div key={node.id} className="tree-node-container space-y-2">
                    <div
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${bgClass}`}
                    >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            {/* Tree Toggle */}
                            <div className="flex-shrink-0 w-6 flex justify-center">
                                {hasChildren ? (
                                    <button
                                        onClick={() => toggleTreeNode(node.redmine_issue_id)}
                                        className="p-0.5 hover:bg-black/10 rounded transition-colors"
                                    >
                                        {isExpanded ? <ChevronDown className="h-4 w-4 opacity-70" /> : <ChevronRight className="h-4 w-4 opacity-70" />}
                                    </button>
                                ) : (
                                    <span className="w-4" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{node.subject}</div>
                                    {hasChildren && !isExpanded && (
                                        <span className="text-xs bg-muted px-1.5 rounded-full text-muted-foreground">
                                            {node.children.length} 子任務
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <a
                                        href={formatRedmineIssueUrl(redmineUrl, node.redmine_issue_id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-primary transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                        title="在 Redmine 中開啟"
                                    >
                                        #{node.redmine_issue_id}
                                    </a>
                                    <span>•</span>
                                    <span>{node.project_name}</span>
                                    <span>•</span>
                                    <StatusSelect
                                        currentStatusId={node.status_id}
                                        currentStatusName={node.status}
                                        onStatusChange={async (statusId) => {
                                            try {
                                                const updated = await api.patch<TrackedTask>(`/tracked-tasks/${node.id}/status`, { status_id: statusId });
                                                setTasks(prev => prev.map(t => t.id === node.id ? updated : t));
                                            } catch (e) {
                                                console.error("Status update failed", e);
                                            }
                                        }}
                                    />
                                    {node.parent && <span className="text-xs bg-muted/50 text-muted-foreground px-1 rounded ml-1">Parent: #{node.parent.id}</span>}
                                    <TaskMetaInfo
                                        estimated_hours={node.estimated_hours}
                                        spent_hours={node.spent_hours}
                                        status={status}
                                    />
                                    {(node.assigned_to_name) && (
                                        <span className="text-xs text-muted-foreground/70 ml-2" title="被指派者">
                                            👤 {node.assigned_to_name}
                                        </span>
                                    )}
                                    {(node.author_name) && (
                                        <span className="text-xs text-muted-foreground/70 ml-1" title="建立者">
                                            📝 {node.author_name}
                                        </span>
                                    )}
                                    {node.custom_group && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                            {node.custom_group}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setEditingTask(node)}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                                title="查看詳情與筆記"
                            >
                                <Edit2 className="h-4 w-4" />
                            </button>
                            {/* Group Edit etc omitted for tree view simplicity, or add them back if needed. Keeping it simple first. */}
                            <button
                                onClick={() => handleRemove(node.id)}
                                className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                                title="移除追蹤"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => startTimer(node.redmine_issue_id)}
                                className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                title="開始計時"
                            >
                                <Play className="h-4 w-4 fill-current" />
                            </button>
                        </div>
                    </div>

                    {/* Related Tasks (from parsed JSON) */}
                    {
                        (() => {
                            if (!node.relations) return null;
                            try {
                                const relations = JSON.parse(node.relations) as Relation[];
                                if (!relations || relations.length === 0) return null;

                                return (
                                    <div className="pl-6 border-l-2 border-indigo-500/30 ml-3 space-y-1 mt-1">
                                        <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                            <Network className="h-3 w-3" />
                                            相關任務 ({relations.length})
                                        </div>
                                        {relations.map(rel => (
                                            <div key={rel.id} className="flex items-center gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors border border-dashed border-indigo-200 dark:border-indigo-800">
                                                {/* Relation Type Badge */}
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                                    {rel.relation_type || 'related'}
                                                </span>

                                                <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                                                    <a
                                                        href={formatRedmineIssueUrl(redmineUrl, rel.id)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium hover:underline hover:text-primary transition-colors text-foreground"
                                                    >
                                                        #{rel.id}
                                                    </a>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className="truncate text-foreground/90" title={rel.subject}>
                                                        {rel.subject}
                                                    </span>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-xs ${rel.status === 'Closed' || rel.status === 'Resolved'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        }`}>
                                                        {rel.status}
                                                    </span>

                                                    {/* Detailed Info Row */}
                                                    <span className="text-xs text-muted-foreground flex items-center gap-2 ml-2">
                                                        {rel.estimated_hours && (
                                                            <span>Est: {rel.estimated_hours}h</span>
                                                        )}
                                                        {rel.updated_on && (
                                                            <span>
                                                                {formatDistanceToNow(new Date(rel.updated_on), { addSuffix: true, locale: zhTW })}
                                                            </span>
                                                        )}
                                                        {rel.author_name && (
                                                            <span className="flex items-center gap-1" title={`Author: ${rel.author_name}`}>
                                                                📝 {rel.author_name}
                                                            </span>
                                                        )}
                                                        {rel.assigned_to_name && (
                                                            <span className="flex items-center gap-1" title={`Assigned: ${rel.assigned_to_name}`}>
                                                                👤 {rel.assigned_to_name}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            } catch (e) {
                                console.error('Failed to parse relations', e);
                                return null;
                            }
                        })()
                    }

                    {/* Children */}
                    {
                        hasChildren && isExpanded && (
                            <div className="pl-6 border-l-2 border-muted/30 ml-3 space-y-2">
                                {renderTreeNodes(node.children)}
                            </div>
                        )
                    }
                </div >
            );
        });
    };

    // Calculate stats per group
    interface GroupStats {
        total: number;
        warning: number;
        severe: number;
    }

    // 分組邏輯
    const groupedData = tasks.reduce<Record<string, { tasks: TrackedTask[], stats: GroupStats }>>((acc, task) => {
        let key: string;
        switch (groupBy) {
            case 'project':
                key = task.project_name;
                break;
            case 'status':
                key = task.status;
                break;
            case 'custom':
                key = task.custom_group || '未分類';
                break;
            default:
                key = 'Other';
        }

        if (!acc[key]) {
            acc[key] = {
                tasks: [],
                stats: { total: 0, warning: 0, severe: 0 }
            };
        }

        acc[key].tasks.push(task);
        acc[key].stats.total++;

        const status = getTaskStatus(task);
        if (status === 'warning') acc[key].stats.warning++;
        if (status === 'severe') acc[key].stats.severe++;

        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">追蹤任務</h2>
                <div className="flex items-center gap-2">
                    {/* Group By Selector */}
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="px-2 py-1 text-sm border rounded bg-background"
                    >
                        <option value="project">依專案</option>
                        <option value="status">依狀態</option>
                        <option value="custom">依自訂分組</option>
                    </select>

                    {/* Sync Button */}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
                        title="同步狀態"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    </button>

                    <div className="flex items-center border rounded overflow-hidden ml-2">
                        <button
                            onClick={expandAllTree}
                            className="p-2 hover:bg-muted border-r"
                            title="全部展開"
                        >
                            <ChevronsDown className="h-4 w-4" />
                        </button>
                        <button
                            onClick={collapseAllTree}
                            className="p-2 hover:bg-muted"
                            title="全部收合"
                        >
                            <ChevronsUp className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {
                error && (
                    <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                        {error}
                    </div>
                )
            }

            {/* Task Groups */}
            {
                Object.keys(groupedData).length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(groupedData).map(([groupName, { tasks: groupTasks, stats }]) => (
                            <div key={groupName} className="space-y-2">
                                {/* Group Header */}
                                <div
                                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => toggleGroup(groupName)}
                                >
                                    {expandedGroups.has(groupName) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {groupBy === 'project' && <FolderOpen className="h-4 w-4" />}
                                    {groupBy === 'status' && <CheckCircle className="h-4 w-4" />}
                                    {groupBy === 'custom' && <Tag className="h-4 w-4" />}
                                    <span>{groupName}</span>
                                    <TaskGroupStats
                                        stats={stats}
                                        warningDays={warningDays}
                                        severeDays={severeDays}
                                    />
                                </div>

                                {/* Tasks */}
                                {expandedGroups.has(groupName) && (
                                    <div className="grid gap-2">
                                        <div className="mt-2">
                                            {renderTreeNodes(buildTaskTree(groupTasks))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        尚無追蹤任務。點擊「匯入任務」開始追蹤。
                    </div>
                )
            }
            {
                editingTask && (
                    <RedmineTaskDetailModal
                        taskId={editingTask.redmine_issue_id}
                        subject={editingTask.subject}
                        onClose={() => setEditingTask(null)}
                        onUpdate={() => {
                            handleSync(); // Refresh details by syncing if needed, or just let user manually refresh
                            // Actually better to just close, stats might update on next sync
                        }}
                    />
                )
            }
        </div >
    );
}
