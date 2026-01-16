import { useEffect, useCallback } from 'react';

interface UsePasteUploadOptions {
    issueId?: number;
    onUpload?: (result: { filename: string }) => void;
    onError?: (error: string) => void;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function usePasteUpload({ issueId, onUpload, onError }: UsePasteUploadOptions) {
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        if (!issueId) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const formData = new FormData();
                formData.append('file', file, `pasted-image-${Date.now()}.png`);

                try {
                    const res = await fetch(`${API_BASE}/upload/upload?issue_id=${issueId}`, {
                        method: 'POST',
                        headers: {
                            'X-Redmine-Url': localStorage.getItem('redmine_url') || '',
                            'X-Redmine-Key': localStorage.getItem('redmine_key') || '',
                        },
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        onUpload?.(data);
                    } else {
                        const error = await res.json();
                        onError?.(error.detail || 'Upload failed');
                    }
                } catch (err) {
                    onError?.('Network error');
                }
                break;
            }
        }
    }, [issueId, onUpload, onError]);

    useEffect(() => {
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [handlePaste]);
}
