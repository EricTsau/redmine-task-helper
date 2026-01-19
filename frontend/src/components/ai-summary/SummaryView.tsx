import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download } from "lucide-react";

interface SummaryViewProps {
    report: {
        title: string;
        date_range_start: string;
        date_range_end: string;
        summary_markdown: string;
    };
}

export function SummaryView({ report }: SummaryViewProps) {

    const handleDownload = () => {
        const blob = new Blob([report.summary_markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.title}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>{report.title}</CardTitle>
                    <CardDescription>
                        區間: {report.date_range_start} ~ {report.date_range_end || "至今"}
                    </CardDescription>
                </div>
                <Button variant="outline" size="icon" onClick={handleDownload} title="下載 Markdown">
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                <article className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {report.summary_markdown}
                    </ReactMarkdown>
                </article>
            </CardContent>
        </Card>
    );
}
