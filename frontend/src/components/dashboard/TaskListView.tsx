import { useTasks } from '@/hooks/useTasks';
import { Play } from 'lucide-react';

interface TaskListViewProps {
    startTimer: (id: number, comment?: string) => void;
}

export function TaskListView({ startTimer }: TaskListViewProps) {
    const { tasks, loading, error } = useTasks();

    if (loading) return <div>Loading tasks...</div>;
    if (error) return <div className="text-destructive">Error: {error}</div>;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">My Tasks</h2>
            <div className="grid gap-4">
                {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                        <div className="space-y-1">
                            <div className="font-semibold">{task.subject}</div>
                            <div className="text-sm text-muted-foreground">
                                {task.project_name} • #{task.id} • {task.status_name}
                            </div>
                        </div>
                        <button
                            onClick={() => startTimer(task.id)}
                            className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                            title="Start Timer"
                        >
                            <Play className="h-4 w-4 fill-current" />
                        </button>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="text-muted-foreground">No tasks assigned to you.</div>
                )}
            </div>
        </div>
    );
}
