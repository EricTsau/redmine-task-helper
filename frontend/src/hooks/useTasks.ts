import { useState, useEffect, useCallback } from 'react';

import { api } from '@/lib/api';

export interface Task {
    id: number;
    subject: string;
    project_name: string;
    status_name: string;
    updated_on: string;
}

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            // For now, let's assume we need to pass them.
            // Or if Backend 1.1 implemented it to read from DB? 
            // Viewed code says: "Depends(get_redmine_service)" -> reads Headers.
            // So Frontend MUST send headers.
            // Since 1.6 Settings is not done, we have no credentials.
            // I will implement a temporary hardcoded credential or fail gracefully.
            const apiKey = 'mock'; // Temporary mock for X-Redmine-API-Key
            const headers: Record<string, string> = {};
            if (apiKey) headers['X-Redmine-API-Key'] = apiKey;

            const res = await api.get<Task[]>('/tasks', {}, { headers });

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
