import React, { useEffect, useRef, useState } from 'react';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { gantt } from 'dhtmlx-gantt';
import { GanttToolbar } from './GanttToolbar';

interface GanttTask {
    id: number | string;
    text: string;
    start_date: string;
    duration?: number;
    parent?: number | string;
    progress?: number;
    open?: boolean;
    type?: string;
    [key: string]: any;
}

interface GanttLink {
    id: number | string;
    source: number | string;
    target: number | string;
    type: string;
}

interface GanttData {
    data: GanttTask[];
    links: GanttLink[];
}

interface GanttChartProps {
    tasks: GanttData;
    onTaskUpdate?: (id: string | number, task: any) => void;
    onLinkUpdate?: (id: string | number, link: any) => void;
    onTaskAdd?: (task: any) => Promise<string | number | void>;
    onTaskDelete?: (id: string | number) => void;
    isLoading?: boolean;
    zoomLevel?: 'day' | 'week' | 'month';
    holidays?: any[];
}

export const GanttChart: React.FC<GanttChartProps> = ({
    tasks,
    onTaskUpdate,
    onLinkUpdate,
    onTaskAdd,
    onTaskDelete,
    isLoading = false,
    holidays = []
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');

    // Keep latest handlers in refs to avoid re-binding events or stale closures
    const handlersRef = useRef({
        onTaskUpdate,
        onLinkUpdate,
        onTaskAdd,
        onTaskDelete
    });

    useEffect(() => {
        handlersRef.current = {
            onTaskUpdate,
            onLinkUpdate,
            onTaskAdd,
            onTaskDelete
        };
    }, [onTaskUpdate, onLinkUpdate, onTaskAdd, onTaskDelete]);

    useEffect(() => {
        if (!containerRef.current) return;

        // 初始化設定
        gantt.config.date_format = "%Y-%m-%d %H:%i";
        gantt.config.smart_rendering = true;
        gantt.config.fit_tasks = true;
        gantt.config.work_time = true; // 啟用工作時間計算

        // 欄位設定
        gantt.config.columns = [
            { name: "text", label: "任務名稱", tree: true, width: 250 },
            { name: "start_date", label: "開始時間", align: "center", width: 100 },
            { name: "duration", label: "工期", align: "center", width: 70 },
            { name: "add", label: "", width: 44 }
        ];

        // 假日背景樣式
        gantt.templates.timeline_cell_class = (_item: any, date: Date) => {
            if (!gantt.isWorkTime(date)) return "holiday-cell";
            return "";
        };

        // 初始化
        gantt.init(containerRef.current);

        // 事件監聽
        const events = [
            gantt.attachEvent("onAfterTaskUpdate", (id, item) => {
                const handler = handlersRef.current.onTaskUpdate;
                if (handler) handler(id, item);
            }),
            gantt.attachEvent("onAfterLinkAdd", (id, item) => {
                const handler = handlersRef.current.onLinkUpdate;
                if (handler) handler(id, item);
            }),
            gantt.attachEvent("onAfterLinkDelete", (_id, _item) => {
                console.log("Link deleted");
            }),
            gantt.attachEvent("onAfterTaskAdd", async (id, item) => {
                const handler = handlersRef.current.onTaskAdd;
                if (handler) {
                    try {
                        const newId = await handler(item);
                        if (newId) {
                            gantt.changeTaskId(id, newId);
                        }
                    } catch (e) {
                        console.error("Failed to add task", e);
                        gantt.deleteTask(id);
                    }
                }
            }),
            gantt.attachEvent("onAfterTaskDelete", (id, _item) => {
                const handler = handlersRef.current.onTaskDelete;
                if (handler) handler(id);
            })
        ];

        return () => {
            events.forEach(event => gantt.detachEvent(event));
            gantt.clearAll();
        };
    }, []);

    // 處理假日資料更新
    useEffect(() => {
        // 預設週六日為假日
        gantt.setWorkTime({ day: 6, hours: false });
        gantt.setWorkTime({ day: 0, hours: false });

        if (holidays && holidays.length > 0) {
            console.log("Applying holidays:", holidays.length);
            holidays.forEach(holiday => {
                // Parse YYYY-MM-DD as local date to avoid timezone shifts
                const parts = holiday.date.split("-");
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1;
                    const d = parseInt(parts[2], 10);
                    const hDate = new Date(y, m, d);
                    if (!isNaN(hDate.getTime())) {
                        gantt.setWorkTime({ date: hDate, hours: false });
                    }
                }
            });
        }
        gantt.render();
    }, [holidays]);

    // 處理資料更新
    useEffect(() => {
        if (tasks && tasks.data && tasks.data.length > 0) {
            console.log("Loading tasks into gantt", tasks.data.length);
            gantt.clearAll();
            gantt.parse(tasks);
        }
    }, [tasks]);

    // 處理 Zoom
    useEffect(() => {
        console.log("Zoom level changing to:", zoom);
        switch (zoom) {
            case 'day':
                gantt.config.scales = [
                    { unit: "day", step: 1, date: "%d %M" }
                ];
                gantt.config.min_column_width = 80;
                break;
            case 'week':
                gantt.config.scales = [
                    { unit: "week", step: 1, format: (date: Date) => "Week #" + gantt.date.date_to_str("%W")(date) },
                    { unit: "day", step: 1, date: "%D" }
                ];
                gantt.config.min_column_width = 50;
                break;
            case 'month':
                gantt.config.scales = [
                    { unit: "month", step: 1, format: "%F, %Y" },
                    { unit: "week", step: 1, format: "W%W" }
                ];
                gantt.config.min_column_width = 120;
                break;
        }
        gantt.render();
    }, [zoom]);

    return (
        <div className="flex flex-col h-full border rounded-xl overflow-hidden bg-white shadow-sm">
            <GanttToolbar currentZoom={zoom} onZoomChange={setZoom} />
            <div className="relative flex-1 min-h-[500px]">
                {isLoading && (
                    <div className="absolute inset-0 z-10 bg-white/50 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                )}
                <div
                    ref={containerRef}
                    className="w-full h-full"
                    style={{ minHeight: '500px' }}
                ></div>
            </div>
        </div>
    );
};
