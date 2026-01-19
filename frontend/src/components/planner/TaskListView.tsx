import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, Trash2, Wand2, RefreshCw, Download, Upload, X } from 'lucide-react';
import { TaskImportModal } from '@/components/tracking';
import { TaskDetailModal } from './TaskDetailModal';
import { PlannerTaskCreateModal } from './PlannerTaskCreateModal';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import './TaskListView.css';

interface PlanningTask {
    id: number;
    subject: string;
    description?: string;
    estimated_hours?: number;
    start_date?: string;
    due_date?: string;
    progress: number;
    sync_status: string;
    sort_order: number;

    // Meta fields
    assigned_to_name?: string;
    status_name?: string;
    redmine_updated_on?: string;

    // Sync status fields
    is_from_redmine?: boolean;
    redmine_issue_id?: number | null;
}

interface TaskListViewProps {
    projectId: number;
}

interface SortableTaskItemProps {
    task: PlanningTask;
    onDelete: (id: number) => void;
    onUpdate: (id: number, updates: Partial<PlanningTask>) => void;
    onEdit: (task: PlanningTask) => void;
}

// 可排序的任務項目元件 (Optimized)
export const SortableTaskItem = memo(({ task, onDelete, onUpdate, onEdit }: SortableTaskItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const [localTask, setLocalTask] = useState(task);

    useEffect(() => {
        setLocalTask(task);
    }, [task]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleChange = (field: keyof PlanningTask, value: any) => {
        setLocalTask(prev => ({ ...prev, [field]: value }));
    };

    const handleBlur = (field: keyof PlanningTask) => {
        if (localTask[field] !== task[field]) {
            onUpdate(task.id, { [field]: localTask[field] });
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="task-item">
            <div className="task-drag-handle" {...attributes} {...listeners}>
                <GripVertical size={16} />
            </div>


            <div className="flex-1 overflow-auto p-4">
                <input
                    className="task-subject-input"
                    value={localTask.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    onBlur={() => handleBlur('subject')}
                    placeholder="任務名稱"
                />
                <div className="task-meta">
                    <input
                        type="number"
                        placeholder="工時"
                        className="task-hours-input"
                        value={localTask.estimated_hours || ''}
                        onChange={(e) => handleChange('estimated_hours', parseFloat(e.target.value) || 0)}
                        onBlur={() => handleBlur('estimated_hours')}
                    />
                    <input
                        type="date"
                        className="task-date-input"
                        value={localTask.start_date || ''}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                        onBlur={() => handleBlur('start_date')}
                    />
                    <span className="separator">-</span>
                    <input
                        type="date"
                        className="task-date-input"
                        value={localTask.due_date || ''}
                        onChange={(e) => handleChange('due_date', e.target.value)}
                        onBlur={() => handleBlur('due_date')}
                    />
                    <span className={`sync-status ${task.sync_status}`}>
                        {task.sync_status}
                    </span>
                </div>
                {/* Meta Info Display */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 ml-1 pl-1">
                    {task.assigned_to_name && (
                        <span title="被指派者">👤 {task.assigned_to_name}</span>
                    )}
                    {task.status_name && (
                        <span title="狀態">🔵 {task.status_name}</span>
                    )}
                    {task.redmine_updated_on && (
                        <span title="Redmine 最後更新">🕒 {new Date(task.redmine_updated_on).toLocaleString()}</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {task.is_from_redmine && task.redmine_issue_id && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded mr-1">#{task.redmine_issue_id}</span>
                )}
                <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary" onClick={() => onEdit(task)} title="詳細內容 & 筆記">
                    <Wand2 size={16} />
                </button>
                <button className="delete-btn" onClick={() => onDelete(task.id)} title="刪除任務">
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.task === next.task;
});

interface TaskListViewProps {
    projectId: number;
    refreshTrigger?: number;
    onDataChange?: () => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({ projectId, refreshTrigger = 0, onDataChange }) => {
    const { showSuccess, showWarning, showError } = useToast();
    const [tasks, setTasks] = useState<PlanningTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);

    const [generating, setGenerating] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchTasks();
    }, [projectId, refreshTrigger]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await api.get<PlanningTask[]>(`/planning/projects/${projectId}/tasks`);
            setTasks(res);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTasks = async () => {
        if (!confirm('確定要根據 PRD 內容生成任務嗎？這將會新增任務到列表中。')) return;

        setGenerating(true);
        try {
            await api.post(`/planning/projects/${projectId}/generate-tasks`);
            fetchTasks();
            showSuccess('任務生成完成');
            onDataChange?.();
        } catch (error) {
            console.error('Task generation failed:', error);
            showError('產生任務失敗，請確認已連結 PRD 且內容不為空。');
        } finally {
            setGenerating(false);
        }
    };

    const [showCreateModal, setShowCreateModal] = useState(false);

    // ... (existing code)

    const handleAddTask = () => {
        setShowCreateModal(true);
    };

    const handleDeleteTask = useCallback(async (id: number) => {
        if (!confirm('確定刪除此任務？')) return;
        try {
            await api.delete(`/planning/projects/${projectId}/tasks/${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
            onDataChange?.();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }, [projectId, onDataChange]);

    const handleUpdateTask = useCallback(async (id: number, updates: Partial<PlanningTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        try {
            await api.put(`/planning/projects/${projectId}/tasks/${id}`, updates);
            onDataChange?.();
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }, [projectId, onDataChange]);


    // Use explicit type for tasks if possible, or any for now since SearchResult is not exported from ImportModal directly (unless I export it or replicate)
    // Actually TaskImportModal exports SearchResult? No.
    // I can define a minimal interface or use any.
    const handleImportConfirm = async (issueIds: number[], tasks: any[]) => {
        if (tasks.length === 0) return;

        // Ensure all are from same project to avoid confusion
        const redmineProjectId = tasks[0].project_id;
        const isMixed = tasks.some(t => t.project_id !== redmineProjectId);

        if (isMixed) {
            showWarning('為了保持專案一致性，請一次僅匯入來自同一個 Redmine 專案的任務。');
            return;
        }

        await api.post(`/planning/projects/${projectId}/import-redmine`, {
            redmine_project_id: redmineProjectId,
            issue_ids: issueIds
        });
        fetchTasks();
        onDataChange?.();
    };

    const handleSyncRedmine = async () => {
        if (!confirm('確定要同步到 Redmine 嗎？這將會更新本地變更到 Redmine，並建立新任務。')) return;
        setSyncing(true);
        try {
            const res = await api.post<{ message: string, synced: number, created: number }>(`/planning/projects/${projectId}/sync-redmine`);
            showSuccess(`同步完成！已更新: ${res.synced}，已建立: ${res.created}`);
            fetchTasks();
            onDataChange?.();
        } catch (error) {
            console.error('Sync failed:', error);
            showError('同步失敗，請檢查網路連線或 Redmine 設定。');
        } finally {
            setSyncing(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTasks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update sort_order for all items based on new index
                // We send this to backend
                const reorderData = newItems.map((item, index) => ({
                    id: item.id,
                    sort_order: index
                }));

                // Call backend asynchronously
                api.put(`/planning/projects/${projectId}/tasks/reorder`, reorderData)
                    .then(() => {
                        onDataChange?.();
                    })
                    .catch(err => {
                        console.error("Failed to persist order", err);
                        // showWarning("任務順序儲存失敗"); // Optional: notify user
                    });

                return newItems;
            });
        }
    };

    return (
        <div className="task-list-view">
            <div className="toolbar">
                <button
                    className="btn-generate"
                    onClick={handleGenerateTasks}
                    disabled={generating}
                >
                    {generating ? <RefreshCw className="spin" size={16} /> : <Wand2 size={16} />}
                    從 PRD 生成任務
                </button>
                <button className="btn-add" onClick={handleAddTask}>
                    <Plus size={16} />
                    新增任務
                </button>
                <div className="divider-vertical" style={{ width: 1, height: 24, background: '#e0e0e0', margin: '0 8px' }}></div>
                <button
                    className="btn-secondary"
                    title="從 Redmine 匯入"
                    onClick={() => setShowImportModal(true)}
                >
                    <Download size={16} />
                </button>
                <button
                    className="btn-secondary"
                    title="同步到 Redmine"
                    onClick={handleSyncRedmine}
                    disabled={syncing}

                >
                    {syncing ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />}
                </button>
            </div>

            {/* Error Message */}
            {
                error && (
                    <div className="bg-destructive/15 text-destructive px-4 py-2 text-sm flex justify-between items-center border-b">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="hover:bg-destructive/10 p-1 rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )
            }

            <div className="task-list-content">
                {loading ? (
                    <div className="loading">載入中...</div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tasks.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {tasks.map((task) => (
                                <SortableTaskItem
                                    key={task.id}
                                    task={task}
                                    onDelete={handleDeleteTask}
                                    onUpdate={handleUpdateTask}
                                    onEdit={setEditingTask}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {
                showImportModal && (
                    <TaskImportModal
                        isOpen={showImportModal}
                        onClose={() => setShowImportModal(false)}
                        onConfirm={handleImportConfirm}
                    />
                )
            }

            {
                showCreateModal && (
                    <PlannerTaskCreateModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        projectId={projectId}
                        onTaskCreated={(newTask) => {
                            setTasks(prev => [...prev, newTask]);
                            showSuccess('任務已建立');
                            onDataChange?.();
                        }}
                    />
                )
            }

            {
                editingTask && (
                    <TaskDetailModal
                        task={editingTask}
                        onClose={() => setEditingTask(null)}
                        onUpdate={() => {
                            fetchTasks();
                            setEditingTask(null);
                            onDataChange?.();
                        }}
                    />
                )
            }
        </div >
    );
};
