import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
    Users,
    Plus,
    Save,
    Server,
    ShieldCheck,
    UserPlus,
    Loader2,
    CheckCircle2,
    XCircle,
    Calendar
} from 'lucide-react';
import { HolidayManagement } from '@/components/admin/HolidayManagement';

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
    const [activeTab, setActiveTab] = useState<'users' | 'ldap' | 'holidays'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [ldapSettings, setLdapSettings] = useState<LDAPSettings>({
        server_url: '',
        base_dn: '',
        user_dn_template: '',
        is_active: false
    });
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
            }
            // holidays tab 由 HolidayManagement 元件自行管理
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
            setStatus({ type: 'success', message: 'User created' });
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
            setStatus({ type: 'success', message: 'Bulk import completed' });
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
            setStatus({ type: 'success', message: 'User role updated' });
            fetchData();
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
        }
    };

    const saveLDAP = async () => {
        try {
            await api.put('/admin/ldap-settings', ldapSettings);
            setStatus({ type: 'success', message: 'LDAP settings updated' });
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message });
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
                            Command Center
                        </h1>
                    </div>
                    <p className="text-muted-foreground font-medium ml-1">Manage infrastructure, security protocols, and operational users</p>
                </div>

                <div className="flex bg-muted/20 p-1 rounded-2xl border border-white/5 backdrop-blur-sm">
                    {[
                        { id: 'users', icon: Users, label: 'Operators' },
                        { id: 'ldap', icon: Server, label: 'LDAP Node' },
                        { id: 'holidays', icon: Calendar, label: 'Timeline Adjust' },
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
                    <button onClick={() => setStatus(null)} className="text-xs font-black uppercase opacity-60 hover:opacity-100 transition-opacity tracking-widest">Acknowledge</button>
                </div>
            )}

            <div className="glass-card border-border/20 rounded-[32px] overflow-hidden min-h-[600px] flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tech-indigo opacity-30" />

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-32">
                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-glow" />
                        <p className="font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Retrieving System State</p>
                    </div>
                ) : activeTab === 'users' ? (
                    <div className="flex flex-col flex-1">
                        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/5">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black tracking-tight">Access Directory</h3>
                                <span className="text-[10px] font-black bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-tighter shadow-glow-sm">
                                    {users.length} AUTHENTICATED ENTITIES
                                </span>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowBulkAdd(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 glass-card border-border/30 rounded-xl hover:bg-white/10 font-bold text-xs uppercase tracking-widest transition-all"
                                >
                                    <UserPlus size={16} /> Bulk Sync
                                </button>
                                <button
                                    onClick={() => setShowAddUser(true)}
                                    className="flex items-center gap-2 px-6 py-2.5 tech-button-primary rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    <Plus size={18} /> New Entry
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto p-2">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-muted/10 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                                        <th className="px-8 py-5 rounded-tl-2xl">Identity Signature</th>
                                        <th className="px-8 py-5">Designated Title</th>
                                        <th className="px-8 py-5 text-center">Auth Vector</th>
                                        <th className="px-8 py-5 text-center">Security Clear.</th>
                                        <th className="px-8 py-5 text-right rounded-tr-2xl">Override</th>
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
                                                            <ShieldCheck size={12} /> Root admin
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 text-[10px] font-black uppercase tracking-[0.2em]">Standard</span>
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
                                                    {u.is_admin ? 'RESCIND' : 'ELEVATE'}
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
                                LDAP Core Configuration
                            </h3>
                            <p className="text-muted-foreground font-medium">Synchronize external neural directories with the central command infrastructure</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">Relay Endpoint URL</label>
                                    <input
                                        className="flex h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all placeholder:opacity-30"
                                        placeholder="ldap://relay.node.network:389"
                                        value={ldapSettings.server_url}
                                        onChange={e => setLdapSettings({ ...ldapSettings, server_url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">Foundation DN Path</label>
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
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] ml-1">Identity Vector Template</label>
                                    <div className="space-y-2">
                                        <input
                                            className="flex h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-indigo/30 outline-none transition-all placeholder:opacity-30"
                                            placeholder="uid={username},ou=operators,dc=io"
                                            value={ldapSettings.user_dn_template}
                                            onChange={e => setLdapSettings({ ...ldapSettings, user_dn_template: e.target.value })}
                                        />
                                        <p className="text-[10px] text-tech-indigo font-black uppercase tracking-tighter bg-tech-indigo/10 py-1 px-3 rounded inline-block">Variable: {'{username}'} is dynamic</p>
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
                                            <div className="font-black text-xs uppercase tracking-widest">Active Relay Status</div>
                                            <p className="text-[10px] text-muted-foreground font-medium">Permit cross-link authentication with LDAP nodes</p>
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
                                <Save size={20} /> Commit Operational State
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'holidays' ? (
                    <div className="p-8 flex-1 bg-white/5">
                        <HolidayManagement onStatus={setStatus} />
                    </div>
                ) : null}
            </div>

            {/* Modals - Redesigned with Tech Style */}
            {showAddUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
                    <div className="glass-card border-white/10 rounded-[32px] shadow-2xl max-w-lg w-full p-10 space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/40" />
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black tracking-tight">Operator Initialization</h2>
                            <p className="text-muted-foreground text-sm font-medium">Register a human entity for tactical operations</p>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-5">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Signature (Username)</label>
                                    <input
                                        className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                        placeholder="X-RAY-01"
                                        value={newUser.username}
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Encryption Core (Password)</label>
                                    <input
                                        className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                        type="password"
                                        placeholder="••••••••"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        required={newUser.auth_source === 'standard'}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Full Designation</label>
                                        <input
                                            className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-primary/30 outline-none"
                                            placeholder="Agent Name"
                                            value={newUser.full_name}
                                            onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Comm Channel</label>
                                        <input
                                            className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold focus:ring-2 focus:ring-primary/30 outline-none"
                                            placeholder="email@local"
                                            value={newUser.email}
                                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 px-4 py-4 border border-white/10 rounded-2xl hover:bg-white/5 font-black text-xs uppercase tracking-widest transition-all">Abort</button>
                                <button type="submit" className="flex-1 px-4 py-4 tech-button-primary rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Initialize</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkAdd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
                    <div className="glass-card border-white/10 rounded-[40px] shadow-2xl max-w-2xl w-full p-10 space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-tech-cyan/40" />
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black tracking-tight">Bulk Node Sync</h2>
                            <p className="text-muted-foreground text-sm font-medium">Mass population of identity clusters into core directory</p>
                        </div>
                        <div className="space-y-6">
                            <div className="p-4 bg-tech-cyan/5 border border-tech-cyan/10 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-tech-cyan mb-2">Protocol Format:</p>
                                <code className="text-xs font-mono text-foreground/80 font-bold">username, Full Name, email</code>
                            </div>
                            <textarea
                                className="w-full h-64 rounded-3xl border border-white/10 px-6 py-6 focus:ring-2 focus:ring-tech-cyan/30 outline-none bg-black/30 font-mono text-sm leading-relaxed custom-scrollbar placeholder:opacity-20 font-bold"
                                placeholder="X-01, Alpha Primary, a@node.net&#10;X-02, Beta Secondary, b@node.net"
                                value={bulkData}
                                onChange={e => setBulkData(e.target.value)}
                            />
                            <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                                <div className="relative flex-1 w-full">
                                    <label className="absolute -top-2.5 left-4 px-2 bg-slate-900 text-[9px] font-black text-tech-cyan uppercase tracking-widest">Global Encryption Key</label>
                                    <input
                                        className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 font-bold focus:ring-2 focus:ring-tech-cyan/30 outline-none transition-all disabled:opacity-20"
                                        type="password"
                                        placeholder="••••••••"
                                        value={bulkPassword}
                                        onChange={e => setBulkPassword(e.target.value)}
                                        disabled={randomPassword}
                                    />
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer group select-none py-2 px-4 glass-card rounded-2xl border-white/5 hover:border-tech-cyan/20 transition-all">
                                    <input type="checkbox" checked={randomPassword} onChange={e => setRandomPassword(e.target.checked)} className="w-5 h-5 rounded-md border-white/10 bg-white/5 text-tech-cyan focus:ring-tech-cyan" />
                                    <span className="font-black text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-tech-cyan transition-colors">Generate entropy</span>
                                </label>
                            </div>
                            <div className="flex gap-4 pt-6 border-t border-white/5">
                                <button onClick={() => setShowBulkAdd(false)} className="flex-1 px-4 py-4 border border-white/10 rounded-2xl hover:bg-white/5 font-black text-xs uppercase tracking-widest transition-all">Cancel</button>
                                <button onClick={handleBulkAdd} className="flex-1 px-4 py-4 bg-gradient-to-r from-tech-cyan to-tech-indigo text-white shadow-glow-cyan rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Commit Sync</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
