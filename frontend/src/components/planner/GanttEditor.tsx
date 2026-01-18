import React, { useEffect, useRef, useState } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { api } from '@/lib/api';
import './GanttEditor.css';

interface GanttEditorProps {
    planningProjectId: number;
}

export const GanttEditor: React.FC<GanttEditorProps> = ({ planningProjectId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!planningProjectId) return;

        // Initialize Gantt
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.xml_date = "%Y-%m-%d";
        gantt.config.columns = [
            { name: "text", label: "任務名稱", width: "*", tree: true },
            { name: "start_date", label: "開始日期", align: "center", width: 80 },
            { name: "duration", label: "工期", align: "center", width: 60 },
            { name: "add", label: "", width: 44 }
        ];

        gantt.i18n.setLocale("cn");

        // Prevent DHTMLX from eating error alerts, etc.
        gantt.config.show_errors = false;

        gantt.init(containerRef.current!);

        // Data Processor for CRUD
        const dp = gantt.createDataProcessor({
            task: {
                create: (data: any) => handleTaskCreate(data),
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
            if (dp) dp.destructor();
            gantt.clearAll();
        };
    }, [planningProjectId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [tasksRes, linksRes] = await Promise.all([
                api.get<any[]>(`/planning/projects/${planningProjectId}/tasks`),
                api.get<any[]>(`/planning/projects/${planningProjectId}/links`)
            ]);

            // Map Tasks
            const tasks = tasksRes.map(t => ({
                id: t.id,
                text: t.subject,
                start_date: t.start_date,
                duration: t.estimated_hours ? t.estimated_hours / 8 : 1,
                end_date: t.due_date ? t.due_date : null,
                progress: t.progress,
                parent: t.parent_id || 0,
                open: true
            }));

            // Map Links
            const links = linksRes.map(l => ({
                id: l.id,
                source: l.source,
                target: l.target,
                type: l.type
            }));

            gantt.parse({ data: tasks, links: links });
        } catch (error) {
            console.error("Failed to load Gantt data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // CRUD Handlers
    const handleTaskCreate = async (data: any) => {
        try {
            const res = await api.post<{ id: number }>(`/planning/projects/${planningProjectId}/tasks`, {
                subject: data.text,
                start_date: formatDate(data.start_date),
                estimated_hours: data.duration * 8, // Approx
                parent_id: data.parent ? parseInt(data.parent) : null
            });
            // Update local ID with server ID
            return { id: res.id, ...data };
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
        // Not implemented API for link update.
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

    const formatDate = (date: Date): string => {
        if (!date) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    return (
        <div className="gantt-container">
            {isLoading && <div className="loading-overlay">Loading...</div>}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
};
