import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { LogIn, ShieldAlert, Loader2, User, Lock } from 'lucide-react';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authSource, setAuthSource] = useState<'standard' | 'ldap'>('standard');
    const [ldapEnabled, setLdapEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkLdap = async () => {
            try {
                const res = await api.get<{ ldap_enabled: boolean }>('/auth/ldap-status');
                setLdapEnabled(res.ldap_enabled);
            } catch (e) {
                console.error("Failed to check LDAP status", e);
            }
        };
        checkLdap();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await api.post<{ access_token: string, username: string, is_admin: boolean }>('/auth/login', {
                username,
                password,
                auth_source: authSource
            });
            login(res.access_token, res.username, res.is_admin);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="w-full max-w-md p-8 space-y-6 bg-card border rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="space-y-2 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Redmine Flow</h1>
                    <p className="text-muted-foreground">Please sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Authentication Method
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setAuthSource('standard')}
                                className={`py-2 px-4 text-sm font-medium border rounded-md transition-all ${authSource === 'standard'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-input'
                                    }`}
                            >
                                Standard
                            </button>
                            <button
                                type="button"
                                onClick={() => setAuthSource('ldap')}
                                disabled={!ldapEnabled}
                                className={`py-2 px-4 text-sm font-medium border rounded-md transition-all ${authSource === 'ldap'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-input'
                                    } ${!ldapEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                LDAP
                            </button>
                        </div>
                        {!ldapEnabled && authSource === 'ldap' && (
                            <p className="text-xs text-destructive">LDAP is currently disabled</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 animate-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <button
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Sign In
                    </button>
                </form>

                <div className="text-center text-xs text-muted-foreground">
                    Contact your administrator if you've lost access
                </div>
            </div>
        </div>
    );
};
