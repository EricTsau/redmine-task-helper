import React, { useState } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';

interface ExecutiveBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExecutiveBriefingModal: React.FC<ExecutiveBriefingModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string>('');
    const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

    const generateBriefing = async () => {
        setLoading(true);
        setReport('');
        try {
            const res = await api.post('/pm-copilot/executive-briefing', {
                time_range: timeRange
            }) as { markdown_report: string };
            setReport(res.markdown_report);
        } catch (error) {
            console.error("Failed to generate briefing", error);
            setReport("# Error\nFailed to generate report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate when opened if empty? Or let user click?
    // Let's let user click to choose options first, or auto for "Week"
    React.useEffect(() => {
        if (isOpen && !report && !loading) {
            generateBriefing();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        ✨ AI Executive Briefing
                    </h2>
                    <div className="flex items-center gap-4">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as 'week' | 'month')}
                            className="bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="week">Past Week</option>
                            <option value="month">Past Month</option>
                        </select>
                        <button
                            onClick={generateBriefing}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Generating...' : 'Regenerate'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p>Analyzing portfolio data and writing report...</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none">
                            <ReactMarkdown>{report}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800 rounded-b-xl">
                    <button
                        onClick={() => navigator.clipboard.writeText(report)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Copy className="w-4 h-4" />
                        Copy Markdown
                    </button>
                    {/* Download could be implemented later */}
                </div>
            </div>
        </div>
    );
};
