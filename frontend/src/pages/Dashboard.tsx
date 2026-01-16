import { useState, useEffect } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { FocusMode } from '@/components/dashboard/FocusMode';
import { TaskListView } from '@/components/dashboard/TaskListView';
import { Link } from 'react-router-dom';
import { Settings, AlertCircle, Loader2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

type SetupStatus = 'loading' | 'not_configured' | 'connection_error' | 'ready';

export function Dashboard() {
    const { timer, startTimer, stopTimer } = useTimer();
    const [setupStatus, setSetupStatus] = useState<SetupStatus>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        checkSetup();
    }, []);

    const checkSetup = async () => {
        try {
            // Use validate endpoint which uses stored credentials
            const res = await fetch(`${API_BASE}/auth/validate`);

            if (res.ok) {
                setSetupStatus('ready');
            } else {
                const err = await res.json();
                if (res.status === 400 && err.detail === 'Redmine not configured') {
                    setSetupStatus('not_configured');
                } else {
                    setSetupStatus('connection_error');
                    setErrorMessage(err.detail || 'Unable to connect to Redmine');
                }
            }
        } catch (e) {
            setSetupStatus('connection_error');
            setErrorMessage('Unable to reach backend server');
        }
    };

    // Loading state
    if (setupStatus === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Checking configuration...</p>
            </div>
        );
    }

    // Not configured state
    if (setupStatus === 'not_configured') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-6">
                <div className="p-4 bg-muted rounded-full">
                    <Settings className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Welcome to Redmine Flow</h2>
                    <p className="text-muted-foreground max-w-md">
                        請先設定 Redmine 連線資訊才能開始使用
                    </p>
                </div>
                <Link
                    to="/settings"
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    前往設定
                </Link>
            </div>
        );
    }

    // Connection error state
    if (setupStatus === 'connection_error') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-6">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-destructive">連線失敗</h2>
                    <p className="text-muted-foreground max-w-md">
                        {errorMessage}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setSetupStatus('loading'); checkSetup(); }}
                        className="px-4 py-2 border rounded-md hover:bg-muted"
                    >
                        重試
                    </button>
                    <Link
                        to="/settings"
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        檢查設定
                    </Link>
                </div>
            </div>
        );
    }

    // Ready - show normal dashboard
    if (timer && timer.is_running) {
        return <FocusMode timer={timer} stopTimer={() => stopTimer()} />;
    }

    return <TaskListView startTimer={startTimer} />;
}
