import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
    Users,
    Plus,
    Save,
    Server,
    ShieldCheck,
    UserPlus,
    CheckCircle2,
    XCircle,
    Calendar,
    Bug
} from 'lucide-react';
import { HolidayManagement } from '@/components/admin/HolidayManagement';
import { useTranslation } from 'react-i18next';

interface User {
    id: number;
    username: string;
    full_name: string;
    email: string;
    is_admin: boolean;
    auth_source: string;
}

interface LDAPSettings {
    server_url: string;
    base_dn: string;
    user_dn_template: string;
    bind_dn?: string;
    bind_password?: string;
    is_active: boolean;
}

export const Administration: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'users' | 'ldap' | 'holidays' | 'ai'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [ldapSettings, setLdapSettings] = useState<LDAPSettings>({
        server_url: '',
        base_dn: '',
        user_dn_template: '',
        is_active: false
    });
    const [appSettings, setAppSettings] = useState({ ldap_enabled: false, enable_ai_debug_dump: false, max_concurrent_chunks: 5 });

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // User creation state
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        full_name: '',
        email: '',
        is_admin: false,
        auth_source: 'standard'
    });

    // Bulk creation state
    const [showBulkAdd, setShowBulkAdd] = useState(false);
    const [bulkData, setBulkData] = useState('');
    const [bulkPassword, setBulkPassword] = useState('');
    const [randomPassword, setRandomPassword] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await api.get<User[]>('/admin/users');
                setUsers(res);
            } else if (activeTab === 'ldap') {
                const res = await api.get<LDAPSettings>('/admin/ldap-settings');
                setLdapSettings(res);
            } else if (activeTab === 'ai') {
                const res = await api.get<any>('/admin/app-settings');
                setAppSettings(res);
            }
            // holidays tab managed internally
        } catch (e) {
            console.error("Failed to fetch admin data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/admin/users', newUser);
            setStatus({ type: 'success', message: t('admin.users.userCreated') });
            setShowAddUser(false);
            setNewUser({ username: '', password: '', full_name: '', email: '', is_admin: false, auth_source: 'standard' });
            fetchData();
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const handleBulkAdd = async () => {
        const lines = bulkData.split('\n').filter(l => l.trim());
        const userList = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            return {
                username: parts[0],
                full_name: parts[1] || '',
                email: parts[2] || '',
                auth_source: 'standard'
            };
        });

        try {
            await api.post('/admin/users/bulk', {
                users: userList,
                common_password: bulkPassword,
                generate_random: randomPassword
            });
            setStatus({ type: 'success', message: t('admin.users.bulkCompleted') });
            setShowBulkAdd(false);
            setBulkData('');
            fetchData();
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const handleToggleAdmin = async (userId: number) => {
        try {
            await api.patch(`/admin/users/${userId}/role`);
            setStatus({ type: 'success', message: t('admin.users.roleUpdated') });
            fetchData();
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const saveLDAP = async () => {
        try {
            await api.put('/admin/ldap-settings', ldapSettings);
            setStatus({ type: 'success', message: t('admin.ldap.updated') });
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const updateAppSettings = async (updates: Partial<typeof appSettings>) => {
        try {
            const newSettings = { ...appSettings, ...updates };
            await api.put('/admin/app-settings', newSettings);
            setAppSettings(newSettings);
            setStatus({ type: 'success', message: t('admin.systemConfig.updated') });
        } catch (error) {
            console.error('Failed to update app settings:', error);
            setStatus({ type: 'error', message: t('admin.systemConfig.updateFailed') });
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 shadow-glow">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                            {t('admin.title')}
                        </h1>
                    </div>
                    <p className="text-muted-foreground font-medium ml-1">{t('admin.subtitle')}</p>
                </div>

                <div className="flex bg-muted/20 p-1 rounded-2xl border border-white/5 backdrop-blur-sm">
                    {[
                        { id: 'users', icon: Users, label: t('admin.tabs.operators') },
                        { id: 'ldap', icon: Server, label: t('admin.tabs.ldap') },
                        { id: 'holidays', icon: Calendar, label: t('admin.tabs.holidays') },
                        { id: 'ai', icon: Bug, label: t('admin.tabs.systemConfig') },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? 'bg-primary shadow-glow text-primary-foreground scale-105'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                }`}
                        >
                            <tab.icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {status && (
                <div className={`p-5 rounded-2xl border flex items-center justify-between animate-in slide-in-from-top-4 duration-300 backdrop-blur-md ${status.type === 'success' ? 'bg-tech-cyan/10 border-tech-cyan/20 text-tech-cyan shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-tech-rose/10 border-tech-rose/20 text-tech-rose shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                    }`}>
                    <div className="flex items-center gap-4 font-bold text-sm">
                        {status.type === 'success' ? <CheckCircle2 size={24} className="shadow-glow-cyan" /> : <XCircle size={24} className="shadow-glow-rose" />}
                        {status.message}
                    </div>
                    <button onClick={() => setStatus(null)} className="text-xs font-black uppercase opacity-60 hover:opacity-100 transition-opacity tracking-widest">{t('admin.acknowledge')}</button>
                </div>
            )}

            <div className="glass-card border-border/20 rounded-[32px] overflow-hidden min-h-[600px] flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tech-indigo opacity-30" />

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-32">
                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-glow" />
                        <p className="font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground animate-pulse">{t('admin.retrievingState')}</p>
                    </div>
                ) : activeTab === 'users' ? (
                    <div className="flex flex-col flex-1">
                        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/5">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black tracking-tight">{t('admin.users.title')}</h3>
                                <span className="text-[10px] font-black bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-tighter shadow-glow-sm">
                                    {users.length} {t('admin.users.authenticatedEntities')}
                                </span>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowBulkAdd(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 glass-card border-border/30 rounded-xl hover:bg-white/10 font-bold text-xs uppercase tracking-widest transition-all"
                                >
                                    <UserPlus size={16} /> {t('admin.users.bulkSync')}
                                </button>
                                <button
                                    onClick={() => setShowAddUser(true)}
                                    className="flex items-center gap-2 px-6 py-2.5 tech-button-primary rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    <Plus size={18} /> {t('admin.users.newEntry')}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto p-2">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-muted/10 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                                        <th className="px-8 py-5 rounded-tl-2xl">{t('admin.users.identitySignature')}</th>
                                        <th className="px-8 py-5">{t('admin.users.designatedTitle')}</th>
                                        <th className="px-8 py-5 text-center">{t('admin.users.authVector')}</th>
                                        <th className="px-8 py-5 text-center">{t('admin.users.securityClear')}</th>
                                        <th className="px-8 py-5 text-right rounded-tr-2xl">{t('admin.users.override')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.map(u => (
                                        <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-tech-indigo/20 border border-primary/20 flex items-center justify-center font-black text-primary text-xs shadow-glow-sm">
                                                        {u.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">{u.username}</div>
                                                        <div className="text-[10px] font-medium text-muted-foreground lowercase opacity-60">{u.email || 'no-email@system.local'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 font-bold text-sm text-foreground/80">{u.full_name || 'UNDEFINED'}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-center">
                                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${u.auth_source === 'ldap' ? 'bg-tech-indigo/10 border-tech-indigo/20 text-tech-indigo' : 'bg-tech-cyan/10 border-tech-cyan/20 text-tech-cyan'
                                                        }`}>
                                                        {u.auth_source === 'ldap' ? <Server size={10} /> : <ShieldCheck size={10} />}
                                                        {u.auth_source}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-center">
                                                    {u.is_admin ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tech-rose/10 text-tech-rose border border-tech-rose/20 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse shadow-glow-rose-sm">
                                                            <ShieldCheck size={12} /> {t('admin.users.rootAdmin')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 text-[10px] font-black uppercase tracking-[0.2em]">{t('admin.users.standard')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => handleToggleAdmin(u.id)}
                                                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${u.is_admin
                                                        ? 'bg-muted/50 text-muted-foreground hover:bg-tech-rose hover:text-white'
                                                        : 'bg-white/5 border border-white/10 text-primary hover:bg-primary hover:text-white'
                                                        }`}
                                                >
                                                    {u.is_admin ? t('admin.users.rescind') : t('admin.users.elevate')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'ldap' ? (
                    <div className="p-12 space-y-12">
                        <div className="space-y-2 border-b border-white/5 pb-8">
                            <h3 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                <div className="p-2 bg-tech-indigo/10 rounded-xl border border-tech-indigo/20">
                                    <Server className="w-6 h-6 text-tech-indigo" />
                                </div>
                                {t('admin.ldap.title')}
                            </h3>
                            <p className="text-muted-foreground font-medium">{t('admin.ldap.description')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">{t('admin.ldap.relayEndpoint')}</label>
                                    <input
                                        className="flex h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all placeholder:opacity-30"
                                        placeholder="ldap://relay.node.network:389"
                                        value={ldapSettings.server_url}
                                        onChange={e => setLdapSettings({ ...ldapSettings, server_url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">{t('admin.ldap.foundationDN')}</label>
                                    <input
                                        className="flex h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all placeholder:opacity-30"
                                        placeholder="dc=central,dc=command,dc=io"
                                        value={ldapSettings.base_dn}
                                        onChange={e => setLdapSettings({ ...ldapSettings, base_dn: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">{t('admin.ldap.identityTemplate')}</label>
                                    <div className="space-y-2">
                                        <input
                                            className="flex h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all placeholder:opacity-30"
                                            placeholder="uid={username},ou=operators,dc=io"
                                            value={ldapSettings.user_dn_template}
                                            onChange={e => setLdapSettings({ ...ldapSettings, user_dn_template: e.target.value })}
                                        />
                                        <p className="text-[10px] text-tech-indigo font-black uppercase tracking-tighter bg-tech-indigo/10 py-1 px-3 rounded inline-block">{t('admin.ldap.variableHint')}</p>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <label className="flex items-center gap-6 cursor-pointer group p-6 glass-card border-border/20 rounded-[28px] hover:border-tech-indigo/30 transition-all">
                                        <div className={`w-16 h-9 rounded-full transition-all duration-500 relative border ${ldapSettings.is_active ? 'bg-tech-indigo/20 border-tech-indigo/40 shadow-glow-indigo' : 'bg-white/5 border-white/10'
                                            }`}>
                                            <div className={`absolute top-1.5 w-5 h-5 rounded-lg transition-all duration-500 transform ${ldapSettings.is_active ? 'left-9 bg-tech-indigo shadow-glow-indigo-sm' : 'left-1.5 bg-muted-foreground/30'
                                                }`} />
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={ldapSettings.is_active}
                                            onChange={e => setLdapSettings({ ...ldapSettings, is_active: e.target.checked })}
                                        />
                                        <div className="space-y-1">
                                            <div className="font-black text-xs uppercase tracking-widest">{t('admin.ldap.activeStatus')}</div>
                                            <p className="text-[10px] text-muted-foreground font-medium">{t('admin.ldap.activeStatusDesc')}</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-white/5 flex justify-end">
                            <button
                                onClick={saveLDAP}
                                className="flex items-center gap-3 px-10 py-4 tech-button-primary rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95"
                            >
                                <Save size={20} /> {t('admin.ldap.commitState')}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'holidays' ? (
                    <div className="p-8 flex-1 bg-white/5">
                        <HolidayManagement onStatus={setStatus} />
                    </div>
                ) : activeTab === 'ai' ? (
                    <div className="p-12 space-y-12">
                        <div className="space-y-2 border-b border-white/5 pb-8">
                            <h3 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                <div className="p-2 bg-tech-cyan/10 rounded-xl border border-tech-cyan/20">
                                    <Bug className="w-6 h-6 text-tech-cyan" />
                                </div>
                                {t('admin.systemConfig.title')}
                            </h3>
                            <p className="text-muted-foreground font-medium">{t('admin.systemConfig.description')}</p>
                        </div>

                        <div className="flex items-center justify-between p-6 glass-card border-border/20 rounded-[24px]">
                            <div className="space-y-1">
                                <div className="font-black text-sm uppercase tracking-widest text-foreground">{t('admin.systemConfig.aiErrorDump')}</div>
                                <p className="text-xs text-muted-foreground font-medium">{t('admin.systemConfig.aiErrorDumpDesc')}</p>
                            </div>
                            <button
                                onClick={() => updateAppSettings({ enable_ai_debug_dump: !appSettings.enable_ai_debug_dump })}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${appSettings.enable_ai_debug_dump ? 'bg-tech-cyan shadow-glow-cyan' : 'bg-white/10'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${appSettings.enable_ai_debug_dump ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 glass-card border-border/20 rounded-[24px]">
                            <div className="space-y-1">
                                <div className="font-black text-sm uppercase tracking-widest text-foreground">{t('admin.systemConfig.maxParallelJobs')}</div>
                                <p className="text-xs text-muted-foreground font-medium">{t('admin.systemConfig.maxParallelJobsDesc')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    className="h-10 w-20 rounded-xl border border-white/10 bg-black/20 px-3 font-bold text-center focus:ring-2 focus:ring-tech-cyan/30 outline-none transition-all"
                                    value={appSettings.max_concurrent_chunks}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val >= 1 && val <= 20) {
                                            updateAppSettings({ max_concurrent_chunks: val });
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                ) : null}
            </div>

            {/* Modals - Redesigned with Tech Style */}
            {
                showAddUser && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
                        <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-lg w-full p-10 space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tech-indigo" />
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-foreground">{t('admin.addUser.title')}</h2>
                                <p className="text-muted-foreground text-sm font-medium">{t('admin.addUser.description')}</p>
                            </div>
                            <form onSubmit={handleAddUser} className="space-y-5">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">{t('admin.addUser.signature')}</label>
                                        <input
                                            className="h-14 w-full rounded-2xl border border-border bg-background px-5 font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                                            placeholder="X-RAY-01"
                                            value={newUser.username}
                                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">{t('admin.addUser.encryptionCore')}</label>
                                        <input
                                            className="h-14 w-full rounded-2xl border border-border bg-background px-5 font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                                            type="password"
                                            placeholder="••••••••"
                                            value={newUser.password}
                                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                            required={newUser.auth_source === 'standard'}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">{t('admin.addUser.fullDesignation')}</label>
                                            <input
                                                className="h-12 w-full rounded-xl border border-border bg-background px-4 font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                                placeholder="Agent Name"
                                                value={newUser.full_name}
                                                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">{t('admin.addUser.commChannel')}</label>
                                            <input
                                                className="h-12 w-full rounded-xl border border-border bg-background px-4 font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                                placeholder="email@local"
                                                value={newUser.email}
                                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 px-4 py-4 border border-border rounded-2xl hover:bg-muted font-black text-xs uppercase tracking-widest transition-all">{t('admin.addUser.abort')}</button>
                                    <button type="submit" className="flex-1 px-4 py-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">{t('admin.addUser.initialize')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showBulkAdd && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
                        <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-2xl w-full p-10 space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tech-indigo" />
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-foreground">{t('admin.bulkAdd.title')}</h2>
                                <p className="text-muted-foreground text-sm font-medium">{t('admin.bulkAdd.description')}</p>
                            </div>
                            <div className="space-y-6">
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">{t('admin.bulkAdd.protocolFormat')}</p>
                                    <code className="text-xs font-mono text-foreground/80 font-bold">username, Full Name, email</code>
                                </div>
                                <textarea
                                    className="w-full h-64 rounded-2xl border border-border px-6 py-6 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-background font-mono text-sm leading-relaxed custom-scrollbar placeholder:text-muted-foreground/40 font-bold"
                                    placeholder="X-01, Alpha Primary, a@node.net&#10;X-02, Beta Secondary, b@node.net"
                                    value={bulkData}
                                    onChange={e => setBulkData(e.target.value)}
                                />
                                <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                                    <div className="relative flex-1 w-full">
                                        <label className="absolute -top-2.5 left-4 px-2 bg-card text-[9px] font-black text-primary uppercase tracking-widest">{t('admin.bulkAdd.globalKey')}</label>
                                        <input
                                            className="h-14 w-full rounded-2xl border border-border bg-background px-5 font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-40"
                                            type="password"
                                            placeholder="••••••••"
                                            value={bulkPassword}
                                            onChange={e => setBulkPassword(e.target.value)}
                                            disabled={randomPassword}
                                        />
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer group select-none py-2 px-4 bg-muted/50 rounded-2xl border border-border hover:border-primary/30 transition-all">
                                        <input type="checkbox" checked={randomPassword} onChange={e => setRandomPassword(e.target.checked)} className="w-5 h-5 rounded-md border-border bg-background text-primary focus:ring-primary" />
                                        <span className="font-black text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{t('admin.bulkAdd.generateEntropy')}</span>
                                    </label>
                                </div>
                                <div className="flex gap-4 pt-6 border-t border-border">
                                    <button onClick={() => setShowBulkAdd(false)} className="flex-1 px-4 py-4 border border-border rounded-2xl hover:bg-muted font-black text-xs uppercase tracking-widest transition-all">{t('admin.bulkAdd.cancel')}</button>
                                    <button onClick={handleBulkAdd} className="flex-1 px-4 py-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">{t('admin.bulkAdd.commitSync')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
