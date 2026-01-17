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
    XCircle
} from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'users' | 'ldap'>('users');
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
            } else {
                const res = await api.get<LDAPSettings>('/admin/ldap-settings');
                setLdapSettings(res);
            }
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
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
                    <p className="text-muted-foreground text-lg">Manage users, security, and system settings</p>
                </div>
                <div className="flex gap-2 p-1 bg-muted rounded-xl shadow-inner border">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'users' ? 'bg-background shadow-md text-primary scale-105' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Users size={18} /> Users
                    </button>
                    <button
                        onClick={() => setActiveTab('ldap')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'ldap' ? 'bg-background shadow-md text-primary scale-105' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Server size={18} /> LDAP
                    </button>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-xl border flex items-center justify-between animate-in slide-in-from-top-4 duration-300 ${status.type === 'success' ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}>
                    <div className="flex items-center gap-3 font-medium">
                        {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                        {status.message}
                    </div>
                    <button onClick={() => setStatus(null)} className="text-sm opacity-60 hover:opacity-100 transition-opacity">Dismiss</button>
                </div>
            )}

            <div className="bg-card border rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 py-32 opacity-50">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="font-medium">Loading records...</p>
                    </div>
                ) : activeTab === 'users' ? (
                    <div className="p-8 space-y-8">
                        <div className="flex items-center justify-between border-b pb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                User Directory <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{users.length} total</span>
                            </h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowBulkAdd(true)}
                                    className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-muted font-semibold transition-all"
                                >
                                    <UserPlus size={18} /> Bulk Create
                                </button>
                                <button
                                    onClick={() => setShowAddUser(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} /> New User
                                </button>
                            </div>
                        </div>

                        <div className="border rounded-2xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-sm text-muted-foreground uppercase tracking-wider">Username</th>
                                        <th className="px-6 py-4 font-bold text-sm text-muted-foreground uppercase tracking-wider">Full Name</th>
                                        <th className="px-6 py-4 font-bold text-sm text-muted-foreground uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-4 font-bold text-sm text-muted-foreground uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 font-bold text-sm text-muted-foreground uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4 font-semibold text-foreground">{u.username}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{u.full_name || '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${u.auth_source === 'ldap' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'
                                                    }`}>
                                                    <Server size={12} className={u.auth_source === 'ldap' ? 'block' : 'hidden'} />
                                                    {u.auth_source}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {u.is_admin ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase">
                                                        <ShieldCheck size={12} /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-tighter">Standard</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleAdmin(u.id)}
                                                    className="px-3 py-1 text-xs font-bold border rounded-lg hover:bg-muted transition-all"
                                                >
                                                    {u.is_admin ? 'Demote' : 'Promote to Admin'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 space-y-10">
                        <div className="space-y-2 border-b pb-6">
                            <h3 className="text-2xl font-bold text-foreground">LDAP Configuration</h3>
                            <p className="text-muted-foreground">Configure global authentication for LDAP users</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground uppercase tracking-wider">Server URL</label>
                                    <input
                                        className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 font-medium focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                                        placeholder="ldap://ldap.company.com:389"
                                        value={ldapSettings.server_url}
                                        onChange={e => setLdapSettings({ ...ldapSettings, server_url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground uppercase tracking-wider">Base DN</label>
                                    <input
                                        className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 font-medium focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                                        placeholder="dc=company,dc=com"
                                        value={ldapSettings.base_dn}
                                        onChange={e => setLdapSettings({ ...ldapSettings, base_dn: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground uppercase tracking-wider">User DN Template</label>
                                    <input
                                        className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 font-medium focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                                        placeholder="uid={username},ou=users,dc=company,dc=com"
                                        value={ldapSettings.user_dn_template}
                                        onChange={e => setLdapSettings({ ...ldapSettings, user_dn_template: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground italic">Use {'{username}'} as placeholder</p>
                                </div>
                                <div className="pt-8">
                                    <label className="flex items-center gap-4 cursor-pointer group">
                                        <div className={`w-14 h-8 rounded-full transition-all duration-300 relative ${ldapSettings.is_active ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-muted border'}`}>
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 transform ${ldapSettings.is_active ? 'left-7' : 'left-1'}`} />
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={ldapSettings.is_active}
                                            onChange={e => setLdapSettings({ ...ldapSettings, is_active: e.target.checked })}
                                        />
                                        <div className="space-y-0.5">
                                            <span className="font-bold text-foreground">Enable LDAP Login</span>
                                            <p className="text-xs text-muted-foreground">Allow users to sign in using their LDAP credentials</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t flex justify-end">
                            <button
                                onClick={saveLDAP}
                                className="flex items-center gap-3 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95"
                            >
                                <Save size={20} /> Save Configuration
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals could be implemented here */}
            {showAddUser && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    {/* Simple Modal Implementation */}
                    <div className="bg-card border rounded-3xl shadow-2xl max-w-lg w-full p-8 space-y-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold tracking-tight">Create New User</h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <input
                                className="flex h-12 w-full rounded-xl border px-4 focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Username"
                                value={newUser.username}
                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                required
                            />
                            <input
                                className="flex h-12 w-full rounded-xl border px-4 focus:ring-2 focus:ring-primary outline-none"
                                type="password"
                                placeholder="Password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                required={newUser.auth_source === 'standard'}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    className="flex h-12 w-full rounded-xl border px-4 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Full Name"
                                    value={newUser.full_name}
                                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                />
                                <input
                                    className="flex h-12 w-full rounded-xl border px-4 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 px-4 py-3 border rounded-xl hover:bg-muted font-bold transition-all">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkAdd && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-card border rounded-3xl shadow-2xl max-w-2xl w-full p-8 space-y-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold tracking-tight">Bulk Create Users</h2>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Format: <code className="bg-muted px-1 rounded">username, Full Name, email</code> (one per line)</p>
                            <textarea
                                className="w-full h-48 rounded-2xl border px-4 py-4 focus:ring-2 focus:ring-primary outline-none bg-muted/20 font-mono text-sm leading-relaxed"
                                placeholder="johndoe, John Doe, john@example.com&#10;janedoe, Jane Doe, jane@example.com"
                                value={bulkData}
                                onChange={e => setBulkData(e.target.value)}
                            />
                            <div className="flex items-center gap-4 py-2">
                                <input
                                    className="flex h-12 flex-1 rounded-xl border px-4 focus:ring-2 focus:ring-primary outline-none"
                                    type="password"
                                    placeholder="Common Password"
                                    value={bulkPassword}
                                    onChange={e => setBulkPassword(e.target.value)}
                                    disabled={randomPassword}
                                />
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm select-none">
                                    <input type="checkbox" checked={randomPassword} onChange={e => setRandomPassword(e.target.checked)} className="w-5 h-5 rounded-md border-primary text-primary focus:ring-primary" />
                                    Randomly generate
                                </label>
                            </div>
                            <div className="flex gap-4 pt-4 border-t">
                                <button onClick={() => setShowBulkAdd(false)} className="flex-1 px-4 py-3 border rounded-xl hover:bg-muted font-bold transition-all">Cancel</button>
                                <button onClick={handleBulkAdd} className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Import Users</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
