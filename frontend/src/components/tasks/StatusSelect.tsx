
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Status {
    id: number;
    name: string;
    is_closed: boolean;
}

interface StatusSelectProps {
    currentStatusId?: number;
    currentStatusName: string;
    onStatusChange: (statusId: number) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

export function StatusSelect({ currentStatusId, currentStatusName, onStatusChange, disabled, className }: StatusSelectProps) {
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const loadStatuses = async () => {
        if (statuses.length > 0) return;
        setIsLoading(true);
        try {
            const res = await api.get<Status[]>('/tasks/statuses');
            setStatuses(res);
        } catch (error) {
            console.error('Failed to load statuses', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = async (status: Status) => {
        if (status.id === currentStatusId) return;
        setIsUpdating(true);
        try {
            await onStatusChange(status.id);
        } finally {
            setIsUpdating(false);
        }
    };

    // Determine color based on name (matching getTaskHealthColorClass roughly or just badge style)
    const getStatusColor = (name: string) => {
        if (['New', '新建'].includes(name)) return 'bg-blue-100 text-blue-700';
        if (['In Progress', '進行中', 'Doing'].includes(name)) return 'bg-yellow-100 text-yellow-700';
        if (['Resolved', '已解決', 'Closed', '已關閉'].includes(name)) return 'bg-green-100 text-green-700';
        if (['Feedback', '回饋'].includes(name)) return 'bg-purple-100 text-purple-700';
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <DropdownMenu onOpenChange={(open) => open && loadStatuses()}>
            <DropdownMenuTrigger disabled={disabled || isUpdating} asChild>
                <button
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50",
                        getStatusColor(currentStatusName),
                        className
                    )}
                >
                    {isUpdating ? <span className="animate-spin">⌛</span> : currentStatusName}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
                {isLoading ? (
                    <div className="p-2 text-xs text-center text-muted-foreground">Loading...</div>
                ) : (
                    statuses.map((status) => (
                        <DropdownMenuItem
                            key={status.id}
                            onClick={() => handleSelect(status)}
                            className="flex items-center justify-between text-xs"
                        >
                            <span>{status.name}</span>
                            {status.id === currentStatusId && <Check className="h-3 w-3" />}
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
