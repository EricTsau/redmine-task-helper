import React, { useEffect, useRef, useState } from 'react';

interface GanttTask {
    id: number;
    subject: string;
    start_date: string | null;
    due_date: string | null;
    estimated_hours: number | null;
    done_ratio: number;
    status: string;
    priority: string;
    parent_id: number | null;
    working_days: number;
    color: string;
}

interface GanttEditorProps {
    tasks: GanttTask[];
    onTaskUpdate?: (taskId: number, updates: { start_date?: string; due_date?: string }) => void;
}

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 50;
const LEFT_PANEL_WIDTH = 280;

export const GanttEditor: React.FC<GanttEditorProps> = ({ tasks, onTaskUpdate: _onTaskUpdate }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredTask, setHoveredTask] = useState<number | null>(null);

    // 計算時間範圍
    const getDateRange = () => {
        if (tasks.length === 0) {
            const today = new Date();
            return {
                start: new Date(today.getFullYear(), today.getMonth(), 1),
                end: new Date(today.getFullYear(), today.getMonth() + 2, 0)
            };
        }

        let minDate = new Date();
        let maxDate = new Date();

        tasks.forEach(task => {
            if (task.start_date) {
                const start = new Date(task.start_date);
                if (start < minDate) minDate = start;
            }
            if (task.due_date) {
                const due = new Date(task.due_date);
                if (due > maxDate) maxDate = due;
            }
        });

        // 加上緩衝
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 14);

        return { start: minDate, end: maxDate };
    };

    const dateRange = getDateRange();
    const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

    // 繪製甘特圖
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = LEFT_PANEL_WIDTH + totalDays * DAY_WIDTH;
        const height = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

        canvas.width = width;
        canvas.height = height;

        // 清空畫布
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // 繪製日期標題
        ctx.fillStyle = '#f4f4f5';
        ctx.fillRect(LEFT_PANEL_WIDTH, 0, width - LEFT_PANEL_WIDTH, HEADER_HEIGHT);

        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';

        let currentDate = new Date(dateRange.start);
        let dayIndex = 0;

        while (currentDate <= dateRange.end) {
            const x = LEFT_PANEL_WIDTH + dayIndex * DAY_WIDTH + DAY_WIDTH / 2;
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

            // 週末背景
            if (isWeekend) {
                ctx.fillStyle = '#fef2f2';
                ctx.fillRect(LEFT_PANEL_WIDTH + dayIndex * DAY_WIDTH, HEADER_HEIGHT, DAY_WIDTH, height - HEADER_HEIGHT);
            }

            // 日期文字
            ctx.fillStyle = isWeekend ? '#dc2626' : '#71717a';
            ctx.fillText(currentDate.getDate().toString(), x, HEADER_HEIGHT - 10);

            // 月份 (每月第一天)
            if (currentDate.getDate() === 1) {
                ctx.fillStyle = '#09090b';
                ctx.font = 'bold 12px Inter, system-ui, sans-serif';
                ctx.fillText(
                    currentDate.toLocaleDateString('zh-TW', { month: 'short' }),
                    x,
                    HEADER_HEIGHT - 30
                );
                ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            }

            // 垂直網格線
            ctx.strokeStyle = '#e4e4e7';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(LEFT_PANEL_WIDTH + dayIndex * DAY_WIDTH, HEADER_HEIGHT);
            ctx.lineTo(LEFT_PANEL_WIDTH + dayIndex * DAY_WIDTH, height);
            ctx.stroke();

            currentDate.setDate(currentDate.getDate() + 1);
            dayIndex++;
        }

        // 繪製今日線
        const today = new Date();
        const todayIndex = Math.ceil((today.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        if (todayIndex >= 0 && todayIndex < totalDays) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(LEFT_PANEL_WIDTH + todayIndex * DAY_WIDTH, HEADER_HEIGHT);
            ctx.lineTo(LEFT_PANEL_WIDTH + todayIndex * DAY_WIDTH, height);
            ctx.stroke();
        }

        // 繪製左側任務面板背景
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, LEFT_PANEL_WIDTH, height);

        // 繪製標題
        ctx.fillStyle = '#f4f4f5';
        ctx.fillRect(0, 0, LEFT_PANEL_WIDTH, HEADER_HEIGHT);
        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('任務名稱', 16, HEADER_HEIGHT / 2 + 5);

        // 繪製任務
        tasks.forEach((task, index) => {
            const y = HEADER_HEIGHT + index * ROW_HEIGHT;

            // 水平網格線
            ctx.strokeStyle = '#e4e4e7';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y + ROW_HEIGHT);
            ctx.lineTo(width, y + ROW_HEIGHT);
            ctx.stroke();

            // Hover 效果
            if (hoveredTask === task.id) {
                ctx.fillStyle = '#f0f9ff';
                ctx.fillRect(0, y, width, ROW_HEIGHT);
            }

            // 任務名稱
            ctx.fillStyle = '#09090b';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.textAlign = 'left';
            const truncatedName = task.subject.length > 28
                ? task.subject.substring(0, 28) + '...'
                : task.subject;
            ctx.fillText(truncatedName, 16, y + ROW_HEIGHT / 2 + 4);

            // 繪製任務條
            if (task.start_date && task.due_date) {
                const startIndex = Math.ceil(
                    (new Date(task.start_date).getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
                );
                const endIndex = Math.ceil(
                    (new Date(task.due_date).getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
                );

                const barX = LEFT_PANEL_WIDTH + startIndex * DAY_WIDTH + 2;
                const barWidth = (endIndex - startIndex + 1) * DAY_WIDTH - 4;
                const barY = y + 6;
                const barHeight = ROW_HEIGHT - 12;

                // 任務條背景
                ctx.fillStyle = task.color || '#3b82f6';
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, 6);
                ctx.fill();

                // 進度條
                if (task.done_ratio > 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.beginPath();
                    ctx.roundRect(barX, barY, barWidth * (task.done_ratio / 100), barHeight, 6);
                    ctx.fill();
                }

                // 任務條文字
                if (barWidth > 60) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        task.done_ratio > 0 ? `${task.done_ratio}%` : task.status,
                        barX + barWidth / 2,
                        barY + barHeight / 2 + 4
                    );
                }
            }
        });

        // 分隔線
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(LEFT_PANEL_WIDTH, 0);
        ctx.lineTo(LEFT_PANEL_WIDTH, height);
        ctx.stroke();

    }, [tasks, hoveredTask, dateRange.start.getTime(), totalDays]);

    // 滑鼠事件
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const y = e.clientY - rect.top;
        const taskIndex = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);

        if (taskIndex >= 0 && taskIndex < tasks.length) {
            setHoveredTask(tasks[taskIndex].id);
        } else {
            setHoveredTask(null);
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>尚無任務資料</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="overflow-auto border rounded-xl bg-white"
            style={{ maxHeight: '400px' }}
        >
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredTask(null)}
                className="cursor-pointer"
            />
        </div>
    );
};

export default GanttEditor;
