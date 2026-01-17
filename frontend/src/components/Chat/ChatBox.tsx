import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle, Bot, X, Maximize2, Minimize2 } from 'lucide-react';
import { GanttChart } from '@/components/dashboard/GanttChart';
import ReactMarkdown from 'react-markdown';

interface TimeEntryExtraction {
    issue_id: number | null;
    project_name: string | null;
    hours: number;
    activity_name: string;
    comments: string;
    confidence_score: number;
}

interface ChatResponse {
    type: 'time_entry' | 'analysis' | 'chat';
    data?: any;
    summary?: string;
    intent_filter?: any;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function ChatBox() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [chatState, setChatState] = useState<ChatResponse | null>(null);
    const [successMsg, setSuccessMsg] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (chatState) scrollToBottom();
    }, [chatState]);

    const handleSend = async () => {
        if (!input.trim()) return;
        setIsLoading(true);
        setError('');
        setChatState(null);
        setSuccessMsg('');

        try {
            const openaiKey = localStorage.getItem('openai_api_key');
            const redmineKey = localStorage.getItem('redmine_api_key');

            if (!openaiKey) throw new Error('OpenAI Key missing');
            if (!redmineKey) throw new Error('Redmine Key missing');

            const settingsRes = await fetch(`${API_BASE}/settings`);
            const settingsData = await settingsRes.json();

            const res = await fetch(`${API_BASE}/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-OpenAI-Key': openaiKey,
                    'X-OpenAI-URL': settingsData.openai_url || 'https://api.openai.com/v1',
                    'X-OpenAI-Model': settingsData.openai_model || 'gpt-4o-mini',
                    'X-Redmine-Url': settingsData.redmine_url,
                    'X-Redmine-Key': redmineKey
                },
                body: JSON.stringify({ message: input })
            });

            if (!res.ok) throw new Error('Failed to send message');

            const data: ChatResponse = await res.json();
            setChatState(data);

            // Auto-expand for analysis
            if (data.type === 'analysis') {
                setIsExpanded(true);
            }
            setInput('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const confirmTimeEntry = async () => {
        if (!chatState || chatState.type !== 'time_entry' || !chatState.data?.issue_id) return;
        setIsLoading(true);
        try {
            const redmineKey = localStorage.getItem('redmine_api_key');
            const settingsRes = await fetch(`${API_BASE}/settings`);
            const settingsData = await settingsRes.json();

            const res = await fetch(`${API_BASE}/chat/submit-time-entry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Redmine-Url': settingsData.redmine_url,
                    'X-Redmine-Key': redmineKey || ''
                },
                body: JSON.stringify({
                    issue_id: chatState.data.issue_id,
                    hours: chatState.data.hours,
                    comments: chatState.data.comments,
                    activity_id: 9
                })
            });

            if (!res.ok) throw new Error('Submission failed');
            setSuccessMsg('Logged successfully!');
            setChatState(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 flex items-center justify-center"
            >
                <Bot className="h-6 w-6" />
            </button>
        );
    }

    const widthClass = isExpanded ? 'w-[800px]' : 'w-96';

    return (
        <div className={`fixed bottom-6 right-6 ${widthClass} z-50 animate-in slide-in-from-bottom-10 fade-in duration-200 transition-all`}>
            <div className="bg-card border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        AI Assistant
                    </h3>
                    <div className="flex gap-1">
                        <button onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-primary/80 p-1 rounded">
                            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-primary/80 p-1 rounded">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 bg-background overflow-y-auto min-h-[300px] flex-1">
                    {/* Welcome / Empty State */}
                    {!chatState && !successMsg && !isLoading && (
                        <div className="text-center text-muted-foreground py-8 space-y-2">
                            <p>👋 How can I help?</p>
                            <p className="text-xs">"Log 2h on #1234"</p>
                            <p className="text-xs">"Show open bugs in Project X"</p>
                        </div>
                    )}

                    {/* Messages */}
                    {chatState && (
                        <div className="space-y-4">
                            {/* User Input Mirror (Optional, omitted for simplicity to focus on bot response) */}

                            {/* Bot Response */}
                            <div className="flex gap-3">
                                <div className="p-2 bg-primary/10 rounded-full h-fit">
                                    <Bot className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    {/* Text Summary */}
                                    {chatState.summary && (
                                        <div className="prose prose-sm dark:prose-invert bg-muted p-3 rounded-lg">
                                            <ReactMarkdown>{chatState.summary}</ReactMarkdown>
                                        </div>
                                    )}

                                    {/* Time Entry Confirmation */}
                                    {chatState.type === 'time_entry' && chatState.data && (
                                        <div className="border rounded-md p-3 space-y-2 bg-card">
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div><span className="text-muted-foreground">Issue:</span> #{chatState.data.issue_id}</div>
                                                <div><span className="text-muted-foreground">Hours:</span> {chatState.data.hours}h</div>
                                                <div className="col-span-2"><span className="text-muted-foreground">Comment:</span> {chatState.data.comments}</div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <button onClick={() => setChatState(null)} className="px-3 py-1 text-xs border rounded">Cancel</button>
                                                <button onClick={confirmTimeEntry} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded">Confirm Log</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Analysis Chart */}
                                    {chatState.type === 'analysis' && chatState.data && (
                                        <div className="border rounded-md p-2 bg-card overflow-hidden">
                                            <GanttChart tasks={chatState.data} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 mb-4 text-sm text-green-600 bg-green-50 rounded-md flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            {successMsg}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-muted/30 flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                        autoFocus
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="h-10 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[3rem]"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
