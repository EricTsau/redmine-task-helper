import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, Send, RotateCw, Sparkles, Pencil, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

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
    const { token } = useAuth();
    const { showError, showSuccess } = useToast();

    // Chat state
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState<"chat" | "refine">("chat");

    const [currentMarkdown, setCurrentMarkdown] = useState(report.summary_markdown);

    // Manual Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Sync if report prop changes
    useState(() => {
        setCurrentMarkdown(report.summary_markdown);
        setChatHistory([]); // Clear history when switching report for now
    });

    const handleDownload = () => {
        const blob = new Blob([currentMarkdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.title}.md`;
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
            showSuccess("報告已更新");
        } catch (error) {
            console.error(error);
            showError("儲存失敗");
        } finally {
            setIsSaving(false);
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
            showError("請求失敗");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b shrink-0">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>
                        區間: {report.date_range_start} ~ {report.date_range_end || "至今"}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                                取消
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving ? <RotateCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                儲存
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={handleStartEdit} title="手動編輯">
                                <Pencil className="h-4 w-4 mr-2" />
                                編輯
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload} title="下載 Markdown">
                                <Download className="h-4 w-4 mr-2" />
                                下載
                            </Button>
                        </>
                    )}
                </div>
            </CardHeader>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left: Report Content */}
                <div className="flex-1 overflow-auto p-6 border-r relative flex flex-col">
                    {isEditing ? (
                        <Textarea
                            className="flex-1 font-mono text-sm resize-none p-4"
                            value={editContent}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                        />
                    ) : (
                        <article className="prose prose-sm dark:prose-invert max-w-none pb-10">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {currentMarkdown}
                            </ReactMarkdown>
                        </article>
                    )}
                </div>

                {/* Right: Chat / Interaction Panel */}
                <div className="w-full md:w-1/3 flex flex-col bg-muted/5 border-t md:border-t-0 md:border-l shrink-0 md:shrink">
                    <div className="p-3 border-b bg-muted/20 font-medium text-sm flex items-center shrink-0">
                        <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />
                        AI 報告助手
                    </div>

                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatHistory.length === 0 && (
                            <div className="text-center text-muted-foreground text-xs mt-10">
                                <p>您可以針對報告內容提問，</p>
                                <p>或輸入指示請 AI 重新整理報告。</p>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground"
                                    }`}>
                                    <div className="prose-sm dark:prose-invert">
                                        <ReactMarkdown>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-secondary text-secondary-foreground rounded-lg p-3 text-sm flex items-center">
                                    <RotateCw className="h-3 w-3 animate-spin mr-2" />
                                    {actionType === "refine" ? "正在重新撰寫報告..." : "正在思考..."}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-background shrink-0">
                        <div className="flex gap-2 mb-2">
                            <Input
                                placeholder="輸入問題或修改指示..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend("chat");
                                    }
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="default"
                                className="flex-1"
                                size="sm"
                                onClick={() => handleSend("chat")}
                                disabled={loading || !chatInput.trim()}
                            >
                                <Send className="h-3 w-3 mr-2" />
                                詢問內容
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1"
                                size="sm"
                                onClick={() => handleSend("refine")}
                                disabled={loading || !chatInput.trim()}
                                title="根據指示重新生成報告內容"
                            >
                                <RotateCw className="h-3 w-3 mr-2" />
                                重新整理
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
