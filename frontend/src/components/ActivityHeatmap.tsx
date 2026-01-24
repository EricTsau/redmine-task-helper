import React, { useMemo } from 'react';

interface ActivityHeatmapProps {
    data: Record<string, number>; // date (YYYY-MM-DD) -> count
    instanceName?: string;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, instanceName }) => {
    // Generate last 365 days
    const days = useMemo(() => {
        const result = [];
        const today = new Date();
        for (let i = 364; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            result.push({
                date: dateStr,
                count: data[dateStr] || 0
            });
        }
        return result;
    }, [data]);

    const getColor = (count: number) => {
        if (count === 0) return 'bg-slate-200/50 dark:bg-slate-800/50';
        if (count < 3) return 'bg-emerald-200 dark:bg-emerald-900';
        if (count < 6) return 'bg-emerald-400 dark:bg-emerald-700';
        if (count < 10) return 'bg-emerald-500 dark:bg-emerald-500';
        return 'bg-emerald-600 dark:bg-emerald-400';
    };

    // Group by weeks for better layout
    const weeks = useMemo(() => {
        const result: { date: string, count: number }[][] = [];
        let currentWeek: { date: string, count: number }[] = [];

        // Find the first day's day of week to align
        const firstDay = new Date(days[0].date);
        const padding = firstDay.getDay(); // 0 is Sunday

        // Add padding if necessary
        for (let i = 0; i < padding; i++) {
            currentWeek.push({ date: '', count: -1 });
        }

        days.forEach((day) => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                result.push(currentWeek);
                currentWeek = [];
            }
        });

        if (currentWeek.length > 0) {
            result.push(currentWeek);
        }
        return result;
    }, [days]);

    return (
        <div className="bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {instanceName ? `${instanceName} Activity` : 'Commit Activity'}
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Less</span>
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-200/50 dark:bg-slate-800/50"></div>
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900"></div>
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-500"></div>
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400"></div>
                    <span>More</span>
                </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                        {week.map((day, dIdx) => (
                            <div
                                key={`${wIdx}-${dIdx}`}
                                title={day.date ? `${day.date}: ${day.count} commits` : ''}
                                className={`w-3 h-3 rounded-sm ${day.count === -1 ? 'bg-transparent' : getColor(day.count)} transition-all duration-200 hover:scale-125 hover:ring-1 ring-emerald-400`}
                            ></div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-2 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>365 days ago</span>
                <span>Today</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
