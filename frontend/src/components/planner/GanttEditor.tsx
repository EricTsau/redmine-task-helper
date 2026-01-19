import React, { useEffect, useRef, useState, useCallback } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { api } from '@/lib/api';
import { TaskDetailModal } from './TaskDetailModal';
import { PlannerTaskCreateModal } from './PlannerTaskCreateModal';
import './GanttEditor.css';

interface GanttEditorProps {
    planningProjectId: number;
    refreshTrigger?: number;
    onDataChange?: () => void;
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

export const GanttEditor: React.FC<GanttEditorProps> = ({ planningProjectId, refreshTrigger = 0, onDataChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
    const tasksDataRef = useRef<PlanningTask[]>([]);
    const holidaysRef = useRef<Set<string>>(new Set());
    const holidaySettingsRef = useRef<{ exclude_saturday: boolean; exclude_sunday: boolean } | null>(null);
    const eventIdsRef = useRef<string[]>([]);
    const dpRef = useRef<any>(null);

    const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [tasksRes, linksRes, holidaysRes, settingsRes] = await Promise.all([
                api.get<PlanningTask[]>(`/planning/projects/${planningProjectId}/tasks`),
                api.get<any[]>(`/planning/projects/${planningProjectId}/links`),
                api.get<any[]>('/holidays/public'),
                api.get<any>('/holidays/settings/public')
            ]);

            // Process holidays
            const holidaySet = new Set<string>();
            holidaysRes.forEach(h => holidaySet.add(h.date)); // h.date is YYYY-MM-DD

            // Store original task data via ref
            tasksDataRef.current = tasksRes;
            holidaysRef.current = holidaySet;
            holidaySettingsRef.current = settingsRes;

            // Map Tasks
            const tasks = tasksRes.map(t => ({
                id: t.id,
                text: t.subject,
                start_date: t.start_date,
                duration: t.estimated_hours ? t.estimated_hours / 8 : 1,
                end_date: t.due_date ? t.due_date : null,
                progress: t.progress,
                parent: 0, // Simplified for now, real hierarchy needs processing logic if parent_id exists
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
            // Check if script already exists to avoid duplicates
            if (!document.querySelector('script[src="https://export.dhtmlx.com/gantt/api.js"]')) {
                const script = document.createElement('script');
                script.src = "https://export.dhtmlx.com/gantt/api.js";
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }, [planningProjectId, refreshTrigger]);

    // State for create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createModalParentId, setCreateModalParentId] = useState<number | undefined>(undefined);
    const [createModalStartDate, setCreateModalStartDate] = useState<string | undefined>(undefined);

    // Effect for Zoom
    useEffect(() => {
        switch (zoom) {
            case 'day':
                // Show Year/Month/Day in scale
                gantt.config.scales = [
                    { unit: "month", step: 1, date: "%Y年%m月" },
                    { unit: "day", step: 1, date: "%M %d(%D)" }
                ];
                gantt.config.min_column_width = 80;
                break;
            case 'week':
                gantt.config.scales = [
                    { unit: "month", step: 1, format: "%Y年%m月" },
                    { unit: "week", step: 1, format: (date: Date) => "W" + gantt.date.date_to_str("%W")(date) },
                    { unit: "day", step: 1, date: "%d" }
                ];
                gantt.config.min_column_width = 50;
                break;
            case 'month':
                gantt.config.scales = [
                    { unit: "year", step: 1, format: "%Y年" },
                    { unit: "month", step: 1, format: "%M" }
                ];
                gantt.config.min_column_width = 100;
                break;
        }
        gantt.render();
    }, [zoom]);

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

        // Initial scales based on zoom (will be overridden by effect but good to have default)
        gantt.config.scales = [
            { unit: "month", step: 1, date: "%Y年%m月" },
            { unit: "day", step: 1, date: "%M %d(%D)" }
        ];

        // Holiday styling
        // Holiday styling
        gantt.templates.timeline_cell_class = function (_item, date) {
            const state = gantt.getState();
            // Typically only show holidays in day-based views
            if (state.scale_unit === "month" || state.scale_unit === "year") return "";

            const dateStr = formatDate(date);

            // Check specific holidays
            if (holidaysRef.current.has(dateStr)) {
                return "holiday-cell";
            }

            // Check weekends config
            const day = date.getDay();
            const settings = holidaySettingsRef.current;
            if (settings) {
                if (settings.exclude_sunday && day === 0) return "holiday-cell";
                if (settings.exclude_saturday && day === 6) return "holiday-cell";
            }

            return "";
        };

        gantt.config.columns = [
            { name: "text", label: "任務名稱", width: "*", tree: true },
            { name: "start_date", label: "開始日期", align: "center", width: 100, template: (task: any) => formatDisplayDate(task.start_date) },
            { name: "duration", label: "工期", align: "center", width: 60 },
            { name: "add", label: "", width: 44 }
        ];

        gantt.i18n.setLocale("cn");

        // Prevent DHTMLX from eating error alerts, etc.
        gantt.config.show_errors = false;

        // Disable default details on create to use custom modal
        gantt.config.details_on_create = false;

        // Custom task creation handling
        const beforeTaskAddId = gantt.attachEvent("onBeforeTaskAdd", function (_id: string | number, task: any) {
            // Cancel default add and show our modal
            setCreateModalParentId(task.parent ? Number(task.parent) : undefined);
            setCreateModalStartDate(formatDate(task.start_date));
            setShowCreateModal(true);
            return false;
        });
        eventIdsRef.current.push(beforeTaskAddId);



        // Handle double-click to open custom modal (but still allow default behavior for create)
        const dblClickId = gantt.attachEvent("onTaskDblClick", function (id: string) {
            const taskData = tasksDataRef.current.find(t => t.id === Number(id));
            if (taskData) {
                setEditingTask(taskData);
                return false; // Prevent default lightbox only when we have task data
            }
            return true; // Use default for otherwise
        });
        eventIdsRef.current.push(dblClickId);

        gantt.init(containerRef.current!);

        // Data Processor for CRUD (create is handled manually now)
        dpRef.current = gantt.createDataProcessor({
            task: {
                create: () => Promise.resolve(), // Handled manually
                update: (data: any, id: string) => handleTaskUpdate(id, data).then(res => { if (res) onDataChange?.(); return res; }),
                delete: (id: string) => handleTaskDelete(id).then(res => { if (res) onDataChange?.(); return res; })
            },
            link: {
                create: (data: any) => handleLinkCreate(data).then(res => { if (res) onDataChange?.(); return res; }),
                update: (data: any, id: string) => handleLinkUpdate(id, data).then(res => { if (res) onDataChange?.(); return res; }),
                delete: (id: string) => handleLinkDelete(id).then(res => { if (res) onDataChange?.(); return res; })
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

    // ... (CRUD handlers same as before)
    // CRUD Handlers
    /* handleTaskCreate is no longer used here as creation is handled by PlannerTaskCreateModal */
    /*
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
    */

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

    const handleExport = () => {
        // DHTMLX Gantt export service (free tier has watermark, but often used)
        // Or simple print
        // Let's try to use the export API if available in the version
        if (gantt.exportToPNG) {
            gantt.exportToPNG({
                // header: "<h1>專案時程表</h1>",
                // footer: "Generated by Redmine AI Copilot",
                locale: "cn",
                name: "gantt.png",
                full_tasks: true, // 確保所有任務都包含在內,
                raw: true
            });
        } else {
            // Fallback: window print or alert
            alert("Export plugin not enabled. Using browser print.");
            window.print();
        }
    };

    return (
        <div className="gantt-container flex flex-col h-full">
            <div className="gantt-toolbar bg-white border-b px-4 py-2 flex items-center justify-between shrink-0 h-14">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium mr-2">顯示模式:</span>
                    <button
                        onClick={() => setZoom('day')}
                        className={`px-3 py-1 text-sm rounded border ${zoom === 'day' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                        日
                    </button>
                    <button
                        onClick={() => setZoom('week')}
                        className={`px-3 py-1 text-sm rounded border ${zoom === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                        週
                    </button>
                    <button
                        onClick={() => setZoom('month')}
                        className={`px-3 py-1 text-sm rounded border ${zoom === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                        月
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="px-3 py-1 text-sm rounded border flex items-center gap-2 hover:bg-muted"
                        title="匯出圖片 (投影片大小)"
                    >
                        {/* Assuming we have an icon or just text */}
                        <span>匯出圖片</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                {isLoading && <div className="loading-overlay">Loading...</div>}
                <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>
            </div>

            {
                showCreateModal && (
                    <PlannerTaskCreateModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        projectId={planningProjectId}
                        onTaskCreated={() => {
                            fetchData();
                            onDataChange?.();
                        }}
                        initialData={{
                            parent_id: createModalParentId,
                            start_date: createModalStartDate
                        }}
                    />
                )
            }

            {editingTask && (
                <TaskDetailModal
                    task={editingTask}
                    onClose={handleModalClose}
                    onUpdate={() => {
                        handleModalUpdate();
                        onDataChange?.();
                    }}
                />
            )}
        </div>
    );
};
