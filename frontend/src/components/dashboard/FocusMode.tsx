import { useState, useEffect, useCallback } from 'react';
import { WorkLogEditor } from '@/components/timer/WorkLogEditor';
import ReactMarkdown from 'react-markdown';
import { type TimeEntry } from '@/contexts/TimerContext';
import { Play, Pause, Square, Clock, FileText, Edit3, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { PendingFile } from '@/hooks/useFileAttachments';

const AuthenticatedImage = ({ src, alt, attachments }: { src?: string; alt?: string; attachments?: any[] }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [_loading, _setLoading] = useState(false);
    const [_error, _setError] = useState(false);

    useEffect(() => {
        if (!src) return;

        // 1. Check if it's a pending file (local blob)
        if (src.startsWith('pending:')) return;
        if (src.startsWith('blob:')) return;

        // 2. Check if we have an attachment matching this filename
        // Filename might be a URL in some markdown renderers, but usually it's just 'image.png'
        const filename = src.split('/').pop();
        const attachment = attachments?.find(a => a.filename === filename || a.filename === src);

        if (attachment) {
            _setLoading(true);
            setObjectUrl(attachment.content_url);
            _setLoading(false);
        }
    }, [src, attachments]);

    if (objectUrl) {
        return (
            <span className="relative inline-block max-w-full">
                <img
                    src={objectUrl}
                    alt={alt}
                    className="max-w-full h-auto rounded border"
                    onError={() => _setError(true)}
                />
            </span>
        );
    }

    // Fallback
    return (
        <span className="text-xs text-muted-foreground border p-1 rounded inline-block max-w-full truncate">
            {src?.startsWith('http') ? <img src={src} alt={alt} className="max-w-full h-auto" /> : (alt || src || 'Image')}
        </span>
    );
};


interface FocusModeProps {
    timer: TimeEntry;
    elapsed: number;
    onPause: () => void;
    onResume: (issueId: number) => void;
    onStop: () => void;
    onUpdateLog: (content: string) => void;
    onSubmit: (sessionId?: number, comments?: string) => Promise<void>;
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
    estimated_hours: number | null;
    spent_hours: number | null;
    attachments: Array<{
        filename: string;
        content_url: string;
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

export function FocusMode({
    timer,
    elapsed,
    onPause,
    onResume,
    onStop,
    onUpdateLog,
    onSubmit
}: FocusModeProps) {
    const { showSuccess, showError } = useToast();
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);

    // Local notes state - syncs with parent but allows local editing
    const [localNotes, setLocalNotes] = useState(timer.content || '');

    // Edit journal modal state
    const [editingJournal, setEditingJournal] = useState<{
        id: number;
        notes: string;
        user: string;
        created_on: string;
    } | null>(null);
    const [editedNotes, setEditedNotes] = useState('');

    // Fetch issue details
    const fetchIssueDetails = useCallback(async () => {
        try {
            const data = await api.get<IssueDetails>(`/issues/${timer.issue_id}`);
            setIssueDetails(data);
        } catch (e) {
            console.error('Failed to fetch issue details:', e);
        }
    }, [timer.issue_id]);

    useEffect(() => {
        fetchIssueDetails();
    }, [fetchIssueDetails]);

    // Sync local notes when timer.content changes
    useEffect(() => {
        setLocalNotes(timer.content || '');
    }, [timer.content]);

    const handleTogglePause = () => {
        if (timer.status === 'running') {
            onPause();
        } else {
            onResume(timer.issue_id);
        }
    };

    const handleNotesChange = (content: string) => {
        setLocalNotes(content);
        // Sync to parent immediately
        onUpdateLog(content);
    };

    const handleStopAndSubmitClick = () => {
        // Sync the latest local notes before showing confirm
        onUpdateLog(localNotes);
        setShowConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        try {
            // 1. Stop the timer first
            onStop();

            // 2. Submit to Redmine with local notes
            await onSubmit(timer.id, localNotes);

            setShowConfirm(false);
        } catch (e) {
            console.error("Stop and Submit failed", e);
            showError("提交失敗，計時器已停止。");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle "Save" from WorkLogEditor - just save notes to Redmine without stopping
    const handleSaveNote = async (content: string) => {
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            // Save notes to Redmine issue journals (content is already Textile formatted)
            await api.post('/timer/log/save-to-issue', {
                issue_id: timer.issue_id,
                notes: content
            });

            // Clear notes input for next entry
            setLocalNotes('');
            onUpdateLog('');

            // Refresh issue details to show new note
            await fetchIssueDetails();
        } catch (e) {
            console.error("Failed to save note:", e);
            showError("儲存筆記失敗。");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle save with files - uploads array already contains tokens from WorkLogEditor
    const handleSaveNoteWithFiles = async (
        content: string,
        _files: PendingFile[],
        uploads: Array<{ filename: string; token: string; content_type: string }>
    ) => {
        if (!content.trim() && uploads.length === 0) return;

        setIsSubmitting(true);
        try {
            // Save notes with attachments to Redmine issue journals
            await api.post('/timer/log/save-to-issue', {
                issue_id: timer.issue_id,
                notes: content,  // Already Textile formatted
                uploads: uploads
            });

            // Clear notes input for next entry
            setLocalNotes('');
            onUpdateLog('');

            // Refresh issue details to show new note
            await fetchIssueDetails();
        } catch (e) {
            console.error("Failed to save note with files:", e);
            showError("儲存筆記失敗。");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open edit modal for a journal
    const handleEditJournal = (journal: typeof editingJournal) => {
        setEditingJournal(journal);
        setEditedNotes(journal?.notes || '');
    };

    return (
        <div className="flex flex-col flex-1 animate-in fade-in duration-500">
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
            <div className="flex items-center justify-center gap-8 mb-8">
                {/* Time Stats - Left */}
                <div className="text-center min-w-[120px]">
                    <p className="text-sm text-muted-foreground mb-1">已花費</p>
                    <span className="text-2xl font-mono font-semibold text-orange-500">
                        {issueDetails?.spent_hours != null ? `${issueDetails.spent_hours.toFixed(1)}h` : '--'}
                    </span>
                </div>

                {/* Timer - Center */}
                <div className="text-center">
                    <span className={`text-5xl font-mono font-bold ${timer.status === 'paused' ? 'text-yellow-500' : 'text-primary'}`}>
                        {formatDuration(elapsed)}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                        {timer.status === 'paused' ? 'Paused' : 'Running'}
                    </p>
                </div>

                {/* Time Stats - Right */}
                <div className="text-center min-w-[120px]">
                    <p className="text-sm text-muted-foreground mb-1">預估</p>
                    <span className="text-2xl font-mono font-semibold text-blue-500">
                        {issueDetails?.estimated_hours != null ? `${issueDetails.estimated_hours}h` : '--'}
                    </span>
                    {issueDetails?.estimated_hours && issueDetails?.spent_hours != null && (
                        <div className="mt-2">
                            <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${issueDetails.spent_hours > issueDetails.estimated_hours
                                        ? 'bg-red-500'
                                        : 'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.min((issueDetails.spent_hours / issueDetails.estimated_hours) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {Math.round((issueDetails.spent_hours / issueDetails.estimated_hours) * 100)}%
                            </p>
                        </div>
                    )}
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
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg disabled:opacity-50"
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
                            <span className="text-xs text-muted-foreground ml-2">
                                (儲存後清空，可繼續新增)
                            </span>
                        </h3>
                        <div className="flex-1 overflow-hidden">
                            <WorkLogEditor
                                initialContent={localNotes}
                                issueId={timer.issue_id}
                                onUpdate={handleNotesChange}
                                onSubmit={handleSaveNote}
                                onSubmitWithFiles={handleSaveNoteWithFiles}
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
                            <span className="text-xs font-normal">（點擊可查看/編輯）</span>
                        </h4>
                        {issueDetails?.journals && issueDetails.journals.length > 0 ? (
                            <div className="space-y-3">
                                {issueDetails.journals.map((journal) => (
                                    <div
                                        key={journal.id}
                                        onClick={() => handleEditJournal(journal)}
                                        className="p-3 bg-background rounded border-l-4 border-primary/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{journal.user}</span>
                                                <span>•</span>
                                                <span>{formatDateTime(journal.created_on)}</span>
                                            </div>
                                            <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground font-sans text-sm line-clamp-3">
                                            <ReactMarkdown
                                                components={{
                                                    img: ({ node: _node, ...props }) => (
                                                        <AuthenticatedImage
                                                            src={props.src}
                                                            alt={props.alt}
                                                            attachments={issueDetails?.attachments}
                                                        />
                                                    )
                                                }}
                                            >
                                                {journal.notes}
                                            </ReactMarkdown>
                                        </div>
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
                        {localNotes ? (
                            <pre className="whitespace-pre-wrap font-sans text-sm max-h-32 overflow-auto">
                                {localNotes}
                            </pre>
                        ) : (
                            <p className="text-muted-foreground italic text-sm">（無 Notes）</p>
                        )}
                    </div>
                </div>
            </ConfirmDialog>

            {/* Edit Journal Modal */}
            {editingJournal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setEditingJournal(null)}
                    />
                    <div className="relative bg-card border rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <h3 className="font-semibold text-lg">查看 Note</h3>
                                <p className="text-xs text-muted-foreground">
                                    {editingJournal.user} • {formatDateTime(editingJournal.created_on)}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingJournal(null)}
                                className="p-1 rounded hover:bg-muted transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content - Editable */}
                        <div className="flex-1 p-4 overflow-auto">
                            <textarea
                                value={editedNotes}
                                onChange={(e) => setEditedNotes(e.target.value)}
                                className="w-full h-full min-h-[200px] p-3 bg-muted/30 rounded border resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                                placeholder="Note content..."
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
                            <p className="text-xs text-muted-foreground">
                                提示：Redmine API 不支援修改已送出的 notes
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(editedNotes);
                                        showSuccess('已複製到剪貼簿');
                                    }}
                                    className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
                                >
                                    複製內容
                                </button>
                                <button
                                    onClick={() => setEditingJournal(null)}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

