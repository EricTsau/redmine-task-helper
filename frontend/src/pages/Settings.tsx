import { useState, useEffect } from 'react';
import { WatchlistSettings } from '@/components/dashboard/WatchlistSettings';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, AlertTriangle, Link as LinkIcon, Sparkles } from 'lucide-react';

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
    const { user } = useAuth();
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

    // Password change state
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
    const [pwdStatus, setPwdStatus] = useState<string>('');

    useEffect(() => {
        // Load settings from backend
        api.get<SettingsData>('/settings')
            .then(data => {
                if (data) {
                    setSettings({
                        redmine_url: data.redmine_url || '',
                        redmine_token: data.redmine_token || '',
                        redmine_default_activity_id: data.redmine_default_activity_id?.toString() || '',
                        openai_url: data.openai_url || 'https://api.openai.com/v1',
                        openai_key: data.openai_key || '',
                        openai_model: data.openai_model || 'gpt-4o-mini'
                    });
                }
            })
            .catch(console.error);
    }, []);

    const handleSaveRedmine = async () => {
        setStatus('Saving Redmine...');
        try {
            const backendSettings = {
                redmine_url: settings.redmine_url,
                redmine_token: settings.redmine_token,
                redmine_default_activity_id: settings.redmine_default_activity_id ? parseInt(settings.redmine_default_activity_id) : null,
            };

            const data = await api.put<SettingsData>('/settings', backendSettings);
            updateField('redmine_token', data.redmine_token);

            setStatus('✓ Redmine settings saved');
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) {
            setStatus('Error: ' + e.message);
        }
    };

    const handleSaveOpenAI = async () => {
        setStatus('Saving OpenAI...');
        try {
            const backendSettings = {
                openai_url: settings.openai_url,
                openai_key: settings.openai_key,
                openai_model: settings.openai_model
            };

            const data = await api.put<SettingsData>('/settings', backendSettings);
            updateField('openai_key', data.openai_key);

            setStatus('✓ OpenAI settings saved');
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) {
            setStatus('Error: ' + e.message);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setPwdStatus('Passwords do not match');
            return;
        }
        setPwdStatus('Updating...');
        try {
            await api.post('/auth/change-password', {
                old_password: passwords.old,
                new_password: passwords.new
            });
            setPwdStatus('✓ Password changed');
            setPasswords({ old: '', new: '', confirm: '' });
            setTimeout(() => setPwdStatus(''), 3000);
        } catch (e: any) {
            setPwdStatus('Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    const testConnection = async () => {
        setTestStatus('Testing...');
        try {
            const data = await api.post<{ user: { firstname: string } }>('/auth/connect', {
                url: settings.redmine_url,
                api_key: settings.redmine_token === '******' ? '' : settings.redmine_token
            });
            setTestStatus(`✓ Connected as ${data.user.firstname} `);
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
            setOpenaiTestStatus(`✓ Connected(${settings.openai_model})`);
        } catch (e: any) {
            setOpenaiTestStatus(`✗ ${e.message} `);
        }
    };

    const updateField = (field: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">Settings</h1>

            {/* Security Section */}
            <section className="space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> Security
                </h2>

                {user?.auth_source === 'ldap' ? (
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg text-sm text-balance">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <p className="text-muted-foreground">
                            您的帳號是透過 LDAP 認證，請至公司的目錄服務修改密碼。
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">舊密碼</label>
                                <input
                                    type="password"
                                    value={passwords.old}
                                    onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                    className="flex h-10 w-full rounded-md border bg-muted/20 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">新密碼</label>
                                <input
                                    type="password"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    className="flex h-10 w-full rounded-md border bg-muted/20 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">確認新密碼</label>
                                <input
                                    type="password"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className="flex h-10 w-full rounded-md border bg-muted/20 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-bold transition-all shadow-md active:scale-95"
                            >
                                修改密碼
                            </button>
                            {pwdStatus && <span className={`text-sm ${pwdStatus.startsWith('Error') ? 'text-destructive' : 'text-primary font-medium'}`}>{pwdStatus}</span>}
                        </div>
                    </form>
                )}
            </section>

            {/* Redmine Section */}
            <section className="space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-primary" /> Redmine Settings
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

                <div className="flex items-center gap-4">
                    <button
                        onClick={testConnection}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                    >
                        Test Connection
                    </button>
                    {testStatus && <span className="text-sm">{testStatus}</span>}
                    <div className="flex-1" />
                    <button
                        onClick={handleSaveRedmine}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium"
                    >
                        Save Redmine
                    </button>
                </div>
            </section>

            {/* OpenAI Section */}
            <section className="space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> OpenAI
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

                <div className="flex items-center gap-4">
                    <button
                        onClick={testOpenAI}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                    >
                        Test OpenAI
                    </button>
                    {openaiTestStatus && <span className="text-sm">{openaiTestStatus}</span>}
                    <div className="flex-1" />
                    <button
                        onClick={handleSaveOpenAI}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium"
                    >
                        Save OpenAI
                    </button>
                </div>
            </section>

            {/* Watchlist Section */}
            <WatchlistSettings />

            {/* Status Message Holder */}
            <div className="h-4">
                {status && <p className="text-sm text-center text-primary font-medium animate-pulse">{status}</p>}
            </div>
        </div>
    );
}
