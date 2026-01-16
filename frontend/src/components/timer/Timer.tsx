import { Square } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer';

// Helper for formatting duration
const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function Timer() {
    const { timer, elapsed, stopTimer } = useTimer();

    if (!timer || !timer.is_running) {
        return null; // Don't show if not running (or show placeholder?)
    }

    return (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card shadow-sm">
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Running Task #{timer.issue_id}</span>
                <span className="text-2xl font-mono font-bold text-primary">
                    {formatDuration(elapsed)}
                </span>
            </div>
            <button
                onClick={() => stopTimer()}
                className="ml-auto p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
            >
                <Square className="h-5 w-5 fill-current" />
            </button>
        </div>
    );
}
