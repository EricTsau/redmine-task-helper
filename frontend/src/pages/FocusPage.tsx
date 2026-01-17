import { useTimer } from '@/contexts/TimerContext';
import { FocusMode } from '@/components/dashboard/FocusMode';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function FocusPage() {
    const { timer, elapsed, pauseTimer, startTimer, stopTimer, updateLog, submitEntry, isLoading } = useTimer();
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading timer...</p>
            </div>
        );
    }

    if (!timer || timer.status === 'stopped') {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-6 text-center px-4">
                <h2 className="text-xl font-semibold">目前沒有正在進行的計時</h2>
                <p className="text-muted-foreground max-w-md">
                    前往首頁並點擊任務開始計時
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回任務列表
                </button>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)]">
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    title="返回"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-medium">Focus Mode</h1>
            </div>

            <FocusMode
                timer={timer}
                elapsed={elapsed}
                onPause={pauseTimer}
                onResume={startTimer}
                onStop={stopTimer}
                onUpdateLog={updateLog}
                onSubmit={submitEntry}
            />
        </div>
    );
}
