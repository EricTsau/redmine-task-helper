import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export interface TimerState {
    id: number;
    issue_id: number;
    start_time: string;
    duration: number;
    is_running: boolean;
    comment?: string;
}

export function useTimer() {
    const [timer, setTimer] = useState<TimerState | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const fetchTimer = useCallback(async () => {
        try {
            // TODO: Add Auth Headers
            const res = await fetch(`${API_BASE}/timer/current`);
            if (res.ok) {
                const data = await res.json();
                setTimer(data);
                if (data && data.is_running) {
                    setElapsed(data.duration);
                }
            } else {
                setTimer(null);
            }
        } catch (e) {
            console.error("Failed to fetch timer", e);
        }
    }, []);

    const startTimer = async (issueId: number, comment?: string) => {
        const res = await fetch(`${API_BASE}/timer/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issue_id: issueId, comment })
        });
        if (res.ok) {
            const data = await res.json();
            setTimer(data);
            setElapsed(0);
        }
    };

    const stopTimer = async (comment?: string) => {
        const res = await fetch(`${API_BASE}/timer/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        });
        if (res.ok) {
            // const data = await res.json();
            setTimer(null);
            setElapsed(0);
        }
    };

    // Initial fetch - runs once on mount
    useEffect(() => {
        fetchTimer();
    }, [fetchTimer]);

    // Elapsed time interval - depends on timer state
    useEffect(() => {
        if (!timer?.is_running || !timer.start_time) return;

        const interval = setInterval(() => {
            const startTime = new Date(timer.start_time + "Z").getTime();
            const now = new Date().getTime();
            const diff = Math.floor((now - startTime) / 1000);
            setElapsed(diff > 0 ? diff : 0);
        }, 1000);

        return () => clearInterval(interval);
    }, [timer?.is_running, timer?.start_time]);

    // Re-sync on tab focus?

    return { timer, elapsed, startTimer, stopTimer, refresh: fetchTimer };
}
