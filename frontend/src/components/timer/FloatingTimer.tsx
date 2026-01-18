import { useTimer } from '@/contexts/TimerContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Play, Pause } from 'lucide-react';

import { useDraggable } from '@/hooks/useDraggable';

export function FloatingTimer() {
    const { timer, elapsed, pauseTimer, startTimer } = useTimer();
    const navigate = useNavigate();
    const location = useLocation();

    // Initial position approximation (bottom-6 left-[17.5rem])
    // 17.5rem = 280px. 
    // We'll use a safe default and let the user adjust.
    const { position, handleMouseDown } = useDraggable({
        initialPosition: { x: 280, y: window.innerHeight - 80 },
        storageKey: 'floating-timer-position'
    });

    if (!timer || timer.status === 'stopped' || location.pathname === '/focus') {
        return null;
    }

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isRunning = timer.status === 'running';

    return (
        <div
            className="fixed z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleMouseDown}
        >
            <div
                className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg cursor-pointer hover:ring-2 ring-primary/20 transition-all border border-primary-foreground/10 group"
                onClick={() => navigate('/focus')}
            >
                <div className={`p-1.5 rounded-full ${isRunning ? 'bg-primary-foreground/20 animate-pulse' : 'bg-primary-foreground/10'}`}>
                    <Clock className="w-4 h-4" />
                </div>

                <div className="flex flex-col min-w-[80px]">
                    <span className="text-[10px] leading-tight opacity-70 font-medium">任務 #{timer.issue_id}正在計時</span>
                    <span className="text-sm font-mono font-bold tabular-nums">
                        {formatDuration(elapsed)}
                    </span>
                </div>

                <div className="flex gap-1 ml-1 border-l border-primary-foreground/20 pl-3">
                    {isRunning ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                pauseTimer();
                            }}
                            className="p-1.5 hover:bg-primary-foreground/20 rounded-full transition-colors"
                            title="暫停"
                        >
                            <Pause className="w-4 h-4 fill-current" />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                startTimer(timer.issue_id);
                            }}
                            className="p-1.5 hover:bg-primary-foreground/20 rounded-full transition-colors"
                            title="繼續"
                        >
                            <Play className="w-4 h-4 fill-current" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
