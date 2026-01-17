import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

interface User {
    username: string;
    is_admin: boolean;
    full_name?: string;
    email?: string;
    auth_source: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, username: string, is_admin: boolean) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

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

    const fetchMe = async () => {
        try {
            const response = await api.get<User>('/auth/me');
            setUser(response);
        } catch (error) {
            console.error('Failed to fetch user', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = (newToken: string, username: string, is_admin: boolean) => {
        setToken(newToken);
        // User will be fetched by the useEffect
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
