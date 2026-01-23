import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dateUtils";
import { Trash2 } from "lucide-react";

interface Report {
    id: number;
    title: string;
    created_at: string;
}

interface SummaryHistoryProps {
    reports: Report[];
    onSelectReport: (id: number) => void;
    onDelete: (id: number) => void;
}

export function SummaryHistory({ reports, onSelectReport, onDelete }: SummaryHistoryProps) {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col">
            {/* ... header ... */}
            <div className="p-6 border-b border-border/20">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    <h3 className="text-sm font-bold">{t('aiSummary.historyTitle')}</h3>
                </div>
            </div>
            <ScrollArea className="flex-1 px-4">
                {reports.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                        {t('aiSummary.noHistory')}
                    </div>
                )}
                <div className="space-y-2 py-4">
                    {reports.map((report) => (
                        <div key={report.id} className="group relative w-full">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-left h-auto py-3 flex flex-col items-start hover:bg-white/10 rounded-xl pr-10"
                                onClick={() => onSelectReport(report.id)}
                            >
                                <span className="font-medium truncate w-full">{report.title}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDateTime(report.created_at)}
                                </span>
                            </Button>
                            <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(report.id);
                                }}
                                title={t('common.delete')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
