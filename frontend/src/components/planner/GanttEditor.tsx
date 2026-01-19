import React, { useEffect, useRef, useState, useCallback } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { api } from '@/lib/api';
import { TaskDetailModal } from './TaskDetailModal';
import './GanttEditor.css';

interface GanttEditorProps {
    planningProjectId: number;
}

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
    assigned_to_name?: string;
    status_name?: string;
    redmine_updated_on?: string;
    is_from_redmine?: boolean;
    redmine_issue_id?: number | null;
}

export const GanttEditor: React.FC<GanttEditorProps> = ({ planningProjectId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
    const tasksDataRef = useRef<PlanningTask[]>([]);
    const eventIdsRef = useRef<string[]>([]);
    const dpRef = useRef<any>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [tasksRes, linksRes] = await Promise.all([
                api.get<PlanningTask[]>(`/planning/projects/${planningProjectId}/tasks`),
                api.get<any[]>(`/planning/projects/${planningProjectId}/links`)
            ]);

            // Store original task data for modal
            tasksDataRef.current = tasksRes;

            // Map Tasks
            const tasks = tasksRes.map(t => ({
                id: t.id,
                text: t.subject,
                start_date: t.start_date,
                duration: t.estimated_hours ? t.estimated_hours / 8 : 1,
                end_date: t.due_date ? t.due_date : null,
                progress: t.progress,
                parent: 0,
                open: true
            }));

            // Map Links
            const links = linksRes.map(l => ({
                id: l.id,
                source: l.source,
                target: l.target,
                type: l.type
            }));

            // Clear existing data before parsing new data
            gantt.clearAll();
            gantt.parse({ data: tasks, links: links });
        } catch (error) {
            console.error("Failed to load Gantt data", error);
        } finally {
            setIsLoading(false);
        }
    }, [planningProjectId]);

    useEffect(() => {
        if (!planningProjectId) return;

        // Clear all previous data and events first
        gantt.clearAll();
        eventIdsRef.current.forEach(id => gantt.detachEvent(id));
        eventIdsRef.current = [];
        if (dpRef.current) {
            dpRef.current.destructor();
            dpRef.current = null;
        }

        // Initialize Gantt
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.xml_date = "%Y-%m-%d";

        // Date display format (year-month-day order)
        gantt.config.scale_height = 50;
        gantt.config.scales = [
            { unit: "month", step: 1, format: "%Y年 %M" },
            { unit: "day", step: 1, format: "%d日" }
        ];

        gantt.config.columns = [
            { name: "text", label: "任務名稱", width: "*", tree: true },
            { name: "start_date", label: "開始日期", align: "center", width: 100, template: (task: any) => formatDisplayDate(task.start_date) },
            { name: "duration", label: "工期", align: "center", width: 60 },
            { name: "add", label: "", width: 44 }
        ];

        gantt.i18n.setLocale("cn");

        // Prevent DHTMLX from eating error alerts, etc.
        gantt.config.show_errors = false;

        // Keep default lightbox enabled for + button
        gantt.config.details_on_dblclick = true;
        gantt.config.details_on_create = true;

        // Handle double-click to open custom modal (but still allow default behavior for create)
        const dblClickId = gantt.attachEvent("onTaskDblClick", function (id: string) {
            const taskData = tasksDataRef.current.find(t => t.id === Number(id));
            if (taskData) {
                setEditingTask(taskData);
                return false; // Prevent default lightbox only when we have task data
            }
            return true; // Allow default for new tasks
        });
        eventIdsRef.current.push(dblClickId);

        // Handle task created via lightbox
        const afterTaskAddId = gantt.attachEvent("onAfterTaskAdd", function (id: any, task: any) {
            // Sync with backend
            handleTaskCreate(task).then((result) => {
                if (result && result.id) {
                    gantt.changeTaskId(id, result.id);
                }
            });
        });
        eventIdsRef.current.push(afterTaskAddId);

        gantt.init(containerRef.current!);

        // Data Processor for CRUD (but not for create since we handle it manually)
        dpRef.current = gantt.createDataProcessor({
            task: {
                create: () => Promise.resolve(), // Handled by onAfterTaskAdd
                update: (data: any, id: string) => handleTaskUpdate(id, data),
                delete: (id: string) => handleTaskDelete(id)
            },
            link: {
                create: (data: any) => handleLinkCreate(data),
                update: (data: any, id: string) => handleLinkUpdate(id, data),
                delete: (id: string) => handleLinkDelete(id)
            }
        });

        fetchData();

        return () => {
            // Cleanup: detach events and destroy data processor
            eventIdsRef.current.forEach(id => gantt.detachEvent(id));
            eventIdsRef.current = [];
            if (dpRef.current) {
                dpRef.current.destructor();
                dpRef.current = null;
            }
            gantt.clearAll();
        };
    }, [planningProjectId, fetchData]);

    // CRUD Handlers
    const handleTaskCreate = async (data: any): Promise<{ id: number } | false> => {
        try {
            const res = await api.post<{ id: number }>(`/planning/projects/${planningProjectId}/tasks`, {
                subject: data.text,
                start_date: formatDate(data.start_date),
                estimated_hours: data.duration * 8,
                parent_id: data.parent ? parseInt(data.parent) : null
            });
            return { id: res.id };
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleTaskUpdate = async (id: string, data: any) => {
        try {
            await api.put(`/planning/projects/${planningProjectId}/tasks/${id}`, {
                subject: data.text,
                start_date: formatDate(data.start_date),
                due_date: formatDate(data.end_date),
                estimated_hours: data.duration * 8,
                progress: data.progress,
                parent_id: data.parent ? parseInt(data.parent) : null
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleTaskDelete = async (id: string) => {
        try {
            await api.delete(`/planning/projects/${planningProjectId}/tasks/${id}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleLinkCreate = async (data: any) => {
        try {
            const res = await api.post<{ id: number }>(`/planning/projects/${planningProjectId}/links`, {
                source: data.source,
                target: data.target,
                type: data.type
            });
            return { id: res.id };
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleLinkUpdate = async (_id: string, _data: any) => {
        return true;
    };

    const handleLinkDelete = async (id: string) => {
        try {
            await api.delete(`/planning/projects/${planningProjectId}/links/${id}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const formatDate = (date: Date | string): string => {
        if (!date) return "";
        if (typeof date === 'string') return date;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDisplayDate = (dateStr: string | Date): string => {
        if (!dateStr) return "";
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        if (isNaN(date.getTime())) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    };

    const handleModalClose = () => {
        setEditingTask(null);
    };

    const handleModalUpdate = () => {
        // Refresh data after modal save
        fetchData();
        setEditingTask(null);
    };

    return (
        <div className="gantt-container">
            {isLoading && <div className="loading-overlay">Loading...</div>}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>

            {editingTask && (
                <TaskDetailModal
                    task={editingTask}
                    onClose={handleModalClose}
                    onUpdate={handleModalUpdate}
                />
            )}
        </div>
    );
};
