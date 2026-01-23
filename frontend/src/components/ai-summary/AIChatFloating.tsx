import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Loader2, Send, Bot, X, Copy, Check, Minimize2, Maximize2 } from "lucide-react";

interface AIChatFloatingProps {
    reportId: number;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export function AIChatFloating({ reportId }: AIChatFloatingProps) {
    const { t } = useTranslation();
    const { token } = useAuth();
    const { showError } = useToast();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, isOpen]);

    const handleSend = async () => {
        if (!chatInput.trim()) return;

        setLoading(true);
        const userMsg: ChatMessage = { role: "user", content: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput("");

        try {
            const res = await api.post<any>(`/ai-summary/${reportId}/chat`, {
                message: userMsg.content,
                action: "chat"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const aiMsg: ChatMessage = { role: "assistant", content: res.response };
            setChatHistory(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.requestFailed'));
        } finally {
            setLoading(false);
        }
    };

    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false);

        const onCopy = () => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <button
                onClick={onCopy}
                className="absolute top-2 right-2 p-1 bg-black/10 hover:bg-black/20 rounded text-slate-500 hover:text-slate-800 transition-colors"
                title={t('aiSummary.copy')}
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        );
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-8 right-8 z-50">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-purple-600 hover:scale-110 transition-transform duration-300 border-4 border-white/10"
                >
                    <Bot className="w-8 h-8 text-white" />
                </Button>
            </div>
        );
    }

    return (
        <div className={`fixed bottom-8 right-8 z-50 flex flex-col bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${isMinimized ? 'w-72 h-14' : 'w-[450px] h-[600px] max-h-[80vh]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100 shrink-0 cursor-pointer" onClick={() => isMinimized && setIsMinimized(false)}>
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <Bot className="w-5 h-5 text-primary" />
                    <span>{t('aiSummary.copilot')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Chat Area */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
                        {chatHistory.length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t('aiSummary.askAboutReport')}</p>
                            </div>
                        )}
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`relative max-w-[90%] rounded-2xl p-3 text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                                    }`}>
                                    {msg.role === 'assistant' && <CopyButton text={msg.content} />}

                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-p:text-slate-700 prose-headings:text-slate-800 prose-ul:text-slate-700 prose-li:text-slate-700">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    img: ({ node, ...props }) => <img {...props} className="max-w-full rounded border border-slate-200 my-2" loading="lazy" />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div>{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl p-3 rounded-bl-none flex items-center gap-2 border border-slate-100 shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span className="text-xs text-slate-500">{t('aiSummary.thinking')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-100">
                        <div className="flex gap-2 relative">
                            <Textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={t('aiSummary.chatPlaceholder')}
                                className="min-h-[40px] max-h-[120px] bg-slate-50 border-slate-200 resize-none text-sm pr-10 focus-visible:ring-primary/20"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <Button
                                size="icon"
                                className="absolute bottom-1 right-1 h-8 w-8 rounded-lg"
                                onClick={handleSend}
                                disabled={loading || !chatInput.trim()}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
