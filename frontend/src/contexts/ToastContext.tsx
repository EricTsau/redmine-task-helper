import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

type ToastType = 'success' | 'warning' | 'error';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showSuccess: (message: string) => void;
    showWarning: (message: string) => void;
    showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdRef = React.useRef(0);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 3 seconds
        setTimeout(() => removeToast(id), 3000);
    }, [removeToast]);

    const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
    const showWarning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);
    const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);

    const getToastStyles = (type: ToastType) => {
        switch (type) {
            case 'error':
                return 'bg-red-500 text-white';
            case 'warning':
                return 'bg-yellow-500 text-black';
            case 'success':
            default:
                return 'bg-green-500 text-white';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showWarning, showError }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            ${getToastStyles(toast.type)}
                            px-4 py-3 rounded-lg shadow-lg
                            flex items-center gap-3
                            min-w-[250px] max-w-[400px]
                            pointer-events-auto
                            animate-in slide-in-from-right-full duration-300
                        `}
                    >
                        <span className="flex-1 text-sm font-medium">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:opacity-70 transition-opacity"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
