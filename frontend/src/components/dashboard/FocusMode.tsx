import type { TimerState } from '@/hooks/useTimer';
import { Timer } from '@/components/timer/Timer';
import { Square } from 'lucide-react';

interface FocusModeProps {
    timer: TimerState;
    stopTimer: () => void;
}

export function FocusMode({ timer, stopTimer }: FocusModeProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Focusing on Task #{timer.issue_id}</h2>
                <p className="text-muted-foreground text-lg">Keep up the momentum!</p>
            </div>

            <div className="scale-150 transform p-8">
                <Timer />
            </div>

            <button
                onClick={stopTimer}
                className="flex items-center gap-2 px-6 py-3 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-all shadow-lg"
            >
                <Square className="h-5 w-5 fill-current" />
                Stop Timer
            </button>

            <div className="w-full max-w-md p-6 bg-muted/30 rounded-lg border">
                <h3 className="font-semibold mb-2">Notes</h3>
                <textarea
                    className="w-full min-h-[100px] p-2 bg-background border rounded resize-none"
                    placeholder="Jot down notes, next steps..."
                    defaultValue={timer.comment}
                />
            </div>
        </div>
    );
}
