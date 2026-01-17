import { useState } from 'react';
import { Square, Play, Pause, Upload } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer';


const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function Timer() {
    const { timer, elapsed, startTimer, pauseTimer, stopTimer } = useTimer();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!timer) return null;

    const handleTogglePause = () => {
        if (timer.status === 'running') {
            pauseTimer();
        } else {
            // Resume
            startTimer(timer.issue_id);
        }
    };

    const handleStop = async () => {
        setIsSubmitting(true);
        try {
            await stopTimer();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSync = async () => {
        setIsSubmitting(true);
        try {
            const redmineKey = localStorage.getItem('redmine_api_key');
            // const redmineUrl = JSON.parse(localStorage.getItem('app-settings') || '{}').redmine_url;

            // We might need a proper way to get settings if not in localStorage easily or use a hook
            // For MVP assuming we have access or fetching settings
            const settingsRes = await fetch('http://127.0.0.1:8000/api/v1/settings');
            const settingsData = await settingsRes.json();

            const res = await fetch('http://127.0.0.1:8000/api/v1/timer/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Redmine-Url': settingsData.redmine_url,
                    'X-Redmine-Key': redmineKey || ''
                },
                body: JSON.stringify({ session_id: timer.id })
            });

            if (res.ok) {
                alert('Time logged to Redmine!');
                // Logic to clear timer from view or refresh
            } else {
                alert('Failed to submit to Redmine.');
            }
        } catch (e) {
            console.error(e);
            alert('Error submitting');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-card border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden transition-all">
            {/* Header / StatusBar */}
            <div className="flex items-center justify-between p-4 bg-muted/30">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {timer.status === 'paused' ? 'Paused' : 'Running'} #{timer.issue_id}
                    </span>
                    <span className={`text-3xl font-mono font-bold ${timer.status === 'paused' ? 'text-yellow-500' : 'text-primary'}`}>
                        {formatDuration(elapsed)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTogglePause}
                        className={`p-3 rounded-full transition-colors ${timer.status === 'paused' ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}`}
                        title={timer.status === 'running' ? "Pause" : "Resume"}
                    >
                        {timer.status === 'running' ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={isSubmitting}
                        className="p-3 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                        title="Stop"
                    >
                        <Square className="h-5 w-5 fill-current" />
                    </button>
                    {timer.status === 'stopped' && (
                        <button
                            onClick={handleSync}
                            disabled={isSubmitting}
                            className="p-3 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                            title="Sync to Redmine"
                        >
                            <Upload className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
