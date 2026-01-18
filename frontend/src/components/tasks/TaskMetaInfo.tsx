import { Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { type TaskHealthStatus } from './taskUtils';

interface TaskMetaInfoProps {
    estimated_hours?: number | null;
    spent_hours?: number;
    updated_on?: string | null;
    status: TaskHealthStatus;
}

export function TaskMetaInfo({ estimated_hours, spent_hours, updated_on, status }: TaskMetaInfoProps) {
    return (
        <div className="flex items-center gap-3 mt-1 text-xs opacity-80">
            {estimated_hours && <span>Est: {estimated_hours}h</span>}
            {spent_hours !== undefined && spent_hours > 0 && <span>Spent: {spent_hours}h</span>}
            {updated_on && (
                <span
                    className={`flex items-center gap-1 ${status !== 'normal' ? 'font-medium' : ''}`}
                    title={format(new Date(updated_on), "yyyy/MM/dd HH:mm:ss 'UTC'xxx")}
                >
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(updated_on), { addSuffix: true })}
                </span>
            )}
        </div>
    );
}
