import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { WorkLogEditor } from '../timer/WorkLogEditor';
import { api } from '@/lib/api';
import './PlannerTaskCreateModal.css';

interface PlannerTaskCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    onTaskCreated: (task: any) => void;
    initialData?: {
        start_date?: string;
        parent_id?: number;
    };
}

export function PlannerTaskCreateModal({ isOpen, onClose, projectId, onTaskCreated, initialData }: PlannerTaskCreateModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [subject, setSubject] = useState('');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [startDate, setStartDate] = useState(initialData?.start_date || new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');

    const handleSubmit = async () => {
        if (!subject.trim()) {
            alert('請輸入任務名稱');
            return;
        }

        setSubmitting(true);
        try {
            const newTask = await api.post(`/planning/projects/${projectId}/tasks`, {
                subject,
                description,
                estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0,
                start_date: startDate,
                due_date: dueDate,
                parent_id: initialData?.parent_id || null
            });
            onTaskCreated(newTask);
            onClose();
        } catch (error) {
            console.error('Failed to create task:', error);
            alert('新增任務失敗');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-2xl rounded-lg shadow-xl flex flex-col border animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">新增任務</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[80vh]">
                    <div>
                        <label className="text-sm font-medium">任務名稱 <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-2 focus:ring-ring"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="輸入任務名稱..."
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">開始日期</label>
                            <input
                                type="date"
                                className="w-full mt-1 p-2 border rounded-md bg-background"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">結束日期</label>
                            <input
                                type="date"
                                className="w-full mt-1 p-2 border rounded-md bg-background"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">預估工時 (小時)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="w-full mt-1 p-2 border rounded-md bg-background"
                            value={estimatedHours}
                            onChange={e => setEstimatedHours(e.target.value)}
                            placeholder="e.g. 8"
                        />
                    </div>

                    <div className="border rounded-md bg-background">
                        <label className="text-sm font-medium px-3 pt-2 block">描述</label>
                        <div className="h-[200px]">
                            <WorkLogEditor
                                initialContent={description}
                                onUpdate={setDescription}
                                hideSaveButton={true}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t p-4 flex justify-end gap-2 bg-muted/20 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                        disabled={submitting}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors flex items-center gap-2"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        建立任務
                    </button>
                </div>
            </div>
        </div>
    );
}
