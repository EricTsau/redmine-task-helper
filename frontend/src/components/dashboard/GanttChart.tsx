import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

interface Task {
    id: number;
    subject: string;
    start_date: string;
    due_date: string;
    done_ratio: number;
    status: { name: string } | null;
    assigned_to: { name: string } | null;
}

interface GanttChartProps {
    tasks: Task[];
}

export function GanttChart({ tasks }: GanttChartProps) {
    if (!tasks || tasks.length === 0) return <div>No tasks to display</div>;

    // Filter tasks with valid dates
    const validTasks = tasks.filter(t => t.start_date && t.due_date);

    if (validTasks.length === 0) return <div className="text-muted-foreground p-4">No tasks with start/due dates found.</div>;

    // Find min/max dates for axis scaling
    const dates = validTasks.flatMap(t => [new Date(t.start_date).getTime(), new Date(t.due_date).getTime()]);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const dateRange = maxDate - minDate;
    // Add some padding (2 days)
    const padding = 2 * 24 * 60 * 60 * 1000;

    const today = new Date().getTime();
    const todayOffset = today - minDate;

    const data = validTasks.map(t => {
        const start = new Date(t.start_date).getTime();
        const end = new Date(t.due_date).getTime();
        const duration = end - start;
        // Calculate offset from minDate
        const offset = start - minDate;

        const isOverdue = end < today && t.done_ratio < 100;

        return {
            name: t.subject,
            offset: offset,
            duration: duration,
            done: t.done_ratio,
            assignee: t.assigned_to?.name || 'Unassigned',
            status: t.status?.name || 'Unknown',
            startStr: t.start_date,
            endStr: t.due_date,
            isOverdue
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const d = payload[1].payload; // accesses the data object
            return (
                <div className="bg-popover text-popover-foreground p-2 border rounded shadow-md text-sm z-50 relative">
                    <p className="font-semibold">{label}</p>
                    <p>Start: {d.startStr}</p>
                    <p>Due: {d.endStr}</p>
                    <p>Status: {d.status} ({d.done}%)</p>
                    <p>Assigned: {d.assignee}</p>
                    {d.isOverdue && <p className="text-red-500 font-bold">⚠️ Overdue</p>}
                </div>
            );
        }
        return null;
    };

    const formatXAxis = (tick: number) => {
        return new Date(minDate + tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getBarColor = (entry: any) => {
        if (entry.done === 100) return '#22c55e'; // Green
        if (entry.isOverdue) return '#ef4444'; // Red for Overdue
        return '#3b82f6'; // Blue default
    };

    return (
        <div className="h-[400px] w-full bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Project Timeline</span>
                <div className="flex gap-4 text-xs font-normal">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Overdue</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> Done</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> In Progress</div>
                </div>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={data}
                    margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        type="number"
                        domain={[0, dateRange + padding]}
                        tickFormatter={formatXAxis}
                    />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="offset" stackId="a" fill="transparent" />
                    <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]}>
                        {
                            data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                            ))
                        }
                    </Bar>
                    {todayOffset >= 0 && todayOffset <= (dateRange + padding) && (
                        <ReferenceLine x={todayOffset} stroke="red" strokeDasharray="3 3" label={{ value: 'Today', fill: 'red', fontSize: 12, position: 'insideTopRight' }} />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
