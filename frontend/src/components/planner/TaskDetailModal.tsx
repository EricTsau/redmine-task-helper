
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Calendar, User, Info } from 'lucide-react';
import { WorkLogEditor } from '../timer/WorkLogEditor';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/contexts/ToastContext';
import './TaskDetailModal.css';

interface PlanningTask {
    id: number;
    subject: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    progress: number;
    is_from_redmine?: boolean;
    redmine_issue_id?: number | null;
    sync_status: string;

    assigned_to_name?: string;
    status_name?: string;
    redmine_updated_on?: string;
}

interface Journal {
    id: number;
    notes: string;
    created_on: string;
    user: string;
}

interface IssueDetails {
    id: number;
    subject: string;
    description: string;
    journals: Journal[];
}

interface TaskDetailModalProps {
    task: PlanningTask;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh
}

export function TaskDetailModal({ task, onClose, onUpdate }: TaskDetailModalProps) {
    const { showSuccess, showWarning, showError } = useToast();
    const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
    const [description, setDescription] = useState(task.description || '');
    const [isLoading, setIsLoading] = useState(false);

    // Notes state
    const [notes, setNotes] = useState<any[]>([]); // TODO: Fetch from backend if we cache them, currently we only fetch issue journals via Redmine API directly or assume task sync brings them?
    // Actually, our current PlanningTask doesn't store journals.
    // If we want to show notes, we might need a separate endpoint to fetch them LIVE from Redmine, 
    // or rely on what we have. 
    // User request: "已經跟Redmine同步的task 可以多添加notes功能"
    // So we need to ADD notes. Viewing them is good too.
    // Let's implement fetching live details from Redmine if linked using existing /projects/{project_id}/issues/{issue_id} ? No we don't have that proxy.
    // We have `get_issue_with_journals` in redmine_client. 
    // We should probably add an endpoint GET /planning/tasks/{id}/details which fetches live info if synced.

    const [newNote, setNewNote] = useState('');
    const [liveDetails, setLiveDetails] = useState<IssueDetails | null>(null);

    // Title editing
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.subject);

    useEffect(() => {
        setEditedTitle(task.subject);
    }, [task.subject]);

    const handleSaveTitle = async () => {
        if (editedTitle === task.subject) {
            setIsEditingTitle(false);
            return;
        }
        try {
            await api.patch(`/planning/tasks/${task.id}`, { subject: editedTitle });
            onUpdate();
            showSuccess('標題已更新');
            setIsEditingTitle(false);
        } catch (e) {
            console.error(e);
            showError('更新標題失敗');
        }
    };

    useEffect(() => {
        if (task.is_from_redmine && task.redmine_issue_id && activeTab === 'notes') {
            fetchLiveDetails();
        }
    }, [task, activeTab]);

    useEffect(() => {
        setDescription(task.description || '');
    }, [task.description]);

    const fetchLiveDetails = async () => {
        try {
            const res = await api.get<IssueDetails>(`/planning/tasks/${task.id}/redmine-details`);
            setLiveDetails(res);
        } catch (e) {
            console.error('Failed to fetch details', e);
        }
    };

    const handleSaveDescription = async () => {
        setIsLoading(true);
        try {
            await api.patch(`/planning/tasks/${task.id}`, { description });
            onUpdate();
            showSuccess('儲存成功！' + (task.is_from_redmine ? ' (已同步至 Redmine)' : ''));
            onClose();
        } catch (e) {
            console.error(e);
            showError('儲存失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendNote = async () => {
        if (!newNote.trim()) return;
        try {
            await api.post(`/planning/tasks/${task.id}/note`, { notes: newNote });
            showSuccess('筆記已發送');
            setNewNote('');
            // TODO: Refresh journals
        } catch (e) {
            console.error(e);
            showError('發送筆記失敗');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-4xl h-[85vh] rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {isEditingTitle ? (
                                <input
                                    className="text-xl font-semibold border rounded px-1"
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onBlur={handleSaveTitle}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveTitle();
                                        if (e.key === 'Escape') {
                                            setEditedTitle(task.subject);
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <h2
                                    className="text-xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-1"
                                    onClick={() => setIsEditingTitle(true)}
                                    title="點擊修改標題"
                                >
                                    {task.subject}
                                </h2>
                            )}
                            {task.is_from_redmine && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    #{task.redmine_issue_id}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {task.assigned_to_name && (
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" /> {task.assigned_to_name}
                                </span>
                            )}
                            {task.status_name && (
                                <span className="flex items-center gap-1">
                                    <Info className="h-3 w-3" /> {task.status_name}
                                </span>
                            )}
                            {task.redmine_updated_on && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> 更新於 {new Date(task.redmine_updated_on).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4">
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setActiveTab('details')}
                    >
                        詳細內容
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notes'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setActiveTab('notes')}
                    >
                        筆記與對話
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0">
                    {activeTab === 'details' ? (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 p-4">
                                <WorkLogEditor
                                    initialContent={description}
                                    onUpdate={setDescription}
                                    hideSaveButton={true}
                                />
                            </div>
                            <div className="p-4 border-t flex justify-end">
                                <button
                                    onClick={handleSaveDescription}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isLoading ? '儲存中...' : '儲存描述'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* History List */}
                            <div className="flex-1 overflow-auto p-4 space-y-4">
                                {liveDetails?.journals?.map((journal: any) => (
                                    <div key={journal.id} className="bg-muted/30 p-3 rounded-lg text-sm">
                                        <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                            <span className="font-semibold">{journal.user}</span>
                                            <span>{new Date(journal.created_on).toLocaleString()}</span>
                                        </div>
                                        <div className="prose prose-sm max-w-none">
                                            <ReactMarkdown
                                                components={{
                                                    img: ({ node, ...props }) => {
                                                        // Simple image handler for now, ideally reused AuthenticatedImage
                                                        return <img {...props} className="max-w-full h-auto rounded border" style={{ maxHeight: '200px' }} />;
                                                    }
                                                }}
                                            >
                                                {journal.notes}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ))}
                                {!liveDetails?.journals?.length && (
                                    <div className="text-center text-muted-foreground py-8">
                                        尚無歷史留言
                                    </div>
                                )}
                            </div>

                            {/* Add Note Area */}
                            <div className="p-4 border-t bg-muted/30">
                                <h4 className="text-sm font-medium mb-2">新增筆記 (同步至 Redmine)</h4>
                                <WorkLogEditor
                                    initialContent={newNote}
                                    onUpdate={setNewNote}
                                    submitLabel="發送"
                                    onSubmit={async (content) => {
                                        setNewNote(content);
                                        await handleSendNote();
                                    }}
                                    onSubmitWithFiles={async (content, files, _uploads) => {
                                        if (files.length > 0) {
                                            showWarning("目前筆記功能暫不支援附件上傳，僅傳送文字內容。");
                                        }
                                        setNewNote(content);
                                        await handleSendNote();
                                    }}
                                // Make it smaller for the footer
                                // minHeight="120px" 
                                />
                                {!task.is_from_redmine && (
                                    <p className="text-xs text-orange-500 mt-2">
                                        需先同步至 Redmine 才能使用筆記功能
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
