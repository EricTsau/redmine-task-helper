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
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-700">
            {/* Immersive Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary active:scale-90 group"
                        title="Back to Nexus"
                    >
                        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="space-y-0.5">
                        <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">
                            Flow Execution
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Immersive Focus Protocol Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-tech-cyan/10 border border-tech-cyan/20 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-tech-cyan animate-pulse shadow-glow-cyan" />
                        <span className="text-[10px] font-black text-tech-cyan uppercase tracking-widest">Neural Sync: 100%</span>
                    </div>
                </div>
            </div>

            {/* Immersive Container */}
            <div className="flex-1 glass-card rounded-[40px] border-border/20 relative overflow-hidden flex flex-col p-8 md:p-12 shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tech-cyan via-tech-indigo to-tech-rose opacity-40" />

                <div className="flex-1 flex flex-col items-center justify-center">
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
            </div>
        </div>
    );
}
