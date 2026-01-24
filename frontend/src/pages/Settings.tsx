import { useState, useEffect } from 'react';
import { WatchlistSettings } from '@/components/dashboard/WatchlistSettings';
import GitLabSettings from '@/components/GitLabSettings';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, AlertTriangle, Link as LinkIcon, Sparkles, Settings as SettingsIcon, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    const { t, i18n } = useTranslation();
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

    const updateField = (field: keyof SettingsData, value: string | number | null) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveRedmine = async () => {
        setStatus(t('settings.savingRedmine'));
        try {
            const data = await api.put<SettingsData>('/settings', {
                redmine_url: settings.redmine_url,
                redmine_token: settings.redmine_token,
                redmine_default_activity_id: settings.redmine_default_activity_id ? parseInt(settings.redmine_default_activity_id) : null,
                task_warning_days: settings.task_warning_days,
                task_severe_warning_days: settings.task_severe_warning_days
            });
            updateField('redmine_token', data.redmine_token);

            // 更新認證上下文中的 Redmine URL
            await api.get('/auth/me');
            setStatus(t('settings.redmineSaved'));
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) { setStatus('Error: ' + e.message); }
    };

    const handleSaveOpenAI = async () => {
        setStatus(t('settings.savingOpenAI'));
        try {
            const data = await api.put<SettingsData>('/settings', {
                openai_url: settings.openai_url,
                openai_key: settings.openai_key,
                openai_model: settings.openai_model
            });
            updateField('openai_key', data.openai_key);
            setStatus(t('settings.openaiSaved'));
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) { setStatus('Error: ' + e.message); }
    };

    const saveTaskWarnings = async () => {
        if (!settings.task_warning_days || !settings.task_severe_warning_days) return;
        setStatus(t('settings.savingWarnings'));
        try {
            await api.put<SettingsData>('/settings', {
                task_warning_days: settings.task_warning_days,
                task_severe_warning_days: settings.task_severe_warning_days
            });
            setStatus(t('settings.warningsSaved'));
            setTimeout(() => setStatus(''), 2000);
        } catch (e: any) { setStatus('Error: ' + e.message); }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setPwdStatus(t('settings.security.passwordMismatch'));
            return;
        }
        setPwdStatus(t('settings.updating'));
        try {
            await api.post('/auth/change-password', { old_password: passwords.old, new_password: passwords.new });
            setPwdStatus(t('settings.security.passwordChanged'));
            setPasswords({ old: '', new: '', confirm: '' });
            setTimeout(() => setPwdStatus(''), 3000);
        } catch (e: any) { setPwdStatus('Error: ' + (e.response?.data?.detail || e.message)); }
    };

    const testConnection = async () => {
        setTestStatus(t('settings.testing'));
        try {
            const data = await api.post<{ user: { firstname: string } }>('/auth/connect', {
                url: settings.redmine_url,
                api_key: settings.redmine_token === '******' ? '******' : settings.redmine_token
            });
            setTestStatus(`✓ Connected as ${data.user.firstname}`);
        } catch (e: any) { setTestStatus('✗ Connection failed'); }
    };

    const testOpenAI = async () => {
        setOpenaiTestStatus(t('settings.testing'));
        try {
            const headers: any = {};
            if (settings.openai_key !== '******') headers['X-OpenAI-Key'] = settings.openai_key;
            headers['X-OpenAI-URL'] = settings.openai_url;
            headers['X-OpenAI-Model'] = settings.openai_model;

            await api.post('/chat/test-connection', {}, { headers });
            setOpenaiTestStatus(`✓ Connected(${settings.openai_model})`);
        } catch (e: any) {
            setOpenaiTestStatus(`✗ ${e.message}`);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 pt-8 px-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-sky-100 text-sky-600 rounded-xl shadow-sm border border-sky-200/50">
                            <SettingsIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-sky-500/80">System Configuration</span>
                    </div>
                    <div>
                        <h1 className="text-6xl font-black tracking-tight text-slate-900 leading-tight">
                            系統設定
                        </h1>
                        <p className="text-slate-400 font-bold text-lg mt-1">設定連線資訊與偏好選項</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">選擇語言</span>
                    <select
                        value={i18n.language}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        className="h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 font-black text-xs outline-none focus:ring-2 focus:ring-sky-500/20 transition-all cursor-pointer"
                    >
                        <option value="zh-TW">繁體中文</option>
                        <option value="en">English</option>
                    </select>
                </div>
            </div>

            {/* Security & Warnings Row - At the top */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 px-4">
                {/* Security Core */}
                <section className="bg-white rounded-[40px] border border-slate-100 p-10 space-y-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                            <Shield className="h-6 w-6 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800">安全核心</h2>
                    </div>

                    {user?.auth_source === 'ldap' ? (
                        <div className="bg-amber-50 border border-amber-100/50 p-6 rounded-3xl">
                            <p className="text-sm font-bold text-amber-800 leading-relaxed opacity-70">您的帳號管理權限來自外部目錄，如需變更安全性憑證請洽管理人員。</p>
                        </div>
                    ) : (
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">目前密碼</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.old}
                                    onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                    className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 font-bold focus:ring-2 focus:ring-red-500/10 outline-none"
                                    placeholder="輸入目前密碼"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">新密碼</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 font-bold focus:ring-2 focus:ring-red-500/10 outline-none"
                                    placeholder="輸入新密碼"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">確認新密碼</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 font-bold focus:ring-2 focus:ring-red-500/10 outline-none"
                                    placeholder="再次輸入新密碼"
                                />
                            </div>
                            <button type="submit" className="w-full h-12 bg-[#1e293b] text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-slate-200 hover:brightness-110 transition-all active:scale-[0.98]">確認變更密碼</button>
                            {pwdStatus && <p className="text-[10px] font-black uppercase text-center text-red-500">{pwdStatus}</p>}
                        </form>
                    )}
                </section>

                {/* Warning Thresholds */}
                <section className="bg-white rounded-[40px] border border-slate-100 p-10 space-y-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                            <AlertTriangle className="h-6 w-6 text-rose-500" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800">警示門檻</h2>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard Warning</span>
                                <span className="text-xl font-black text-rose-500">{settings.task_warning_days}D</span>
                            </div>
                            <input
                                type="range"
                                value={settings.task_warning_days}
                                step="1" min="1" max="14"
                                onChange={(e) => setSettings(p => ({ ...p, task_warning_days: parseInt(e.target.value) }))}
                                onMouseUp={saveTaskWarnings}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Critical Warning</span>
                                <span className="text-xl font-black text-rose-500">{settings.task_severe_warning_days}D</span>
                            </div>
                            <input
                                type="range"
                                value={settings.task_severe_warning_days}
                                step="1" min="1" max="30"
                                onChange={(e) => setSettings(p => ({ ...p, task_severe_warning_days: parseInt(e.target.value) }))}
                                onMouseUp={saveTaskWarnings}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                        </div>
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
                {/* GitLab Section - Full Width */}
                <div className="lg:col-span-12">
                    <section className="bg-white rounded-[48px] border border-slate-100 p-12 space-y-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500">
                        <GitLabSettings />
                    </section>
                </div>

                {/* Redmine Card */}
                <div className="lg:col-span-6">
                    <section className="bg-white rounded-[40px] border border-slate-100 p-10 space-y-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500 h-full">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-sky-100/50 rounded-2xl border border-sky-100 flex items-center justify-center">
                                <LinkIcon className="h-6 w-6 text-sky-500" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-800">Redmine 樞紐</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">網路端點網址</label>
                                <input
                                    type="url"
                                    value={settings.redmine_url}
                                    onChange={(e) => updateField('redmine_url', e.target.value)}
                                    className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 font-bold focus:ring-2 focus:ring-sky-500/20 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="http://127.0.0.1:10083"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">同步金鑰 (API)</label>
                                <input
                                    type="password"
                                    value={settings.redmine_token}
                                    onChange={(e) => updateField('redmine_token', e.target.value)}
                                    className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 font-bold focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button onClick={handleSaveRedmine} className="w-full h-14 bg-[#1e293b] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-slate-200 hover:brightness-110 active:scale-[0.98] transition-all">更新設定</button>
                            <button onClick={testConnection} className="w-full py-3 text-slate-400 hover:text-sky-500 font-black text-[10px] uppercase tracking-widest transition-all">測試連線狀態</button>
                            {testStatus && <p className="text-[10px] font-black uppercase text-center text-sky-500 animate-pulse">{testStatus}</p>}
                        </div>
                    </section>
                </div>

                {/* OpenAI Card */}
                <div className="lg:col-span-6">
                    <section className="bg-white rounded-[40px] border border-slate-100 p-10 space-y-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500 h-full">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100/50 rounded-2xl border border-indigo-100 flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-indigo-500" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-800">AI 智慧引擎</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">基底網址 (Base URL)</label>
                                <div className="relative">
                                    <input
                                        type="url"
                                        value={settings.openai_url}
                                        onChange={(e) => updateField('openai_url', e.target.value)}
                                        className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50/50 pl-12 pr-5 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        placeholder="https://api.openai.com/v1"
                                    />
                                    <Globe className="w-5 h-5 text-slate-300 absolute left-4 top-4.5" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">金鑰 (API Key)</label>
                                <input
                                    type="password"
                                    value={settings.openai_key}
                                    onChange={(e) => updateField('openai_key', e.target.value)}
                                    className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    placeholder="••••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">指定模型 (Model)</label>
                                <input
                                    type="text"
                                    value={settings.openai_model}
                                    onChange={(e) => updateField('openai_model', e.target.value)}
                                    className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    placeholder="openai/gpt-4o-mini"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button onClick={handleSaveOpenAI} className="w-full h-14 bg-[#1e293b] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-slate-200 hover:brightness-110 active:scale-[0.98] transition-all">更新設定</button>
                            <button onClick={testOpenAI} className="w-full py-3 text-slate-400 hover:text-indigo-500 font-black text-[10px] uppercase tracking-widest transition-all">測試模型響應</button>
                            {openaiTestStatus && <p className="text-[10px] font-black uppercase text-center text-indigo-500 animate-pulse">{openaiTestStatus}</p>}
                        </div>
                    </section>
                </div>

                {/* Watchlist Section */}
                <div className="lg:col-span-12">
                    <div className="bg-white rounded-[48px] border border-slate-100 overflow-hidden shadow-sm">
                        <WatchlistSettings />
                    </div>
                </div>
            </div>

            {/* Status Messenger */}
            {status && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
                    <div className="bg-[#1e293b] text-white px-10 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl flex items-center gap-5 border border-white/10">
                        <div className="w-2 h-2 bg-sky-400 rounded-full animate-ping" />
                        {status}
                    </div>
                </div>
            )}
        </div>
    );
}
