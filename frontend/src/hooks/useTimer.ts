import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export interface TimerState {
    id: number;
    issue_id: number;
    start_time: string;
    duration: number;
    status: 'running' | 'paused' | 'stopped';
    is_running: boolean; // Computed or from backend
    content?: string;
}

export function useTimer() {
    const [timer, setTimer] = useState<TimerState | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const fetchTimer = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/timer/current`);
            if (res.ok) {
                const data = await res.json();
                // Data from backend: { ..., is_running, status, duration }
                // Duration from backend is Total so far.
                // If running, we need to add local drift.
                setTimer(data);
                if (data) {
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
            fetchTimer();
        }
    };

    const pauseTimer = async () => {
        const res = await fetch(`${API_BASE}/timer/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
            fetchTimer();
        }
    }

    const stopTimer = async (comment?: string) => {
        const res = await fetch(`${API_BASE}/timer/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        });

        if (res.ok || res.status === 404) {
            setTimer(null);
            setElapsed(0);
        }
    };

    const updateLog = async (content: string) => {
        await fetch(`${API_BASE}/timer/log/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        // Optimistic update
        if (timer) setTimer({ ...timer, content });
    }

    // Initial fetch - runs once on mount
    useEffect(() => {
        fetchTimer();
    }, [fetchTimer]);

    // Elapsed time interval
    useEffect(() => {
        if (!timer || timer.status !== 'running') return;

        // We rely on backend 'duration' as the base, and add seconds since 'now' ?
        // Actually, backend calculates duration = stored + (now - last_span_start).
        // But the 'duration' in 'timer' state is static from the time of fetch.
        // We need to know WHEN the 'fetch' happened or calculate local diff.
        // For simplicity: We can just Increment 'elapsed' every second if running.
        // Periodic sync (fetchTimer) corrects drift.

        const interval = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [timer?.status]);

    return { timer, elapsed, startTimer, pauseTimer, stopTimer, updateLog, refresh: fetchTimer };
}
