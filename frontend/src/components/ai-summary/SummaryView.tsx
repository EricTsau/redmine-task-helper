import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { AICopilotFloating } from "@/components/ai-chat/AICopilotFloating";
import { Save, RotateCw, Pencil, Download, Check, Globe, Activity, GitCommit, GitMerge } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import ActivityHeatmap from "@/components/ActivityHeatmap";

interface SummaryViewProps {
    report: {
        id: number;
        title: string;
        date_range_start: string;
        date_range_end: string;
        summary_markdown: string;
        gitlab_metrics?: string;
    };
    onReportUpdated?: (report: any) => void;
}


export function SummaryView(props: SummaryViewProps) {
    const { report } = props;
    const { t } = useTranslation();
    const { token } = useAuth();
    const { showError, showSuccess } = useToast();

    const [currentMarkdown, setCurrentMarkdown] = useState(report.summary_markdown);
    const [title, setTitle] = useState(report.title);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editTab, setEditTab] = useState<'write' | 'preview'>('write');
    const [editContent, setEditContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Title Edit State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");

    // Sync state when report changes
    useEffect(() => {
        setCurrentMarkdown(report.summary_markdown);
        setTitle(report.title);
    }, [report]);

    const handleDownload = () => {
        const blob = new Blob([currentMarkdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleStartEdit = () => {
        setEditContent(currentMarkdown);
        setEditTab('write');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditContent("");
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            await api.put(`/ai-summary/${report.id}`, {
                summary_markdown: editContent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCurrentMarkdown(editContent);
            setIsEditing(false);

            // Notify parent
            if (report && (props as any).onReportUpdated) {
                (props as any).onReportUpdated({ ...report, summary_markdown: editContent });
            }

            showSuccess(t('aiSummary.reportUpdated'));
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateTitle = async () => {
        if (!editTitle.trim() || editTitle === title) {
            setIsEditingTitle(false);
            return;
        }

        try {
            await api.put(`/ai-summary/${report.id}`, {
                title: editTitle
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTitle(editTitle);

            // Notify parent
            if (report && (props as any).onReportUpdated) {
                (props as any).onReportUpdated({ ...report, title: editTitle });
            }

            showSuccess(t('aiSummary.reportUpdated'));
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.saveFailed'));
        } finally {
            setIsEditingTitle(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4 pr-1 relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between shrink-0 pl-1">
                <div className="flex items-center gap-4 flex-1">
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2 flex-1 max-w-md animate-in fade-in zoom-in-95 duration-200">
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-9 font-black text-xl bg-white/10 border-white/20"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateTitle();
                                    if (e.key === 'Escape') setIsEditingTitle(false);
                                }}
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-green-500/20 hover:text-green-500" onClick={handleUpdateTitle}>
                                <Check className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="group flex items-center gap-2">
                            <h2
                                className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50 cursor-pointer hover:underline decoration-dashed underline-offset-4 truncate max-w-2xl"
                                onClick={() => {
                                    setEditTitle(title);
                                    setIsEditingTitle(true);
                                }}
                                title="Click to edit title"
                            >
                                {title}
                            </h2>
                            <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                setEditTitle(title);
                                setIsEditingTitle(true);
                            }}>
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            <span className="text-xs text-muted-foreground ml-2">
                                {formatDate(report.date_range_start)} ~ {report.date_range_end ? formatDate(report.date_range_end) : t('aiSummary.toNow')}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                                {t('aiSummary.cancel')}
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving ? <RotateCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                {t('aiSummary.save')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={handleStartEdit} title={t('aiSummary.edit')} className="bg-white/5 border-border/20 hover:bg-white/10">
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                {t('aiSummary.edit')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload} className="bg-white/5 border-border/20 hover:bg-white/10">
                                <Download className="h-3.5 w-3.5 mr-2" />
                                {t('aiSummary.exportMd')}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden border border-border/20 rounded-2xl bg-black/20 backdrop-blur-sm">
                {/* Report Content */}
                <div className="flex-1 overflow-auto p-8 relative flex flex-col custom-scrollbar bg-white/95 text-slate-900">
                    {isEditing ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <div className="flex items-center gap-2 mb-2 border-b border-border/10 pb-2">
                                <button
                                    onClick={() => setEditTab('write')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${editTab === 'write' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                                >
                                    {t('common.edit') || 'Edit'}
                                </button>
                                <button
                                    onClick={() => setEditTab('preview')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${editTab === 'preview' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                                >
                                    {t('common.preview') || 'Preview'}
                                </button>
                            </div>

                            {editTab === 'write' ? (
                                <Textarea
                                    className="flex-1 font-mono text-sm resize-none p-4 bg-transparent border-none focus-visible:ring-0 text-slate-900 placeholder:text-slate-400 focus:bg-white/50 rounded-lg transition-colors"
                                    value={editContent}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                                    placeholder="Markdown supported..."
                                />
                            ) : (
                                <div className="flex-1 overflow-auto bg-slate-50/50 rounded-lg p-4 border border-slate-200">
                                    <article className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-800">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {editContent}
                                        </ReactMarkdown>
                                    </article>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* GitLab Pulse Dashboard */}
                            {(() => {
                                try {
                                    const metrics = JSON.parse(report.gitlab_metrics || "{}");
                                    if (!metrics.instances || metrics.instances.length === 0) return null;

                                    return (
                                        <div className="mb-10 space-y-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <Activity className="w-5 h-5 text-primary" />
                                                </div>
                                                <h2 className="text-xl font-black tracking-tight text-slate-800">GitLab Pulse Dashboard</h2>
                                            </div>

                                            {metrics.instances.map((inst: any, idx: number) => (
                                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Globe className="w-5 h-5 text-cyan-600" />
                                                            <h3 className="font-bold text-slate-800">{inst.name}</h3>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="text-center px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commits</div>
                                                                <div className="text-lg font-black text-slate-800">{inst.impact.total_commits}</div>
                                                            </div>
                                                            <div className="text-center px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MR Time</div>
                                                                <div className="text-lg font-black text-slate-800">{(inst.cycle.average_cycle_time_seconds / 3600).toFixed(1)}h</div>
                                                            </div>
                                                            <div className="text-center px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reviews</div>
                                                                <div className="text-lg font-black text-slate-800">{inst.cycle.total_review_notes}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {inst.impact.tech_stack && inst.impact.tech_stack.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {inst.impact.tech_stack.map((item: any, i: number) => (
                                                                <div key={i} className="px-3 py-1 bg-white border border-slate-100 rounded-full flex items-center gap-2 shadow-sm">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{item.language}</span>
                                                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-cyan-500" style={{ width: `${item.percentage}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-cyan-600">{item.percentage}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                                                        <ActivityHeatmap data={inst.heatmap} />
                                                    </div>

                                                    <div className="grid grid-cols-4 gap-4">
                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                                                            <div className="p-2 bg-green-50 rounded-lg">
                                                                <GitCommit className="w-4 h-4 text-green-600" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Additions</div>
                                                                <div className="text-sm font-bold text-slate-700">+{inst.impact.additions}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                                                            <div className="p-2 bg-red-50 rounded-lg">
                                                                <GitCommit className="w-4 h-4 text-red-600" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deletions</div>
                                                                <div className="text-sm font-bold text-slate-700">-{inst.impact.deletions}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                                                            <div className="p-2 bg-indigo-50 rounded-lg">
                                                                <GitMerge className="w-4 h-4 text-indigo-600" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Merged</div>
                                                                <div className="text-sm font-bold text-slate-700">{inst.cycle.merged_count}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                                                            <div className="p-2 bg-cyan-50 rounded-lg">
                                                                <GitMerge className="w-4 h-4 text-cyan-600" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opened</div>
                                                                <div className="text-sm font-bold text-slate-700">{inst.cycle.opened_count}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="border-b border-slate-200 pt-4" />
                                        </div>
                                    );
                                } catch (e) {
                                    return null;
                                }
                            })()}

                            {/* If report indicates no updates, show clearer guidance */}
                            {(currentMarkdown.includes('Found 0 updated issues') || currentMarkdown.includes('無更新')) && (
                                <div className="mb-4 p-4 rounded border bg-yellow-50 text-sm">
                                    <strong>{t('aiSummary.noUpdatesNotice')}</strong> {t('aiSummary.noUpdatesMessage')}
                                    <div className="mt-2 text-xs">
                                        {t('aiSummary.noUpdatesSuggestions')}
                                        <ul className="list-disc ml-4">
                                            <li>{t('aiSummary.noUpdatesSuggestion1')}</li>
                                            <li>{t('aiSummary.noUpdatesSuggestion2')}</li>
                                            <li>{t('aiSummary.noUpdatesSuggestion3')}</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <article className="prose prose-sm max-w-none pb-10 prose-headings:text-slate-900 prose-p:text-slate-800 prose-strong:text-slate-900 prose-ul:text-slate-800 prose-li:text-slate-800 prose-a:text-blue-600 prose-code:text-slate-900 prose-pre:bg-slate-100 prose-pre:text-slate-900">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        // Custom link renderer to open in new tab
                                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} className="text-blue-600 hover:underline font-medium" />,
                                        table: ({ node, ...props }) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-200"><table className="w-full border-collapse bg-white text-sm" {...props} /></div>,
                                        th: ({ node, ...props }) => <th className="border-b border-slate-200 p-3 bg-slate-50 text-left font-bold text-slate-700 whitespace-nowrap" {...props} />,
                                        td: ({ node, ...props }) => <td className="border-b border-slate-100 p-3 text-slate-600 align-top" {...props} />,
                                        img: ({ node, ...props }) => {
                                            // 檢查是否為 Redmine 圖片 URL
                                            const isRedmineImage = props.src && props.src.includes('/attachments/') && props.src.startsWith('http');

                                            if (isRedmineImage && props.src) {
                                                // 使用代理端點獲取圖片
                                                const proxyUrl = `/api/v1/ai-summary/redmine-image?url=${encodeURIComponent(props.src)}`;
                                                return (
                                                    <span>
                                                        <img
                                                            src={proxyUrl}
                                                            alt={props.alt}
                                                            className="rounded-lg border border-slate-200 shadow-sm max-h-[500px] object-contain bg-slate-50 my-6"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                // 圖片加載失敗時的處理
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                // 顯示錯誤信息
                                                                const errorDiv = document.createElement('div');
                                                                errorDiv.className = 'text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200 my-6';
                                                                errorDiv.textContent = `圖片加載失敗: ${props.alt || props.src || 'Unknown image'}`;
                                                                target.parentNode?.appendChild(errorDiv);
                                                            }}
                                                        />
                                                        {props.alt && <span className="text-center text-xs text-slate-500 mt-2 italic block">{props.alt}</span>}
                                                    </span>
                                                );
                                            }

                                            // 非 Redmine 圖片使用默認渲染
                                            return (
                                                <span>
                                                    <img {...props} className="rounded-lg border border-slate-200 shadow-sm max-h-[500px] object-contain bg-slate-50 my-6" loading="lazy" />
                                                    {props.alt && <span className="text-center text-xs text-slate-500 mt-2 italic block">{props.alt}</span>}
                                                </span>
                                            );
                                        },
                                        ul: ({ node, ...props }) => <ul className="list-disc ml-6 my-2 marker:text-slate-400" {...props} />,
                                        li: ({ node, ...props }) => <li className="pl-1 my-1" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-3xl font-black tracking-tight border-b border-slate-200 pb-4 mb-6 mt-8 text-slate-900" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold border-l-4 border-primary pl-4 mb-4 mt-8 text-slate-800 bg-slate-50/50 py-1" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-3 mt-6 text-slate-800" {...props} />,
                                        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-slate-300 pl-4 py-1 my-4 italic text-slate-500 bg-slate-50 rounded-r" {...props} />,
                                    }}
                                >
                                    {currentMarkdown}
                                </ReactMarkdown>
                            </article>
                        </>
                    )}
                </div>
            </div>

            <AICopilotFloating
                contextType="ai_summary"
                getContextData={() => ({ report_content: currentMarkdown })}
            />
        </div>
    );
}
