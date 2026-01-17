import { useState, useEffect } from 'react';
import { WorkLogEditor } from '@/components/timer/WorkLogEditor';
import { useTimer, type TimeEntry } from '@/hooks/useTimer';
import { Play, Pause, Square, Clock, FileText } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';

interface FocusModeProps {
    timer: TimeEntry;
    stopTimer: () => void;
}

interface IssueDetails {
    id: number;
    subject: string;
    description: string;
    journals: Array<{
        id: number;
        notes: string;
        created_on: string;
        user: string;
    }>;
}

const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatDateTime = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
};

export function FocusMode({ timer, stopTimer }: FocusModeProps) {
    const { updateLog, submitEntry, startTimer, pauseTimer, elapsed } = useTimer();
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);

    // Fetch issue details on mount
    useEffect(() => {
        const fetchIssueDetails = async () => {
            try {
                const data = await api.get<IssueDetails>(`/issues/${timer.issue_id}`);
                setIssueDetails(data);
            } catch (e) {
                console.error('Failed to fetch issue details:', e);
            }
        };
        fetchIssueDetails();
    }, [timer.issue_id]);

    const handleTogglePause = () => {
        if (timer.status === 'running') {
            pauseTimer();
        } else {
            startTimer(timer.issue_id);
        }
    };

    const handleStopAndSubmitClick = () => {
        setShowConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        try {
            const finalContent = timer.content || '';

            // 1. Stop the timer first
            stopTimer();

            // 2. Submit to Redmine
            await submitEntry(timer.id, finalContent);

            setShowConfirm(false);
        } catch (e) {
            console.error("Stop and Submit failed", e);
            alert("Failed to submit to Redmine. Timer stopped.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background overflow-auto flex flex-col p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="text-center space-y-2 mb-6">
                <h2 className="text-3xl font-bold tracking-tight">
                    Focusing on Task #{timer.issue_id}
                </h2>
                {issueDetails && (
                    <p className="text-lg text-muted-foreground">{issueDetails.subject}</p>
                )}
            </div>

            {/* Timer Display with Controls */}
            <div className="flex items-center justify-center gap-6 mb-8">
                {/* Timer */}
                <div className="text-center">
                    <span className={`text-5xl font-mono font-bold ${timer.status === 'paused' ? 'text-yellow-500' : 'text-primary'}`}>
                        {formatDuration(elapsed)}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                        {timer.status === 'paused' ? 'Paused' : 'Running'}
                    </p>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-3">
                    {/* Toggle Pause/Play Button */}
                    <button
                        onClick={handleTogglePause}
                        className={`p-4 rounded-full transition-all shadow-lg ${timer.status === 'paused'
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-yellow-500 text-white hover:bg-yellow-600'
                            }`}
                        title={timer.status === 'running' ? "Pause" : "Resume"}
                    >
                        {timer.status === 'running'
                            ? <Pause className="h-6 w-6 fill-current" />
                            : <Play className="h-6 w-6 fill-current" />
                        }
                    </button>

                    {/* Stop & Submit Button */}
                    <button
                        onClick={handleStopAndSubmitClick}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg"
                        title="Stop Timer & Submit to Redmine"
                    >
                        <Square className="h-5 w-5 fill-current" />
                        Stop & Submit
                    </button>
                </div>
            </div>

            {/* Main Content Area - Two Columns */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Left Column: Notes Editor */}
                <div className="flex flex-col min-h-0">
                    <div className="p-6 bg-muted/30 rounded-lg border flex-1 flex flex-col min-h-0">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Notes
                        </h3>
                        <div className="flex-1 overflow-hidden">
                            <WorkLogEditor
                                initialContent={timer.content || ''}
                                onUpdate={(c) => updateLog(c)}
                                onSubmit={() => handleStopAndSubmitClick()}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Issue Description & History */}
                <div className="flex flex-col gap-4 min-h-0 overflow-auto">
                    {/* Issue Description */}
                    {issueDetails?.description && (
                        <div className="p-4 bg-muted/30 rounded-lg border">
                            <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">
                                工作描述
                            </h4>
                            <div className="prose prose-sm max-w-none text-foreground">
                                <pre className="whitespace-pre-wrap font-sans text-sm">
                                    {issueDetails.description}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* History Notes */}
                    <div className="p-4 bg-muted/30 rounded-lg border flex-1 overflow-auto">
                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            歷史 Notes
                        </h4>
                        {issueDetails?.journals && issueDetails.journals.length > 0 ? (
                            <div className="space-y-4">
                                {issueDetails.journals.map((journal) => (
                                    <div
                                        key={journal.id}
                                        className="p-3 bg-background rounded border-l-4 border-primary/30"
                                    >
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                            <span className="font-medium">{journal.user}</span>
                                            <span>•</span>
                                            <span>{formatDateTime(journal.created_on)}</span>
                                        </div>
                                        <pre className="whitespace-pre-wrap font-sans text-sm">
                                            {journal.notes}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">尚無歷史記錄</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={showConfirm}
                title="確認送出"
                onConfirm={handleConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                confirmText={isSubmitting ? "送出中..." : "確認送出"}
                cancelText="取消"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Clock className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">紀錄時間</p>
                            <p className="text-xl font-mono font-bold">{formatDuration(elapsed)}</p>
                        </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Notes 內容
                        </p>
                        {timer.content ? (
                            <pre className="whitespace-pre-wrap font-sans text-sm max-h-32 overflow-auto">
                                {timer.content}
                            </pre>
                        ) : (
                            <p className="text-muted-foreground italic text-sm">（無 Notes）</p>
                        )}
                    </div>
                </div>
            </ConfirmDialog>
        </div>
    );
}
