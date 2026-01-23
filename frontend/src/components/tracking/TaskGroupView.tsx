/**
 * TaskGroupView - 追蹤任務分組檢視
 * 支援依 Project / Status / Custom Group 分類
 */
import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, Trash2, Tag, FolderOpen, CheckCircle, Loader2, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Network, Edit2, List } from 'lucide-react';

import { api } from '@/lib/api';
import { getTaskHealthStatus, getTaskHealthColorClass, type TaskHealthStatus } from '../tasks/taskUtils';
import { TaskMetaInfo } from '../tasks/TaskMetaInfo';
import { TaskGroupStats } from '../tasks/TaskGroupStats';
import { RedmineTaskDetailModal } from '../tasks/RedmineTaskDetailModal';

interface TrackedTask {
    id: number;
    redmine_issue_id: number;
    project_id: number;
    project_name: string;
    subject: string;
    status: string;
    estimated_hours: number | null;
    spent_hours: number;
    updated_on: string | null;
    assigned_to_id: number | null;
    assigned_to_name: string | null;
    custom_group: string | null;
    last_synced_at: string | null;
    created_at: string;
    parent?: {
        id: number;
        subject: string;
    };
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
    const [editingGroup, setEditingGroup] = useState<number | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
    const [editingTask, setEditingTask] = useState<TrackedTask | null>(null);

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

    const expandAll = () => {
        const allGroups = new Set(Object.keys(groupedData));
        setExpandedGroups(allGroups);
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
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
        loadTasks();
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

    const handleUpdateGroup = async (taskId: number, group: string | null) => {
        try {
            const updated = await api.patch<TrackedTask>(`/tracked-tasks/${taskId}/group`, {
                custom_group: group || ''
            });
            setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
            setEditingGroup(null);
            setNewGroupName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : '更新分組失敗');
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
        flatTasks.forEach(t => taskMap.set(t.redmine_issue_id, { ...t, children: [] }));

        const roots: (TrackedTask & { children: any[] })[] = [];

        flatTasks.forEach(t => {
            const node = taskMap.get(t.redmine_issue_id)!;
            // Check if parent exists in our tracked list
            if (t.parent && taskMap.has(t.parent.id)) {
                taskMap.get(t.parent.id)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    const renderTreeNodes = (nodes: (TrackedTask & { children: any[] })[]) => {
        return nodes.map(node => {
            const status = getTaskStatus(node);
            const bgClass = getTaskHealthColorClass(status);

            return (
                <div key={node.id} className="tree-node-container space-y-2">
                    <div
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${bgClass}`}
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="font-medium truncate">{node.subject}</div>
                                {node.children.length > 0 && (
                                    <span className="text-xs bg-muted px-1.5 rounded-full text-muted-foreground">
                                        {node.children.length} 子任務
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>#{node.redmine_issue_id}</span>
                                <span>•</span>
                                <span>{node.project_name}</span>
                                <span>•</span>
                                <span>{node.status}</span>
                                {node.parent && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded ml-1">Parent: #{node.parent.id}</span>}
                                <TaskMetaInfo
                                    estimated_hours={node.estimated_hours}
                                    spent_hours={node.spent_hours}
                                    updated_on={node.updated_on}
                                    status={status}
                                />
                                {node.custom_group && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                        {node.custom_group}
                                    </span>
                                )}
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
                    {/* Children */}
                    {node.children.length > 0 && (
                        <div className="pl-6 border-l-2 border-muted/30 ml-3 space-y-2">
                            {renderTreeNodes(node.children)}
                        </div>
                    )}
                </div>
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

                    {/* Expand/Collapse All */}
                    <div className="flex items-center border rounded overflow-hidden">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 ${viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted'} border-r`}
                            title="列表檢視"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('tree')}
                            className={`p-2 ${viewMode === 'tree' ? 'bg-muted' : 'hover:bg-muted'}`}
                            title="樹狀檢視"
                        >
                            <Network className="h-4 w-4" />
                        </button>
                    </div>

                    {viewMode === 'list' && (
                        <div className="flex items-center border rounded overflow-hidden ml-2">
                            <button
                                onClick={expandAll}
                                className="p-2 hover:bg-muted border-r"
                                title="全部展開"
                            >
                                <ChevronsDown className="h-4 w-4" />
                            </button>
                            <button
                                onClick={collapseAll}
                                className="p-2 hover:bg-muted"
                                title="全部收合"
                            >
                                <ChevronsUp className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            {/* Task Groups */}
            {Object.keys(groupedData).length > 0 ? (
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
                                    {viewMode === 'tree' && groupBy === 'project' ? (
                                        <div className="mt-2">
                                            {renderTreeNodes(buildTaskTree(groupTasks))}
                                        </div>
                                    ) : (
                                        groupTasks.map(task => {
                                            const status = getTaskStatus(task);
                                            const bgClass = getTaskHealthColorClass(status);

                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${bgClass}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{task.subject}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            #{task.redmine_issue_id} • {task.project_name} • {task.status}
                                                            <TaskMetaInfo
                                                                estimated_hours={task.estimated_hours}
                                                                spent_hours={task.spent_hours}
                                                                updated_on={task.updated_on}
                                                                status={status}
                                                            />
                                                            {task.custom_group && (
                                                                <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                                                    {task.custom_group}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setEditingTask(task)}
                                                            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                                                            title="查看詳情與筆記"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        {/* Edit Group */}
                                                        {editingGroup === task.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={newGroupName}
                                                                    onChange={(e) => setNewGroupName(e.target.value)}
                                                                    placeholder="分組名稱"
                                                                    className="px-2 py-1 text-sm border rounded w-24"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleUpdateGroup(task.id, newGroupName);
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingGroup(null);
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => handleUpdateGroup(task.id, newGroupName)}
                                                                    className="p-1 hover:bg-muted rounded"
                                                                >
                                                                    <CheckCircle className="h-4 w-4 text-primary" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingGroup(task.id);
                                                                    setNewGroupName(task.custom_group || '');
                                                                }}
                                                                className="p-1.5 hover:bg-muted rounded"
                                                                title="設定分組"
                                                            >
                                                                <Tag className="h-4 w-4" />
                                                            </button>
                                                        )}

                                                        {/* Remove */}
                                                        <button
                                                            onClick={() => handleRemove(task.id)}
                                                            className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                                                            title="移除追蹤"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>

                                                        {/* Start Timer */}
                                                        <button
                                                            onClick={() => startTimer(task.redmine_issue_id)}
                                                            className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                                            title="開始計時"
                                                        >
                                                            <Play className="h-4 w-4 fill-current" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-8">
                    尚無追蹤任務。點擊「匯入任務」開始追蹤。
                </div>
            )}
            {editingTask && (
                <RedmineTaskDetailModal
                    taskId={editingTask.redmine_issue_id}
                    subject={editingTask.subject}
                    onClose={() => setEditingTask(null)}
                    onUpdate={() => {
                        handleSync(); // Refresh details by syncing if needed, or just let user manually refresh
                        // Actually better to just close, stats might update on next sync
                    }}
                />
            )}
        </div>
    );
}
