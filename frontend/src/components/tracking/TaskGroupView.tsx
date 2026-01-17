/**
 * TaskGroupView - 追蹤任務分組檢視
 * 支援依 Project / Status / Custom Group 分類
 */
import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, Trash2, Tag, FolderOpen, CheckCircle, Loader2 } from 'lucide-react';

import { api } from '@/lib/api';

interface TrackedTask {
    id: number;
    redmine_issue_id: number;
    project_id: number;
    project_name: string;
    subject: string;
    status: string;
    assigned_to_id: number | null;
    assigned_to_name: string | null;
    custom_group: string | null;
    last_synced_at: string | null;
    created_at: string;
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

    const loadTasks = useCallback(async () => {
        try {
            const res = await api.get<TrackedTask[]>('/tracked-tasks/');
            setTasks(res);
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
            const updated = await api.patch<TrackedTask>(`/tracked-tasks/${taskId}/group`, null, {
                params: { custom_group: group || '' }
            });
            setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
            setEditingGroup(null);
            setNewGroupName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : '更新分組失敗');
        }
    };

    // 分組邏輯
    const groupedTasks = tasks.reduce<Record<string, TrackedTask[]>>((acc, task) => {
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
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
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
                </div>
            </div>

            {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            {/* Task Groups */}
            {Object.keys(groupedTasks).length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
                        <div key={groupName} className="space-y-2">
                            {/* Group Header */}
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                {groupBy === 'project' && <FolderOpen className="h-4 w-4" />}
                                {groupBy === 'status' && <CheckCircle className="h-4 w-4" />}
                                {groupBy === 'custom' && <Tag className="h-4 w-4" />}
                                <span>{groupName}</span>
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {groupTasks.length}
                                </span>
                            </div>

                            {/* Tasks */}
                            <div className="grid gap-2">
                                {groupTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{task.subject}</div>
                                            <div className="text-sm text-muted-foreground">
                                                #{task.redmine_issue_id} • {task.project_name} • {task.status}
                                                {task.custom_group && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                                        {task.custom_group}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-8">
                    尚無追蹤任務。點擊「匯入任務」開始追蹤。
                </div>
            )}
        </div>
    );
}
