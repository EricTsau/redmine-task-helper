import { AlertTriangle } from 'lucide-react';

interface GroupStats {
    total: number;
    warning: number;
    severe: number;
}

interface TaskGroupStatsProps {
    stats: GroupStats;
    warningDays: number;
    severeDays: number;
}

export function TaskGroupStats({ stats, warningDays, severeDays }: TaskGroupStatsProps) {
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="bg-muted px-2 py-0.5 rounded-full" title={`此群組共有 ${stats.total} 個任務`}>
                Total: {stats.total}
            </span>
            {stats.warning > 0 && (
                <span
                    className="bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help"
                    title={`警告：有 ${stats.warning} 個任務超過 ${warningDays} 天未更新`}
                >
                    <AlertTriangle className="h-3 w-3" /> {stats.warning}
                </span>
            )}
            {stats.severe > 0 && (
                <span
                    className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help"
                    title={`嚴重：有 ${stats.severe} 個任務超過 ${severeDays} 天未更新`}
                >
                    <AlertTriangle className="h-3 w-3" /> {stats.severe}
                </span>
            )}
        </div>
    );
}
