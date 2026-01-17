import { useState, useEffect } from 'react';
import { useTasks, type Task } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import { Play, RefreshCw, FolderOpen, CheckCircle, Loader2, Plus } from 'lucide-react';
import { TaskCreateModal } from '../tasks/TaskCreateModal';

interface TaskListViewProps {
    startTimer: (id: number, comment?: string) => void;
}

type GroupBy = 'project' | 'status' | 'none';

export function TaskListView({ startTimer }: TaskListViewProps) {
    const { tasks, loading, error, refresh } = useTasks();
    const [groupBy, setGroupBy] = useState<GroupBy>('project');
    const [refreshing, setRefreshing] = useState(false);

    // Create Task Modal State
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createProjectCtx, setCreateProjectCtx] = useState<{ id: number; name: string } | null>(null);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    const [watchlist, setWatchlist] = useState<{ redmine_project_id: number; project_name: string }[]>([]);

    useEffect(() => {
        const fetchWatchlist = async () => {
            try {
                const res = await api.get<{ redmine_project_id: number; project_name: string }[]>('/watchlist');
                setWatchlist(res);
            } catch (e) {
                console.error("Failed to fetch watchlist", e);
            }
        };
        fetchWatchlist();
    }, []);

    // Helper to find project ID by name
    const getProjectIdByName = (name: string) => {
        return watchlist.find(p => p.project_name === name)?.redmine_project_id;
    };

    const openCreateModal = (projectName: string) => {
        const pid = getProjectIdByName(projectName);
        if (pid) {
            setCreateProjectCtx({ id: pid, name: projectName });
            setCreateModalOpen(true);
        }
    };

    // Grouping logic
    const groupedTasks = tasks.reduce<Record<string, Task[]>>((acc, task) => {
        let key: string;
        switch (groupBy) {
            case 'project':
                key = task.project_name;
                break;
            case 'status':
                key = task.status_name;
                break;
            default:
                key = 'All Tasks';
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
    }, groupBy === 'project'
        ? watchlist.reduce((acc, p) => ({ ...acc, [p.project_name]: [] }), {} as Record<string, Task[]>)
        : {});

    if (loading && !refreshing) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) return <div className="p-3 bg-destructive/10 text-destructive rounded-md">Error: {error}</div>;

    return (
        <div className="space-y-4">
            {/* Header / Controls */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">我的任務</h2>
                <div className="flex items-center gap-2">
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="px-2 py-1 text-sm border rounded bg-background"
                    >
                        <option value="project">依專案</option>
                        <option value="status">依狀態</option>
                        <option value="none">無分組</option>
                    </select>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
                        title="從 Redmine 刷新"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-6">
                {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
                    <div key={groupName} className="space-y-2">
                        {/* Group Header */}
                        {groupBy !== 'none' && (
                            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground border-b pb-1">
                                <div className="flex items-center gap-2">
                                    {groupBy === 'project' && <FolderOpen className="h-4 w-4" />}
                                    {groupBy === 'status' && <CheckCircle className="h-4 w-4" />}
                                    <span>{groupName}</span>
                                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                        {groupTasks.length}
                                    </span>
                                </div>

                                {/* Add Task Button (Only for Projects in Watchlist) */}
                                {groupBy === 'project' && getProjectIdByName(groupName) && (
                                    <button
                                        onClick={() => openCreateModal(groupName)}
                                        className="p-1 hover:bg-muted rounded hover:text-foreground transition-colors"
                                        title={`在 ${groupName} 新增任務`}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}

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
                                            #{task.id} • {task.project_name} • {task.status_name}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => startTimer(task.id)}
                                        className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="開始計時"
                                    >
                                        <Play className="h-4 w-4 fill-current" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {tasks.length === 0 && watchlist.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                        Redmine 中目前沒有分配給您的開啟任務。
                    </div>
                )}
            </div>

            {/* Create Task Modal */}
            {createProjectCtx && (
                <TaskCreateModal
                    isOpen={createModalOpen}
                    onClose={() => setCreateModalOpen(false)}
                    projectId={createProjectCtx.id}
                    projectName={createProjectCtx.name}
                    onTaskCreated={refresh}
                />
            )}
        </div>
    );
}
