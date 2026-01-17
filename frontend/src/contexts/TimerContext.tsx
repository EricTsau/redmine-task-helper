import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';

export interface TimeEntry {
    id: number;
    issue_id: number;
    start_time: string;
    duration: number;
    status: 'running' | 'paused' | 'stopped';
    is_running: boolean;
    content?: string;
}

interface TimerContextType {
    timer: TimeEntry | null;
    elapsed: number;
    startTimer: (issueId: number, comment?: string) => Promise<void>;
    pauseTimer: () => Promise<void>;
    stopTimer: (comment?: string) => Promise<void>;
    updateLog: (content: string) => Promise<void>;
    submitEntry: (sessionId?: number, comments?: string) => Promise<void>;
    refresh: () => Promise<void>;
    isLoading: boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
    const [timer, setTimer] = useState<TimeEntry | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTimer = useCallback(async () => {
        try {
            const data = await api.get<TimeEntry | null>('/timer/current');
            setTimer(data);
            if (data) {
                setElapsed(data.duration);
            } else {
                setElapsed(0);
            }
        } catch (e) {
            console.error("Failed to fetch timer", e);
            setTimer(null);
            setElapsed(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const startTimer = async (issueId: number, comment?: string) => {
        try {
            // Check if there is already a timer running. 
            // In the future, we can add the auto-submit logic here.
            await api.post('/timer/start', { issue_id: issueId, comment });
            await fetchTimer();
        } catch (error) {
            console.error('Failed to start timer:', error);
            throw error;
        }
    };

    const pauseTimer = async () => {
        try {
            await api.post('/timer/pause');
            await fetchTimer();
        } catch (error) {
            console.error('Failed to pause timer:', error);
            throw error;
        }
    };

    const stopTimer = async (comment?: string) => {
        try {
            await api.post('/timer/stop', { comment });
            setTimer(null);
            setElapsed(0);
        } catch (error: any) {
            if (error.response && error.response.status === 404) {
                setTimer(null);
                setElapsed(0);
            } else {
                console.error('Failed to stop timer:', error);
                throw error;
            }
        }
    };

    const updateLog = async (content: string) => {
        try {
            await api.post('/timer/log/update', { content });
            if (timer) setTimer({ ...timer, content });
        } catch (e) {
            console.error("Failed to update draft", e);
        }
    };

    const submitEntry = async (sessionId?: number, comments?: string) => {
        try {
            await api.post('/timer/submit', {
                session_id: sessionId,
                comments: comments
            });
            if (timer && (!sessionId || timer.id === sessionId)) {
                setTimer(null);
                setElapsed(0);
            }
        } catch (error) {
            console.error('Failed to submit entry:', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchTimer();
    }, [fetchTimer]);

    useEffect(() => {
        if (!timer || timer.status !== 'running') return;

        const interval = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [timer?.status]);

    return (
        <TimerContext.Provider value={{
            timer,
            elapsed,
            startTimer,
            pauseTimer,
            stopTimer,
            updateLog,
            submitEntry,
            refresh: fetchTimer,
            isLoading
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const context = useContext(TimerContext);
    if (context === undefined) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
}
