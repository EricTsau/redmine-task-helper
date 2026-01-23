import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface LoginResponse {
    access_token: string;
    refresh_token: string;
    username: string;
    is_admin: boolean;
}

export function Login() {
    const { login } = useAuth();
    const { showSuccess, showError } = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await api.post<LoginResponse>('/auth/login', {
                username,
                password
            });

            login(
                response.access_token,
                response.username,
                response.is_admin,
                response.refresh_token
            );

            showSuccess(t('login.success'));
            navigate("/");
        } catch (error) {
            showError(t('login.error'));
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-modern-app overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-tech-cyan/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tech-violet/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

            <div className="w-full max-w-md z-10 transition-all duration-1000 animate-in fade-in zoom-in-95">
                <div className="glass-card p-8 space-y-8 rounded-2xl">
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-tech-cyan to-tech-indigo font-sans">
                            {t('login.title')}
                        </h1>
                        <p className="text-muted-foreground font-medium">{t('login.subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground ml-1">{t('login.username')}</label>
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl tech-input outline-none font-medium"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground ml-1">{t('login.password')}</label>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl tech-input outline-none font-medium"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 rounded-xl tech-button-primary font-bold flex items-center justify-center space-x-2 transition-all active:scale-95"
                        >
                            {isLoading ? (
                                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                                <span>{t('login.submit')}</span>
                            )}
                        </button>
                    </form>

                    <div className="pt-6 text-center border-t border-border/30">
                        <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                            {t('login.copyright')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
