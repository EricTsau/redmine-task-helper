import { useState, useEffect } from 'react';
import { useTimer } from '@/contexts/TimerContext';
import { useNavigate } from 'react-router-dom';
import { TaskListView } from '@/components/dashboard/TaskListView';
import { WatchlistStats } from '@/components/dashboard/WatchlistStats';
import { TaskGroupView, TaskImportModal } from '@/components/tracking';
import { Link } from 'react-router-dom';
import { Settings, AlertCircle, Loader2, Plus, ListTodo, Bookmark } from 'lucide-react';
import { ChatBox } from '@/components/Chat/ChatBox';

import { api } from '@/lib/api';
import { isTokenExpired } from '@/lib/jwt';

type SetupStatus = 'loading' | 'not_configured' | 'connection_error' | 'ready';
type ViewTab = 'my-tasks' | 'tracked';

export function Dashboard() {
    const { timer, startTimer, submitEntry } = useTimer();
    const navigate = useNavigate();
    const [setupStatus, setSetupStatus] = useState<SetupStatus>('loading');

    const [errorMessage, setErrorMessage] = useState<string>('');
    const [activeTab, setActiveTab] = useState<ViewTab>('my-tasks');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const checkSetup = async () => {
        const token = localStorage.getItem('token');
        if (!token || isTokenExpired(token)) {
            // If invalid/expired, skip validation
            setSetupStatus('not_configured');
            return;
        }
        if (!token) {
            setSetupStatus('not_configured'); // Or maybe 'ready' if we just want to show login? 
            // Actually, if no token, we are likely not logged in.
            // But checkSetup is checking if REDMINE is configured.
            // The validate endpoint requires auth.
            // If we are not logged in, we shouldn't call validate.
            // But the Dashboard seems to assume we might be logged in?

            // Wait, if we are not logged in, we should be on Login page, right?
            // Dashboard is a protected route? 
            // If so, AuthContext should redirect us.
            // Let's assume we are here because we have a token (or think we do).

            // If we truly have no token, we can't call validate.
            // So return early.
            return;
        }

        try {
            // Use validate endpoint which uses stored credentials
            await api.get('/auth/validate');
            setSetupStatus('ready');
        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                // Token invalid/expired
                // AuthContext usually handles this via 401 interceptor?
                // But we simulate it here.
                // Just stop loading without error message
                setSetupStatus('ready');
                return;
            }

            if (error.response && error.response.status === 400 && error.response.data && error.response.data.detail === 'Redmine not configured') {
                setSetupStatus('not_configured');
            } else if (error.response) {
                setSetupStatus('connection_error');
                setErrorMessage(error.response.data?.detail || 'Unable to connect to Redmine');
            } else {
                setSetupStatus('connection_error');
                setErrorMessage('Unable to reach backend server');
            }
        }
    };

    useEffect(() => {
        checkSetup();
    }, []);

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
                    <h2 className="text-xl font-semibold">Welcome to Redmine Task Helper</h2>
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

    const handleStartTimer = async (issueId: number) => {
        if (timer && timer.issue_id !== issueId && timer.status !== 'stopped') {
            const confirm = window.confirm(`目前已有正在進行的任務 #${timer.issue_id}，開始新任務將自動結算當前任務。確定繼續？`);
            if (!confirm) return;

            try {
                await submitEntry(timer.id, "Auto-submitted when switching tasks");
            } catch (e) {
                console.error("Failed to auto-submit previous task", e);
            }
        }

        await startTimer(issueId);
        navigate('/focus');
    };

    return (
        <div className="space-y-4">
            {/* Watchlist Stats (Phase 2) */}
            <WatchlistStats />

            {/* AI Chat Logger */}
            <ChatBox />

            {/* Tab Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    <button
                        onClick={() => setActiveTab('my-tasks')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'my-tasks'
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <ListTodo className="h-4 w-4" />
                        我的任務
                    </button>
                    <button
                        onClick={() => setActiveTab('tracked')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tracked'
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Bookmark className="h-4 w-4" />
                        追蹤任務
                    </button>
                </div>

                {/* Import Button (only show on tracked tab) */}
                {activeTab === 'tracked' && (
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        匯入任務
                    </button>
                )}
            </div>

            {/* Content */}
            {activeTab === 'my-tasks' ? (
                <TaskListView startTimer={handleStartTimer} />
            ) : (
                <TaskGroupView
                    key={refreshKey}
                    startTimer={handleStartTimer}
                    onRefresh={() => setRefreshKey(k => k + 1)}
                />
            )}

            {/* Import Modal */}
            <TaskImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={() => setRefreshKey(k => k + 1)}
            />
        </div>
    );
}
