import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Loader2, Send, Bot, X, Copy, Check, Minimize2, Maximize2, GripVertical } from "lucide-react";

export type CopilotContextType = 'gitlab_dashboard' | 'task_workbench' | 'ai_summary';

interface AICopilotFloatingProps {
    contextType: CopilotContextType;
    getContextData: () => object;
    welcomeMessage?: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export function AICopilotFloating({ contextType, getContextData, welcomeMessage }: AICopilotFloatingProps) {
    const { t } = useTranslation();
    const { token } = useAuth();
    const { showError } = useToast();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);

    // Dragging state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const isClickValidRef = useRef(true);
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, isOpen]);

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Allow dragging from the button, but stop propagation for inner control buttons
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return;

        setIsDragging(true);
        isClickValidRef.current = true;
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y
        };
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragRef.current) return;
        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;

        // If moved more than 5 pixels, treat as drag, not click
        if (Math.hypot(deltaX, deltaY) > 5) {
            isClickValidRef.current = false;
        }

        // Invert because we use right/bottom positioning
        setPosition({
            x: dragRef.current.initialX - deltaX,
            y: dragRef.current.initialY - deltaY
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragRef.current = null;
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleSend = async () => {
        if (!chatInput.trim()) return;

        setLoading(true);
        const userMsg: ChatMessage = { role: "user", content: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput("");

        try {
            const contextData = getContextData();
            const res = await api.post<{ response: string }>(`/copilot/chat`, {
                context_type: contextType,
                message: userMsg.content,
                context_data: contextData,
                conversation_history: chatHistory
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const aiMsg: ChatMessage = { role: "assistant", content: res.response };
            setChatHistory(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            showError(t('copilot.requestFailed', 'AI 請求失敗'));
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
                title={t('common.copy', '複製')}
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        );
    };

    const getWelcomeText = () => {
        if (welcomeMessage) return welcomeMessage;
        switch (contextType) {
            case 'gitlab_dashboard':
                return t('copilot.welcomeGitlab', '詢問關於 GitLab 活動、KPI、commits 等問題');
            case 'task_workbench':
                return t('copilot.welcomeTask', '詢問關於任務狀態、進度、工作分配等問題');
            case 'ai_summary':
                return t('copilot.welcomeSummary', '詢問關於這份報告的問題');
            default:
                return t('copilot.welcomeDefault', '有什麼可以幫助您的？');
        }
    };

    if (!isOpen) {
        return (
            <div
                className={`fixed z-50 transition-transform ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    right: `${32 + position.x}px`,
                    bottom: `${32 + position.y}px`
                }}
                onMouseDown={handleMouseDown}
            >
                <Button
                    onClick={() => {
                        if (isClickValidRef.current) {
                            setIsOpen(true);
                        }
                    }}
                    className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-purple-600 hover:scale-110 transition-transform duration-300 border-4 border-white/10"
                >
                    <Bot className="w-8 h-8 text-white" />
                </Button>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`fixed z-50 flex flex-col bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${isMinimized ? 'w-72 h-14' : 'w-[450px] h-[600px] max-h-[80vh]'} ${isDragging ? 'cursor-grabbing' : ''}`}
            style={{
                right: `${32 + position.x}px`,
                bottom: `${32 + position.y}px`
            }}
        >
            {/* Header - Draggable */}
            <div
                className={`flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100 shrink-0 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-slate-700 font-bold pointer-events-none">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <Bot className="w-5 h-5 text-primary" />
                    <span>{t('copilot.title', 'AI 助手')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        data-no-drag
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                    >
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-red-100 hover:text-red-500"
                        data-no-drag
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    >
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
                                <p>{getWelcomeText()}</p>
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
                                                    img: ({ ...props }) => <img {...props} className="max-w-full rounded border border-slate-200 my-2" loading="lazy" />,
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
                                    <span className="text-xs text-slate-500">{t('copilot.thinking', '思考中...')}</span>
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
                                placeholder={t('copilot.placeholder', '輸入您的問題...')}
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
