import React from 'react';
import {
    Calendar,
    CalendarDays,
    CalendarRange,
    RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface GanttToolbarProps {
    currentZoom: 'day' | 'week' | 'month';
    onZoomChange: (zoom: 'day' | 'week' | 'month') => void;
    onRefresh?: () => void;
}

export const GanttToolbar: React.FC<GanttToolbarProps> = ({
    currentZoom,
    onZoomChange,
    onRefresh
}) => {
    return (
        <div className="flex items-center justify-between p-2 border-b bg-card">
            <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                    <Button
                        variant={currentZoom === 'day' ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none px-3"
                        onClick={() => onZoomChange('day')}
                    >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Day
                    </Button>
                    <div className="w-px h-4 bg-border" />
                    <Button
                        variant={currentZoom === 'week' ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none px-3"
                        onClick={() => onZoomChange('week')}
                    >
                        <CalendarRange className="h-4 w-4 mr-2" />
                        Week
                    </Button>
                    <div className="w-px h-4 bg-border" />
                    <Button
                        variant={currentZoom === 'month' ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none px-3"
                        onClick={() => onZoomChange('month')}
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        Month
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {onRefresh && (
                    <Button variant="ghost" size="icon" onClick={onRefresh}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};
