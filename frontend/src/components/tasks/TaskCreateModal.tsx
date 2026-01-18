import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import { WorkLogEditor } from '../timer/WorkLogEditor';

interface TaskCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
    onTaskCreated: () => void;
}

interface ProjectMetadata {
    trackers: { id: number; name: string }[];
    statuses: { id: number; name: string }[];
    priorities: { id: number; name: string }[];
    members: { id: number; name: string }[];
    current_user?: { id: number; name: string };
    sub_projects?: { id: number; name: string }[];
}

export function TaskCreateModal({ isOpen, onClose, projectId, projectName, onTaskCreated }: TaskCreateModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [trackerId, setTrackerId] = useState<number | null>(null);
    const [statusId, setStatusId] = useState<number | null>(null);
    const [priorityId, setPriorityId] = useState<number | null>(null);
    const [assignedToId, setAssignedToId] = useState<number | null>(null);
    const [estimatedHours, setEstimatedHours] = useState<string>('');
    const [trackImmediately, setTrackImmediately] = useState(true);

    const [selectedProjectId, setSelectedProjectId] = useState(projectId);
    const [rootSubProjects, setRootSubProjects] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        if (isOpen && projectId) {
            setSelectedProjectId(projectId);
            setRootSubProjects([]);
        }
    }, [isOpen, projectId]);

    useEffect(() => {
        if (isOpen && selectedProjectId) {
            fetchMetadata(selectedProjectId);
        }
    }, [isOpen, selectedProjectId]);

    const fetchMetadata = async (pid: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<ProjectMetadata>(`/projects/${pid}/metadata`);
            setMetadata(res);

            // Capture sub-projects from the root project
            if (pid === projectId && res.sub_projects) {
                setRootSubProjects(res.sub_projects);
            }

            // Set defaults
            if (res.trackers.length > 0) setTrackerId(res.trackers[0].id);
            if (res.statuses.length > 0) setStatusId(res.statuses[0].id);
            if (res.priorities.find(p => p.name === 'Normal')) {
                setPriorityId(res.priorities.find(p => p.name === 'Normal')!.id);
            } else if (res.priorities.length > 0) {
                setPriorityId(res.priorities[0].id);
            }
        } catch (e: any) {
            console.error("Failed to fetch metadata", e);
            setError("Failed to load project data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!subject || !trackerId || !statusId) {
            setError("Please fill in all required fields (Subject, Tracker, Status).");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // 1. Create Task in Redmine
            const taskRes = await api.post<{ id: number }>('/tasks', {
                project_id: selectedProjectId,
                subject,
                description,
                tracker_id: trackerId,
                status_id: statusId,
                priority_id: priorityId,
                assigned_to_id: assignedToId,
                estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null
            });

            // 2. Track it locally if requested
            if (trackImmediately) {
                try {
                    await api.post('/tracked-tasks/import', {
                        issue_ids: [taskRes.id]
                    });
                } catch (trackError) {
                    console.error("Failed to auto-track task", trackError);
                    // Don't fail the whole operation if tracking fails, but maybe warn
                }
            }

            onTaskCreated();
            onClose();

            // Reset form
            setSubject('');
            setDescription('');
            setEstimatedHours('');
        } catch (e: any) {
            console.error("Creation failed", e);
            setError(e.message || "Failed to create task.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl flex flex-col border animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">New Task</h2>
                        <p className="text-xs text-muted-foreground">
                            in {selectedProjectId === projectId ? projectName : rootSubProjects.find(p => p.id === selectedProjectId)?.name || projectName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Standard Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rootSubProjects.length > 0 && (
                                    <div className="col-span-full">
                                        <label className="text-sm font-medium">Project</label>
                                        <select
                                            className="w-full mt-1 p-2 border rounded-md bg-background"
                                            value={selectedProjectId}
                                            onChange={e => setSelectedProjectId(Number(e.target.value))}
                                        >
                                            <option value={projectId}>{projectName} (Main)</option>
                                            {rootSubProjects.map(p => (
                                                <option key={p.id} value={p.id}>↳ {p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-full">
                                    <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-2 focus:ring-ring"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Task subject..."
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Tracker <span className="text-destructive">*</span></label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md bg-background"
                                        value={trackerId || ''}
                                        onChange={e => setTrackerId(Number(e.target.value))}
                                    >
                                        {metadata?.trackers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Status <span className="text-destructive">*</span></label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md bg-background"
                                        value={statusId || ''}
                                        onChange={e => setStatusId(Number(e.target.value))}
                                    >
                                        {metadata?.statuses.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Priority</label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md bg-background"
                                        value={priorityId || ''}
                                        onChange={e => setPriorityId(Number(e.target.value))}
                                    >
                                        {metadata?.priorities.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-8">
                                    <label className="text-sm font-medium">Assignee</label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md bg-background"
                                        value={assignedToId ?? ''}
                                        onChange={e => setAssignedToId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">(Unassigned)</option>
                                        {metadata?.current_user && (
                                            <option value={metadata.current_user.id}>
                                                (Me) {metadata.current_user.name}
                                            </option>
                                        )}
                                        {metadata?.members.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Estimated Hours</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        className="w-full mt-1 p-2 border rounded-md bg-background"
                                        value={estimatedHours}
                                        onChange={e => setEstimatedHours(e.target.value)}
                                        placeholder="e.g. 2.0"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-8">
                                    <input
                                        type="checkbox"
                                        id="trackImmediately"
                                        checked={trackImmediately}
                                        onChange={e => setTrackImmediately(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <label htmlFor="trackImmediately" className="text-sm font-medium cursor-pointer">
                                        Add to Tracking List
                                    </label>
                                </div>
                            </div>

                            {/* Description Editor */}
                            <div className="space-y-2 h-[400px]">
                                <label className="text-sm font-medium">Description</label>
                                <div className="h-full border rounded-md bg-background">
                                    <WorkLogEditor
                                        initialContent={description}
                                        onUpdate={setDescription}
                                        hideSaveButton={true}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t p-4 flex justify-end gap-2 bg-muted/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || loading}
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors flex items-center gap-2"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Create Task
                    </button>
                </div>
            </div>
        </div>
    );
}
