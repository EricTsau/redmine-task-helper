import { useState, useEffect } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function Settings() {
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        // Fetch current settings
        fetch(`${API_BASE}/settings`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setUrl(data.redmine_url || '');
                    setApiKey(data.api_key ? '******' : '');
                }
            })
            .catch(err => console.error(err));
    }, []);

    const handleSave = async () => {
        setStatus('Saving...');
        try {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redmine_url: url, api_key: apiKey }),
            });
            if (res.ok) {
                setStatus('Saved successfully!');
            } else {
                setStatus('Failed to save.');
            }
        } catch (e) {
            setStatus('Error saving settings.');
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            <div className="space-y-2">
                <label className="text-sm font-medium">Redmine URL</label>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://redmine.example.com"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Redmine API Key"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Find this on your Redmine account page /my/account (RSS access key).
                </p>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                    Save Settings
                </button>
                {status && <span className="text-sm text-muted-foreground">{status}</span>}
            </div>
        </div>
    );
}
