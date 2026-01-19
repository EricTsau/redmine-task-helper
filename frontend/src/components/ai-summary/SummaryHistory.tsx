import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface Report {
    id: number;
    title: string;
    created_at: string;
}

interface SummaryHistoryProps {
    reports: Report[];
    onSelectReport: (id: number) => void;
}

export function SummaryHistory({ reports, onSelectReport }: SummaryHistoryProps) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>歷史報告</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                    {reports.length === 0 && <div className="text-center text-muted-foreground p-4">尚無歷史報告</div>}
                    <div className="space-y-2">
                        {reports.map((report) => (
                            <Button
                                key={report.id}
                                variant="ghost"
                                className="w-full justify-start text-left h-auto py-3 flex flex-col items-start"
                                onClick={() => onSelectReport(report.id)}
                            >
                                <span className="font-medium truncate w-full">{report.title}</span>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(report.created_at).toLocaleString()}
                                </span>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
