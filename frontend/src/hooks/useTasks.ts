import { useState, useEffect, useCallback } from 'react';

import { api } from '@/lib/api';

export interface Task {
    id: number;
    subject: string;
    project_id: number;
    project_name: string;
    status_id: number;
    status_name: string;
    estimated_hours: number | null;
    spent_hours: number;
    updated_on: string;
    parent?: {
        id: number;
        subject: string;
    };
}

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Task[]>('/tasks');

            setTasks(res);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch tasks');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    return { tasks, loading, error, refresh: fetchTasks };
}
