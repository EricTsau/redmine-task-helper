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
import { Loader2, Save, RotateCw, Pencil, Download, Send, Sparkles, Check, Wand2 } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface SummaryViewProps {
    report: {
        id: number;
        title: string;
        date_range_start: string;
        date_range_end: string;
        summary_markdown: string;
    };
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export function SummaryView({ report }: SummaryViewProps) {
    const { t } = useTranslation();
    const { token } = useAuth();
    const { showError, showSuccess } = useToast();

    const [currentMarkdown, setCurrentMarkdown] = useState(report.summary_markdown);
    const [title, setTitle] = useState(report.title);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Title Edit State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");

    // Chat state
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState<"chat" | "refine">("chat");

    // Sync state when report changes
    useEffect(() => {
        setCurrentMarkdown(report.summary_markdown);
        setTitle(report.title);
        setChatHistory([]); // Clear history when switching report for now
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
            showSuccess(t('aiSummary.reportUpdated'));
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.saveFailed'));
        } finally {
            setIsEditingTitle(false);
        }
    };

    const handleSend = async (action: "chat" | "refine") => {
        if (!chatInput.trim()) return;

        setLoading(true);
        setActionType(action);

        // Optimistic UI updates
        const userMsg: ChatMessage = { role: "user", content: chatInput };
        setChatHistory(prev => [...prev, userMsg]);

        try {
            const res = await api.post<any>(`/ai-summary/${report.id}/chat`, {
                message: chatInput,
                action: action
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const aiMsg: ChatMessage = { role: "assistant", content: res.response };
            setChatHistory(prev => [...prev, aiMsg]);

            if (action === "refine" && res.updated_summary) {
                setCurrentMarkdown(res.updated_summary);
            }

            setChatInput("");
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.requestFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4 pr-1">
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

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden border border-border/20 rounded-2xl bg-black/20 backdrop-blur-sm">
                {/* Left: Report Content */}
                <div className="flex-1 overflow-auto p-6 border-r border-border/10 relative flex flex-col custom-scrollbar">
                    {isEditing ? (
                        <Textarea
                            className="flex-1 font-mono text-sm resize-none p-4 bg-transparent border-none focus-visible:ring-0"
                            value={editContent}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                        />
                    ) : (
                        <>
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

                            <article className="prose prose-sm dark:prose-invert max-w-none pb-10">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        // Custom link renderer to open in new tab
                                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} className="text-primary hover:underline" />,
                                        table: ({ node, ...props }) => <table className="w-full border-collapse" {...props} />,
                                        th: ({ node, ...props }) => <th className="border border-border p-2 bg-muted/50 text-left" {...props} />,
                                        td: ({ node, ...props }) => <td className="border border-border p-2" {...props} />,
                                    }}
                                >
                                    {currentMarkdown}
                                </ReactMarkdown>
                            </article>
                        </>
                    )}
                </div>

                {/* Right: AI Chat */}
                <div className="w-full md:w-[350px] flex flex-col bg-white/5">
                    <div className="p-3 border-b border-border/10">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('aiSummary.copilot')}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatHistory.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground/50 text-sm">
                                <p>{t('aiSummary.askAboutReport')}</p>
                                <p className="text-xs mt-2 opacity-70">{t('aiSummary.refineExample')}</p>
                            </div>
                        )}
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-muted text-muted-foreground rounded-bl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted/50 rounded-2xl p-3 rounded-bl-none flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs">
                                        {actionType === 'refine' ? t('aiSummary.refining') : t('aiSummary.thinking')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-border/10 bg-white/5">
                        <div className="flex gap-2">
                            <Textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={t('aiSummary.chatPlaceholder')}
                                className="min-h-[40px] max-h-[120px] bg-black/20 border-border/20 resize-none text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend('chat');
                                    }
                                }}
                            />
                            <div className="flex flex-col gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                                    onClick={() => handleSend('chat')}
                                    disabled={loading || !chatInput.trim()}
                                    title={t('aiSummary.sendChat')}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-purple-500/20 hover:text-purple-400"
                                    onClick={() => handleSend('refine')}
                                    disabled={loading || !chatInput.trim()}
                                    title={t('aiSummary.refineReport')}
                                >
                                    <Wand2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
