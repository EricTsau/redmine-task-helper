import { useState, useEffect, useCallback } from 'react';

interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    body?: string;
    headers?: Record<string, string>;
    timestamp: number;
}

const QUEUE_KEY = 'offline_request_queue';

export function useOfflineQueue() {
    const [queue, setQueue] = useState<QueuedRequest[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Load queue from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(QUEUE_KEY);
        if (stored) {
            setQueue(JSON.parse(stored));
        }
    }, []);

    // Save queue to localStorage
    useEffect(() => {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }, [queue]);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Process queue when back online
    useEffect(() => {
        if (isOnline && queue.length > 0) {
            processQueue();
        }
    }, [isOnline]);

    const addToQueue = useCallback((request: Omit<QueuedRequest, 'id' | 'timestamp'>) => {
        const newRequest: QueuedRequest = {
            ...request,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };
        setQueue(prev => [...prev, newRequest]);
        return newRequest.id;
    }, []);

    const processQueue = useCallback(async () => {
        const pending = [...queue];

        for (const req of pending) {
            try {
                await fetch(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                });
                setQueue(prev => prev.filter(r => r.id !== req.id));
            } catch (e) {
                console.error('Failed to process queued request:', req.id);
                // Keep in queue for retry
            }
        }
    }, [queue]);

    const fetchWithOffline = useCallback(async (
        url: string,
        options: RequestInit = {}
    ): Promise<Response | null> => {
        if (isOnline) {
            return fetch(url, options);
        } else {
            // Queue for later
            addToQueue({
                url,
                method: options.method || 'GET',
                body: options.body as string,
                headers: options.headers as Record<string, string>
            });
            return null;
        }
    }, [isOnline, addToQueue]);

    return {
        isOnline,
        queue,
        addToQueue,
        fetchWithOffline,
        pendingCount: queue.length
    };
}
