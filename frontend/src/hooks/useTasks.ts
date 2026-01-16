import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export interface RedmineTask {
    id: number;
    subject: string;
    project_name: string;
    status_name: string;
    updated_on: string;
}

export function useTasks() {
    const [tasks, setTasks] = useState<RedmineTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            // Mock headers for now
            const headers = {
                'X-Redmine-Url': 'https://redmine.org', // Mock
                'X-Redmine-Key': 'mock' // Mock
            };
            // In real implementation, these come from backend DB via auth or middleware
            // But for MVP Stage 1 without Settings page fully wired, we might fail auth?
            // Wait, 1.1 said "Login, Task List API".
            // Backend expects Headers for /tasks/.
            // But we should use stored credentials if available?
            // For now, let's assume we need to pass them.
            // Or if Backend 1.1 implemented it to read from DB? 
            // Viewed code says: "Depends(get_redmine_service)" -> reads Headers.
            // So Frontend MUST send headers.
            // Since 1.6 Settings is not done, we have no credentials.
            // I will implement a temporary hardcoded credential or fail gracefully.

            const res = await fetch(`${API_BASE}/tasks/`, { headers });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            } else {
                setError("Failed to fetch tasks");
            }
        } catch (e) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    return { tasks, loading, error, refresh: fetchTasks };
}
