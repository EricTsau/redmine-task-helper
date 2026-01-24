/**
 * PRDChatPanel - PRD AI 對話面板元件
 * 用於與 AI 討論 PRD 內容
 */
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface PRDChatPanelProps {
    prdId: number;
    conversationHistory: Message[];
    onMessageSent: (messages: Message[], updatedContent: string) => void;
}

export const PRDChatPanel: React.FC<PRDChatPanelProps> = ({
    prdId,
    conversationHistory,
    onMessageSent,
}) => {
    const [messages, setMessages] = useState<Message[]>(conversationHistory);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 滾動到最新訊息
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 同步外部傳入的對話歷史
    useEffect(() => {
        setMessages(conversationHistory);
    }, [conversationHistory]);

    // 發送訊息
    const handleSend = async () => {
        if (!inputValue.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: inputValue.trim() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInputValue('');
        setLoading(true);

        try {
            const response = await api.post<{
                ai_message: string;
                updated_content: string;
            }>(`/prd/${prdId}/chat`, {
                message: inputValue.trim(),
            });

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.ai_message,
            };

            const finalMessages = [...updatedMessages, assistantMessage];
            setMessages(finalMessages);
            onMessageSent(finalMessages, response.updated_content);
        } catch (error) {
            console.error('發送訊息失敗:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: '抱歉，發生錯誤。請稍後再試。',
            };
            setMessages([...updatedMessages, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    // 處理鍵盤事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col bg-transparent">
            {/* 對話區域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                        <div className="p-4 bg-white/40 rounded-full border border-white/60 relative shadow-lg">
                            <div className="absolute inset-0 bg-tech-cyan/20 blur-xl rounded-full" />
                            <Sparkles className="w-8 h-8 text-tech-cyan relative" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold tracking-tight text-slate-800">開始討論 PRD</h3>
                            <p className="text-sm text-slate-500">與 AI 一起討論和完善您的產品需求文件</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                            <button
                                onClick={() => setInputValue('我想要建立一個新功能...')}
                                className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium hover:bg-slate-200 transition-colors"
                            >
                                🚀 描述新功能
                            </button>
                            <button
                                onClick={() => setInputValue('幫我分析這個需求的可行性')}
                                className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium hover:bg-slate-200 transition-colors"
                            >
                                🔍 分析可行性
                            </button>
                            <button
                                onClick={() => setInputValue('請幫我整理現有內容')}
                                className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium hover:bg-slate-200 transition-colors"
                            >
                                📝 整理內容
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'user'
                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                    : 'bg-white border-slate-200 text-tech-violet shadow-sm'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed border shadow-sm ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-sm'
                                    : 'bg-white border-slate-100 text-slate-700 rounded-tl-sm'
                                    }`}>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-tech-violet shadow-sm">
                                    <Bot size={14} />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5 shadow-sm">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* 輸入區域 */}
            <div className="p-4 border-t border-slate-200/50">
                <div className="relative flex items-end gap-2 bg-white border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all shadow-sm">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="輸入訊息..."
                        rows={1}
                        disabled={loading}
                        className="flex-1 bg-transparent border-none text-sm text-slate-700 focus:ring-0 resize-none max-h-32 py-2.5 px-2 custom-scrollbar placeholder:text-slate-400"
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || loading}
                        className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5 shadow-md shadow-primary/20"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PRDChatPanel;
