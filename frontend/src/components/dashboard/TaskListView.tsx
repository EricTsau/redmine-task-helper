import { useState } from 'react';
import { useTasks, type Task } from '@/hooks/useTasks';
import { Play, RefreshCw, FolderOpen, CheckCircle, Loader2 } from 'lucide-react';

interface TaskListViewProps {
    startTimer: (id: number, comment?: string) => void;
}

type GroupBy = 'project' | 'status' | 'none';

export function TaskListView({ startTimer }: TaskListViewProps) {
    const { tasks, loading, error, refresh } = useTasks();
    const [groupBy, setGroupBy] = useState<GroupBy>('project');
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
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
    }, {});

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
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                {groupBy === 'project' && <FolderOpen className="h-4 w-4" />}
                                {groupBy === 'status' && <CheckCircle className="h-4 w-4" />}
                                <span>{groupName}</span>
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {groupTasks.length}
                                </span>
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

                {tasks.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                        Redmine 中目前沒有分配給您的開啟任務。
                    </div>
                )}
            </div>
        </div>
    );
}
