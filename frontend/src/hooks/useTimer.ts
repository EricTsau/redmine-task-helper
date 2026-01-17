import { useState, useEffect, useCallback } from 'react';

import { api } from '@/lib/api';

export interface TimeEntry {
    id: number;
    issue_id: number;
    start_time: string;
    duration: number;
    status: 'running' | 'paused' | 'stopped';
    is_running: boolean; // Computed or from backend
    content?: string;
}

export function useTimer() {
    const [timer, setTimer] = useState<TimeEntry | null>(null);
    const [elapsed, setElapsed] = useState(0);

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
        }
    }, []);

    const startTimer = async (issueId: number, comment?: string) => {
        try {
            await api.post('/timer/start', { issue_id: issueId, comment });
            fetchTimer();
        } catch (error) {
            console.error('Failed to start timer:', error);
        }
    };

    const pauseTimer = async () => {
        try {
            await api.post('/timer/pause');
            fetchTimer();
        } catch (error) {
            console.error('Failed to pause timer:', error);
        }
    }

    const stopTimer = async (comment?: string) => {
        try {
            await api.post('/timer/stop', { comment });
            setTimer(null);
            setElapsed(0);
        } catch (error: any) {
            if (error.response && error.response.status === 404) {
                // If timer was not found (e.g., already stopped or never started),
                // we can consider it stopped from the client's perspective.
                setTimer(null);
                setElapsed(0);
            } else {
                console.error('Failed to stop timer:', error);
            }
        }
    };

    const updateLog = async (content: string) => {
        try {
            await api.post('/timer/log/update', { content });
            // Optimistic update
            if (timer) setTimer({ ...timer, content });
        } catch (e) {
            console.error("Failed to update draft", e);
        }
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
