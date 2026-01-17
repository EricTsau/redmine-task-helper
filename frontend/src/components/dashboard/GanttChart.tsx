import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
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

    const data = validTasks.map(t => {
        const start = new Date(t.start_date).getTime();
        const end = new Date(t.due_date).getTime();
        const duration = end - start;
        // Calculate offset from minDate
        const offset = start - minDate;

        return {
            name: t.subject,
            offset: offset,
            duration: duration,
            done: t.done_ratio,
            assignee: t.assigned_to?.name || 'Unassigned',
            status: t.status?.name || 'Unknown',
            startStr: t.start_date,
            endStr: t.due_date
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const d = payload[1].payload; // accesses the data object
            return (
                <div className="bg-popover text-popover-foreground p-2 border rounded shadow-md text-sm">
                    <p className="font-semibold">{label}</p>
                    <p>Start: {d.startStr}</p>
                    <p>Due: {d.endStr}</p>
                    <p>Status: {d.status} ({d.done}%)</p>
                    <p>Assigned: {d.assignee}</p>
                </div>
            );
        }
        return null;
    };

    const formatXAxis = (tick: number) => {
        return new Date(minDate + tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Custom Bar for Progress? 
    // For simplicity MVP: just color code or show simple bars.
    // Recharts Stacked Bar: [Offset (invisible), Duration (visible)]

    return (
        <div className="h-[400px] w-full bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4">Project Timeline</h3>
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
                        hide // Hiding X axis ticks likely cleaner for Gantt, or show them
                    />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="offset" stackId="a" fill="transparent" />
                    <Bar dataKey="duration" stackId="a" fill="#3b82f6" radius={[4, 4, 4, 4]}>
                        {
                            data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.done === 100 ? '#22c55e' : '#3b82f6'} />
                            ))
                        }
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
