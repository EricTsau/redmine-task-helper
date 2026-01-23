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
    task_warning_days?: number;
    task_severe_warning_days?: number;
}

export function Settings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState<SettingsData>({
        redmine_url: '',
        redmine_token: '',
        redmine_default_activity_id: '',
        openai_url: 'https://api.openai.com/v1',
        openai_key: '',
        openai_model: 'gpt-4o-mini',
        task_warning_days: 2,
        task_severe_warning_days: 3
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
                        openai_model: data.openai_model || 'gpt-4o-mini',
                        task_warning_days: data.task_warning_days ?? 2,
                        task_severe_warning_days: data.task_severe_warning_days ?? 3
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
                task_warning_days: settings.task_warning_days,
                task_severe_warning_days: settings.task_severe_warning_days
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

    const saveTaskWarnings = async () => {
        // Prevent saving if values are invalid
        if (!settings.task_warning_days || !settings.task_severe_warning_days) return;

        setStatus('Saving warning settings...');
        try {
            await api.put<SettingsData>('/settings', {
                task_warning_days: settings.task_warning_days,
                task_severe_warning_days: settings.task_severe_warning_days
            });
            setStatus('✓ Warning settings saved');
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) {
            setStatus('Error saving warnings: ' + e.message);
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
                api_key: settings.redmine_token === '******' ? '******' : settings.redmine_token
            });
            setTestStatus(`✓ Connected as ${data.user.firstname}`);
        } catch (e: any) {
            setTestStatus('✗ Connection failed');
        }
    };

    const testOpenAI = async () => {
        setOpenaiTestStatus('Testing...');
        try {
            const headers: Record<string, string> = {};
            // Only send if it's not the masked value
            if (settings.openai_key && settings.openai_key !== '******') {
                headers['X-OpenAI-Key'] = settings.openai_key;
            }
            if (settings.openai_url) {
                headers['X-OpenAI-URL'] = settings.openai_url;
            }
            if (settings.openai_model) {
                headers['X-OpenAI-Model'] = settings.openai_model;
            }

            await api.post('/chat/test-connection', {}, { headers });
            setOpenaiTestStatus(`✓ Connected(${settings.openai_model})`);
        } catch (e: any) {
            setOpenaiTestStatus(`✗ ${e.message}`);
        }
    };

    const updateField = (field: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">
                    System Parameters
                </h1>
                <p className="text-muted-foreground font-medium">Configure neural links, auth vectors and operational thresholds</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Security Section */}
                <section className="glass-card rounded-[32px] border-border/20 p-8 space-y-8 relative overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                    <div className="absolute top-0 left-0 w-full h-1 bg-tech-cyan/30" />
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-tech-cyan/10 rounded-xl border border-tech-cyan/20">
                            <Shield className="h-6 w-6 text-tech-cyan" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Security Core</h2>
                    </div>

                    {user?.auth_source === 'ldap' ? (
                        <div className="flex items-start gap-4 p-6 bg-tech-indigo/5 border border-tech-indigo/10 rounded-2xl group transition-all hover:bg-tech-indigo/10">
                            <AlertTriangle className="h-6 w-6 text-tech-indigo flex-shrink-0 animate-pulse" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-foreground">External Directory Link Active</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Your identity is managed via LDAP. Password modifications must be executed through the corporate nexus.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handlePasswordChange} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Current Signature</label>
                                    <input
                                        type="password"
                                        value={passwords.old}
                                        onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                        className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-cyan/30 outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">New Hash</label>
                                        <input
                                            type="password"
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-cyan/30 outline-none transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Verify Hash</label>
                                        <input
                                            type="password"
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-cyan/30 outline-none transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="submit"
                                    className="px-8 py-3 tech-button-primary rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-glow"
                                >
                                    Update Protocol
                                </button>
                                {pwdStatus && <span className={`text-[10px] font-black uppercase tracking-widest ${pwdStatus.startsWith('Error') ? 'text-tech-rose' : 'text-tech-cyan animate-pulse'}`}>{pwdStatus}</span>}
                            </div>
                        </form>
                    )}
                </section>

                {/* Task Warnings Section */}
                <section className="glass-card rounded-[32px] border-border/20 p-8 space-y-8 relative overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                    <div className="absolute top-0 left-0 w-full h-1 bg-tech-rose/30" />
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-tech-rose/10 rounded-xl border border-tech-rose/20">
                            <AlertTriangle className="h-6 w-6 text-tech-rose" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Warning Thresholds</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 pt-2">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Standard Delta (Days)</label>
                                <span className="text-lg font-black text-tech-rose">{settings.task_warning_days}d</span>
                            </div>
                            <input
                                type="range"
                                value={settings.task_warning_days}
                                step="1"
                                min="1"
                                max="14"
                                onChange={(e) => setSettings(p => ({ ...p, task_warning_days: parseInt(e.target.value) }))}
                                onMouseUp={saveTaskWarnings}
                                className="w-full accent-tech-rose"
                            />
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter opacity-60">TASKS UNUPDATED BEYOND THIS POINT TRIGGER CAUTION STATE</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Critical Delta (Days)</label>
                                <span className="text-lg font-black text-tech-rose">{settings.task_severe_warning_days}d</span>
                            </div>
                            <input
                                type="range"
                                value={settings.task_severe_warning_days}
                                step="1"
                                min="1"
                                max="30"
                                onChange={(e) => setSettings(p => ({ ...p, task_severe_warning_days: parseInt(e.target.value) }))}
                                onMouseUp={saveTaskWarnings}
                                className="w-full accent-tech-rose"
                            />
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter opacity-60">TASKS UNUPDATED BEYOND THIS POINT TRIGGER CRITICAL STATE</p>
                        </div>
                    </div>
                </section>

                {/* Redmine Section */}
                <section className="glass-card rounded-[32px] border-border/20 p-8 space-y-8 relative overflow-hidden lg:col-span-1 bg-gradient-to-br from-white/5 to-transparent">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/30" />
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                            <LinkIcon className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Redmine Nexus</h2>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nexus Endpoint URL</label>
                            <input
                                type="url"
                                value={settings.redmine_url}
                                onChange={(e) => updateField('redmine_url', e.target.value)}
                                placeholder="https://redmine.example.com"
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Synchronization Key (API)</label>
                            <input
                                type="password"
                                value={settings.redmine_token}
                                onChange={(e) => updateField('redmine_token', e.target.value)}
                                placeholder="••••••••••••••••••••••••"
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Default Activity Vector ID</label>
                            <input
                                type="number"
                                value={settings.redmine_default_activity_id}
                                onChange={(e) => updateField('redmine_default_activity_id', e.target.value)}
                                placeholder="e.g. 9"
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                        <button
                            onClick={testConnection}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            Test Signal
                        </button>
                        <button
                            onClick={handleSaveRedmine}
                            className="flex-1 px-4 py-3 tech-button-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-glow"
                        >
                            Sync Core
                        </button>
                    </div>
                    {testStatus && <p className="text-[10px] font-black uppercase text-center text-primary tracking-widest animate-pulse">{testStatus}</p>}
                </section>

                {/* OpenAI Section */}
                <section className="glass-card rounded-[32px] border-border/20 p-8 space-y-8 relative overflow-hidden lg:col-span-1 bg-gradient-to-br from-white/5 to-transparent">
                    <div className="absolute top-0 left-0 w-full h-1 bg-tech-indigo/30" />
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-tech-indigo/10 rounded-xl border border-tech-indigo/20">
                            <Sparkles className="h-6 w-6 text-tech-indigo" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">AI Intelligence Engine</h2>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Intelligence Endpoint URL</label>
                            <input
                                type="url"
                                value={settings.openai_url}
                                onChange={(e) => updateField('openai_url', e.target.value)}
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Engine Authorization Key</label>
                            <input
                                type="password"
                                value={settings.openai_key}
                                onChange={(e) => updateField('openai_key', e.target.value)}
                                placeholder="sk-••••••••••••••••••••"
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Specified Intelligence Model</label>
                            <input
                                type="text"
                                value={settings.openai_model}
                                onChange={(e) => updateField('openai_model', e.target.value)}
                                placeholder="gpt-4o-mini"
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                        <button
                            onClick={testOpenAI}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            Probe Model
                        </button>
                        <button
                            onClick={handleSaveOpenAI}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-tech-indigo to-primary text-white shadow-glow-indigo rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                            Sync Engine
                        </button>
                    </div>
                    {openaiTestStatus && <p className="text-[10px] font-black uppercase text-center text-tech-indigo tracking-widest animate-pulse">{openaiTestStatus}</p>}
                </section>
            </div>

            {/* Watchlist Section - Should probably be updated inside the component itself for consistency */}
            <div className="glass-card rounded-[40px] border-border/20 p-2 overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tech-cyan via-tech-indigo to-tech-rose opacity-20" />
                <WatchlistSettings />
            </div>

            {/* Central Status Messenger */}
            {status && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-primary/90 backdrop-blur-md text-primary-foreground px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(var(--primary),0.4)] flex items-center gap-4">
                        <Sparkles className="h-4 w-4 animate-spin" />
                        {status}
                    </div>
                </div>
            )}
        </div>
    );
}
