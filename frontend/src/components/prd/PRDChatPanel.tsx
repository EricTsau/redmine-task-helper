/**
 * PRDChatPanel - PRD AI 對話面板元件
 * 用於與 AI 討論 PRD 內容
 */
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import './PRDChatPanel.css';

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
        <div className="prd-chat-panel">
            {/* 對話區域 */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">💬</div>
                        <h3>開始討論 PRD</h3>
                        <p>與 AI 一起討論和完善您的產品需求文件</p>
                        <div className="chat-suggestions">
                            <button onClick={() => setInputValue('我想要建立一個新功能...')}>
                                🚀 描述新功能
                            </button>
                            <button onClick={() => setInputValue('幫我分析這個需求的可行性')}>
                                🔍 分析可行性
                            </button>
                            <button onClick={() => setInputValue('請幫我整理現有內容')}>
                                📝 整理內容
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                            >
                                <div className="message-avatar">
                                    {msg.role === 'user' ? '👤' : '🤖'}
                                </div>
                                <div className="message-content">
                                    <div className="message-text">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="chat-message assistant">
                                <div className="message-avatar">🤖</div>
                                <div className="message-content">
                                    <div className="message-text loading">
                                        <span className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* 輸入區域 */}
            <div className="chat-input-area">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="輸入訊息，與 AI 討論 PRD 內容..."
                    rows={2}
                    disabled={loading}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || loading}
                    className="send-button"
                >
                    {loading ? '發送中...' : '發送'}
                </button>
            </div>
        </div>
    );
};

export default PRDChatPanel;
