import { useState } from 'react';
import { Send, Loader2, BarChart2 } from 'lucide-react';
import { GanttChart } from './GanttChart';

interface AnalysisResult {
    intent_filter: any;
    data_count: number;
    summary: string;
    data: any[];
}

import { api } from '@/lib/api';

export function AnalysisWidget() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // Get API Key
            const settingsRes = await api.get<any>('/settings');
            const apiKey = settingsRes.redmine_token;

            if (!apiKey) {
                setError("Redmine API Key not found in settings.");
                setLoading(false);
                return;
            }

            const res = await api.post<any>('/analysis/query', {
                query: query,
                api_key: apiKey
            });
            setResult(res);
        } catch (e) {
            console.error(e);
            setError("Analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-card border rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10 rounded-full">
                    <BarChart2 className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Conversational BI</h2>
            </div>

            {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* Input Area */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Ask about project status (e.g., 'Show overdue tasks in creating-project')"
                    className="flex-1 px-4 py-2 border rounded-md bg-background"
                />
                <button
                    onClick={handleAnalyze}
                    disabled={loading || !query.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Summary */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-sm font-medium mb-2 text-muted-foreground">AI Insight</h3>
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                            {result.summary}
                        </div>
                    </div>

                    {/* Chart */}
                    {result.data_count > 0 && (
                        <div>
                            <GanttChart tasks={result.data} />
                            <div className="text-xs text-right text-muted-foreground mt-2">
                                Showing {result.data_count} tasks based on filter: {JSON.stringify(result.intent_filter)}
                            </div>
                        </div>
                    )}

                    {result.data_count === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            No data found matching your query.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
