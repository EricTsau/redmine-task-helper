import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { X, Calendar, User, Info, MessageSquare, ChevronDown, ChevronUp, GripVertical, FileText } from 'lucide-react';
import { WorkLogEditor, type WorkLogEditorHandle } from '../timer/WorkLogEditor';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import '../planner/TaskDetailModal.css';

interface RedmineTaskDetailModalProps {
    taskId: number;
    subject: string;
    onClose: () => void;
    onUpdate?: () => void;
}

interface Journal {
    id: number;
    notes: string;
    created_on: string;
    user: { id: number; name: string };
}

interface IssueDetails {
    id: number;
    subject: string;
    description: string;
    start_date: string;
    due_date: string | null;
    done_ratio: number;
    status: { id: number; name: string };
    priority: { id: number; name: string };
    author: { id: number; name: string };
    assigned_to?: { id: number; name: string };
    created_on: string;
    updated_on: string;
    journals: Journal[];
}

export function RedmineTaskDetailModal({ taskId, subject, onClose, onUpdate }: RedmineTaskDetailModalProps) {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
    const [isLoading, setIsLoading] = useState(false);
    const [details, setDetails] = useState<IssueDetails | null>(null);
    const [description, setDescription] = useState('');
    const [newNote, setNewNote] = useState('');
    const [expandedJournals, setExpandedJournals] = useState<Set<number>>(new Set());
    const [editorHeight, setEditorHeight] = useState(200); // Default height in px

    const editorRef = useRef<WorkLogEditorHandle>(null);

    const handlePreviewNote = (note: string) => {
        if (editorRef.current) {
            editorRef.current.setContent(note);
            editorRef.current.setMode('preview');
            // Allow user to see "Edit" button if they want to copy/edit from it
        }
    };

    const toggleJournalExpand = (id: number) => {
        setExpandedJournals(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => {
        fetchDetails();
    }, [taskId]);

    const fetchDetails = async () => {
        setIsLoading(true);
        try {
            // Try fetching from a proxy endpoint if available, or assume standard Redmine API structure via a backend proxy
            // Since we don't have a direct "proxy" confirmed, but we have `api` wrapper.
            // If the backend exposes raw Redmine proxy at /redmine/issues/{id}? No.
            // But `useTasks` calls `/tasks`.
            // Let's assume we can add a specific endpoint to our backend or use one if matches.
            // The safest bet is: existing backend has `routers/tasks.py`?
            // User said "Directly edit task content".
            // I'll assume standard GET /tasks/{id} returns details including journals.
            // If not, I'll need to use what's available.
            // Since I added `parent` to `useTasks`, I assume `/tasks` returns it.
            // NOW, for details + journals, Redmine API `GET /issues/[id].json?include=journals`
            // NOTE: The backend `/tasks` endpoint likely wraps this.
            // I will try `GET /tasks/${taskId}`.
            const res = await api.get<IssueDetails>(`/tasks/${taskId}?include=journals`);
            setDetails(res);
            setDescription(res.description || '');
        } catch (e) {
            console.error(e);
            showError('無法載入任務詳情');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDescription = async () => {
        setIsLoading(true);
        try {
            await api.put(`/tasks/${taskId}`, { description });
            showSuccess('描述已更新');
            if (onUpdate) onUpdate();
            // Refresh details
            fetchDetails();
        } catch (e) {
            console.error(e);
            showError('更新描述失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendNote = async () => {
        if (!newNote.trim()) return;
        setIsLoading(true);
        try {
            await api.post(`/tasks/${taskId}/notes`, { notes: newNote });
            showSuccess('筆記已發送');
            setNewNote('');
            if (onUpdate) onUpdate();
            fetchDetails();
        } catch (e) {
            console.error(e);
            showError('發送筆記失敗');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !details) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-background rounded-lg p-8 flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    <p>載入中...</p>
                </div>
            </div>
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-background w-full max-w-4xl h-[85vh] rounded-lg shadow-xl flex flex-col overflow-hidden z-10 relative">
                {/* Header */}
                <div className="p-4 border-b flex items-start justify-between bg-muted/10">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                                #{taskId}
                            </span>
                            <h2 className="text-xl font-semibold truncate" title={details?.subject || subject}>
                                {details?.subject || subject}
                            </h2>
                            {user?.redmine_url && (
                                <a
                                    href={`${user.redmine_url.replace(/\/$/, '')}/issues/${taskId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary"
                                    title="在 Redmine 開啟"
                                >
                                    <Info size={16} />
                                </a>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {details?.assigned_to && (
                                <span className="flex items-center gap-1">
                                    <User size={12} /> {details.assigned_to.name}
                                </span>
                            )}
                            {details?.status && (
                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" /> {details.status.name}
                                </span>
                            )}
                            {details?.updated_on && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={12} /> {new Date(details.updated_on).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4 bg-background sticky top-0">
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'details'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setActiveTab('details')}
                    >
                        <Info size={14} />
                        詳細內容
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'notes'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setActiveTab('notes')}
                    >
                        <MessageSquare size={14} />
                        筆記與對話
                        {details?.journals?.length ? <span className="bg-muted text-xs px-1.5 rounded-full">{details.journals.length}</span> : null}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-muted/5">
                    {activeTab === 'details' ? (
                        <div className="h-full flex flex-col p-4 max-w-4xl mx-auto w-full">
                            <div className="bg-card rounded-lg border shadow-sm flex-1 flex flex-col overflow-hidden">
                                <WorkLogEditor
                                    initialContent={description}
                                    onUpdate={setDescription}
                                    hideSaveButton={true}
                                    className="flex-1 min-h-0" // Use flex-1 to fill space, min-h-0 to allow shrinking
                                />
                                <div className="p-3 border-t bg-muted/10 flex justify-end flex-none">
                                    <button
                                        onClick={handleSaveDescription}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                        {isLoading ? '儲存中...' : '儲存描述'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
                            {/* History List */}
                            <div className="flex-1 overflow-auto p-4 space-y-3">
                                {details?.journals?.map((journal) => {
                                    const isExpanded = expandedJournals.has(journal.id);
                                    const notes = journal.notes || '';
                                    const shouldTruncate = notes.length > 150;
                                    const displayNotes = shouldTruncate && !isExpanded
                                        ? notes.substring(0, 150) + '...'
                                        : notes;

                                    return (
                                        <div
                                            key={journal.id}
                                            className="bg-card rounded-lg border shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
                                            onClick={() => shouldTruncate && toggleJournalExpand(journal.id)}
                                        >
                                            <div className="flex justify-between items-center text-xs text-muted-foreground p-3 border-b">
                                                <span className="font-bold text-foreground flex items-center gap-2">
                                                    <User size={12} />
                                                    {journal.user.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span>{new Date(journal.created_on).toLocaleString()}</span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            className="p-1 hover:bg-muted rounded"
                                                            title="在下方預覽"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePreviewNote(notes);
                                                            }}
                                                        >
                                                            <FileText size={14} />
                                                        </button>
                                                        {shouldTruncate && (
                                                            <button
                                                                className="p-1 hover:bg-muted rounded"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleJournalExpand(journal.id);
                                                                }}
                                                            >
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`p-3 ${isExpanded ? 'max-h-[400px] overflow-auto' : ''}`}>
                                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                                    <ReactMarkdown>
                                                        {displayNotes || '(無內容)'}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {!details?.journals?.length && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                        <MessageSquare size={32} className="opacity-20" />
                                        <p>尚無歷史留言</p>
                                    </div>
                                )}
                            </div>

                            {/* Add Note Area - Resizable */}
                            <div className="border-t bg-background shadow-lg z-10 flex flex-col">
                                {/* Resize Handle */}
                                <div
                                    className="h-2 cursor-ns-resize bg-muted/30 hover:bg-primary/20 transition-colors flex items-center justify-center"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const startY = e.clientY;
                                        const startHeight = editorHeight;

                                        const onMouseMove = (moveEvent: MouseEvent) => {
                                            const delta = startY - moveEvent.clientY;
                                            setEditorHeight(Math.max(100, Math.min(500, startHeight + delta)));
                                        };

                                        const onMouseUp = () => {
                                            document.removeEventListener('mousemove', onMouseMove);
                                            document.removeEventListener('mouseup', onMouseUp);
                                        };

                                        document.addEventListener('mousemove', onMouseMove);
                                        document.addEventListener('mouseup', onMouseUp);
                                    }}
                                >
                                    <GripVertical size={14} className="text-muted-foreground rotate-90" />
                                </div>

                                <div className="p-4">
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <MessageSquare size={14} className="text-primary" />
                                        新增筆記 (同步至 Redmine)
                                    </h4>
                                    <div style={{ height: `${editorHeight}px` }}>
                                        <WorkLogEditor
                                            ref={editorRef}
                                            initialContent={newNote}
                                            onUpdate={setNewNote}
                                            submitLabel="發送"
                                            onSubmit={async (content) => {
                                                setNewNote(content);
                                                await handleSendNote();
                                            }}
                                            placeholder="輸入筆記..."
                                            className="h-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >,
        document.body
    );
}
