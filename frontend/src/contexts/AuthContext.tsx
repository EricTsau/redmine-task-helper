import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

interface User {
    id: number;
    username: string;
    is_admin: boolean;
    full_name?: string;
    email?: string;
    auth_source: string;
    redmine_url?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, username: string, is_admin: boolean, refreshToken?: string) => void;
    logout: () => void;
    isLoading: boolean;
    isRedmineAccessible: boolean;
    checkRedmineAccess: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);
    const [isRedmineAccessible, setIsRedmineAccessible] = useState(false);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            api.setToken(token);
            fetchMe();
        } else {
            localStorage.removeItem('token');
            api.setToken(null);
            setUser(null);
            setIsLoading(false);
        }
    }, [token]);

    // Register auth failure callback
    useEffect(() => {
        api.onUnauthorized(() => {
            logout();
        });
    }, []);

    const checkRedmineAccess = async () => {
        try {
            await api.get('/auth/validate');
            setIsRedmineAccessible(true);
            return true;
        } catch (error) {
            setIsRedmineAccessible(false);
            return false;
        }
    };

    const fetchMe = async () => {
        try {
            const response = await api.get<User>('/auth/me');
            setUser(response);
            await checkRedmineAccess();
        } catch (error) {
            console.error('Failed to fetch user', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = (newToken: string, _username: string, _is_admin: boolean, refreshToken?: string) => {
        if (refreshToken) {
            api.setRefreshToken(refreshToken);
        }
        setToken(newToken);
        // User will be fetched by the useEffect
    };

    const logout = () => {
        setToken(null);
        api.setRefreshToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading, isRedmineAccessible, checkRedmineAccess }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
