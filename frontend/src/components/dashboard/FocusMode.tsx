import { WorkLogEditor } from '@/components/timer/WorkLogEditor';
import { useTimer, type TimeEntry } from '@/hooks/useTimer';
import { Timer } from '@/components/timer/Timer';
import { Square } from 'lucide-react';

interface FocusModeProps {
    timer: TimeEntry;
    stopTimer: () => void;
}

export function FocusMode({ timer, stopTimer }: FocusModeProps) {
    const { updateLog, submitEntry } = useTimer();

    const handleStopAndSubmit = async (contentToSubmit?: string) => {
        try {
            // 1. Ensure latest content is saved if passed, otherwise use timer's current content
            // The editor passes the latest content when clicking its submit button
            const finalContent = contentToSubmit ?? timer.content;

            if (contentToSubmit) {
                await updateLog(contentToSubmit);
            }

            // 2. Stop the timer first (backend returns the stopped session)
            stopTimer();

            // Wait a bit or we need stopTimer to return the session or ID?
            // stopTimer in useTimer calls /stop, then sets state to null.
            // We need the ID. FocusMode props 'timer' has the ID.
            const sessionId = timer.id;

            // 3. Submit to Redmine
            // We adding a small delay or retrying might be safer if stop is async race, 
            // but here we just fire submit. The backend /submit endpoint handles "stopped" sessions lookup if ID provided.
            await submitEntry(sessionId, finalContent);

            // UI should close automatically because timer state becomes null/stopped in parent
        } catch (e) {
            console.error("Stop and Submit failed", e);
            alert("Failed to submit to Redmine. Timer stopped.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background overflow-auto flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-bold tracking-tight">Focusing on Task #{timer.issue_id}</h2>
                <p className="text-muted-foreground text-lg">Keep up the momentum!</p>
            </div>

            <div className="scale-150 transform p-8 mb-8">
                <Timer />
            </div>

            <button
                onClick={() => handleStopAndSubmit()}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg mb-8"
                title="Stop Timer & Submit to Redmine"
            >
                <Square className="h-5 w-5 fill-current" />
                Stop & Submit
            </button>

            <div className="w-full max-w-4xl p-6 bg-muted/30 rounded-lg border h-[500px] flex flex-col">
                <h3 className="font-semibold mb-4">Notes</h3>
                <div className="flex-1 overflow-hidden">
                    <WorkLogEditor
                        initialContent={timer.content || ''}
                        onUpdate={(c) => updateLog(c)}
                        onSubmit={(c) => handleStopAndSubmit(c)}
                    />
                </div>
            </div>
        </div>
    );
}
