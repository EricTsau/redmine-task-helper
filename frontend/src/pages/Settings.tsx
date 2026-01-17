import { useState, useEffect } from 'react';
import { WatchlistSettings } from '@/components/dashboard/WatchlistSettings';

import { api } from '@/lib/api';

interface SettingsData {
    redmine_url: string;
    redmine_token: string;
    redmine_default_activity_id?: string;
    openai_url: string;
    openai_key: string;
    openai_model: string;
}

export function Settings() {
    const [settings, setSettings] = useState<SettingsData>({
        redmine_url: '',
        redmine_token: '',
        redmine_default_activity_id: '',
        openai_url: 'https://api.openai.com/v1',
        openai_key: '',
        openai_model: 'gpt-4o-mini'
    });
    const [status, setStatus] = useState<string>('');
    const [testStatus, setTestStatus] = useState<string>('');
    const [openaiTestStatus, setOpenaiTestStatus] = useState<string>('');

    useEffect(() => {
        // Load public settings from backend
        // Load public settings from backend
        api.get<SettingsData>('/settings')
            .then(data => {
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        redmine_url: data.redmine_url || '',
                        redmine_default_activity_id: data.redmine_default_activity_id?.toString() || '',
                        openai_url: data.openai_url || 'https://api.openai.com/v1',
                        openai_model: data.openai_model || 'gpt-4o-mini'
                    }));
                }
            })
            .catch(console.error);

        // Load secrets from localStorage
        const localRedmineKey = localStorage.getItem('redmine_api_key') || '';
        const localOpenAIKey = localStorage.getItem('openai_api_key') || '';

        setSettings(prev => ({
            ...prev,
            redmine_token: localRedmineKey,
            openai_key: localOpenAIKey
        }));
    }, []);

    const handleSave = async () => {
        setStatus('Saving...');
        try {
            // Save secrets to localStorage
            localStorage.setItem('redmine_api_key', settings.redmine_token);
            localStorage.setItem('openai_api_key', settings.openai_key);

            // Save public settings to backend
            const backendSettings = {
                redmine_url: settings.redmine_url,
                redmine_default_activity_id: settings.redmine_default_activity_id ? parseInt(settings.redmine_default_activity_id) : null,
                openai_url: settings.openai_url,
                openai_model: settings.openai_model
            };

            await api.put('/settings', backendSettings);
            setStatus('✓ Saved (Keys locally)');
            setTimeout(() => setStatus(''), 2000);
        } catch {
            setStatus('Error saving');
        }
    };

    const testConnection = async () => {
        setTestStatus('Testing...');
        try {
            const data = await api.post<{ user: { firstname: string } }>('/auth/connect', {
                url: settings.redmine_url,
                api_key: settings.redmine_token === '******' ? '' : settings.redmine_token
            });
            setTestStatus(`✓ Connected as ${data.user.firstname}`);
        } catch (e) {
            setTestStatus('✗ Connection failed');
        }
    };

    const testOpenAI = async () => {
        setOpenaiTestStatus('Testing...');
        try {
            await api.post('/chat/test-connection', {}, {
                headers: {
                    'X-OpenAI-Key': settings.openai_key,
                    'X-OpenAI-URL': settings.openai_url,
                    'X-OpenAI-Model': settings.openai_model
                }
            });
            setOpenaiTestStatus(`✓ Connected (${settings.openai_model})`);
        } catch (e: any) {
            setOpenaiTestStatus(`✗ ${e.message}`);
        }
    };

    const updateField = (field: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">Settings</h1>

            {/* Redmine Section */}
            <section className="space-y-4 p-6 border rounded-lg">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="text-xl">🔗</span> Redmine
                </h2>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Redmine URL</label>
                    <input
                        type="url"
                        value={settings.redmine_url}
                        onChange={(e) => updateField('redmine_url', e.target.value)}
                        placeholder="https://redmine.example.com"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">API Token</label>
                    <input
                        type="password"
                        value={settings.redmine_token}
                        onChange={(e) => updateField('redmine_token', e.target.value)}
                        placeholder="Your Redmine API Key"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Find this at /my/account (RSS access key)
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Default Activity ID (Optional)</label>
                    <input
                        type="number"
                        value={settings.redmine_default_activity_id}
                        onChange={(e) => updateField('redmine_default_activity_id', e.target.value)}
                        placeholder="e.g. 9"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Fallback ID if API cannot fetch activities (e.g. Development = 9)
                    </p>
                </div>

                <button
                    onClick={testConnection}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                >
                    Test Connection
                </button>
                {testStatus && <span className="ml-2 text-sm">{testStatus}</span>}
            </section>

            {/* OpenAI Section */}
            <section className="space-y-4 p-6 border rounded-lg">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="text-xl">✨</span> OpenAI
                </h2>

                <div className="space-y-2">
                    <label className="text-sm font-medium">API URL</label>
                    <input
                        type="url"
                        value={settings.openai_url}
                        onChange={(e) => updateField('openai_url', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Use custom endpoint for local models or proxies
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <input
                        type="password"
                        value={settings.openai_key}
                        onChange={(e) => updateField('openai_key', e.target.value)}
                        placeholder="sk-..."
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Model Name</label>
                    <input
                        type="text"
                        value={settings.openai_model}
                        onChange={(e) => updateField('openai_model', e.target.value)}
                        placeholder="gpt-4o-mini"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        e.g. gpt-4o-mini, gpt-4o, claude-3-sonnet
                    </p>
                </div>

                <button
                    onClick={testOpenAI}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                >
                    Test OpenAI
                </button>
                {openaiTestStatus && <span className="ml-2 text-sm">{openaiTestStatus}</span>}
            </section>

            {/* Watchlist Section */}
            <WatchlistSettings />

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Save All Settings
                </button>
                {status && <span className="text-sm text-muted-foreground">{status}</span>}
            </div>
        </div>
    );
}
