import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle, Bot, X, Maximize2, Minimize2 } from 'lucide-react';
import { GanttChart } from '@/components/dashboard/GanttChart';
import ReactMarkdown from 'react-markdown';



interface ChatResponse {
    type: 'time_entry' | 'analysis' | 'chat';
    data?: any;
    summary?: string;
    intent_filter?: any;
}

import { useDraggable } from '@/hooks/useDraggable';
import { api } from '@/lib/api';

export function ChatBox() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Initial position near bottom right
    const { position, handleMouseDown } = useDraggable({
        initialPosition: {
            x: typeof window !== 'undefined' ? window.innerWidth - 100 : 1000,
            y: typeof window !== 'undefined' ? window.innerHeight - 100 : 800
        },
        storageKey: 'chat-box-position'
    });

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
            const settingsRes = await api.get<any>('/settings');

            const res = await api.post<ChatResponse>('/chat/message', {
                message: input,
                context: {
                    // TODO: Add screen context or selected task context here
                    current_view: "dashboard"
                }
            }, {
                headers: {
                    'X-OpenAI-Key': settingsRes.openai_key,
                    'X-OpenAI-URL': settingsRes.openai_url,
                    'X-OpenAI-Model': settingsRes.openai_model,
                    'X-Redmine-Url': settingsRes.redmine_url,
                    'X-Redmine-Key': settingsRes.redmine_token
                }
            });

            setChatState(res.data);

            // Auto-expand for analysis
            if (res.data.type === 'analysis') {
                setIsExpanded(true);
            }
            setInput('');
        } catch (e: any) {
            setError(e.message || 'Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmTimeEntry = async () => {
        if (!chatState || chatState.type !== 'time_entry' || !chatState.data?.issue_id) return;
        setIsLoading(true);
        try {
            const settingsRes = await api.get<any>('/settings');

            await api.post('/chat/submit-time-entry', {
                issue_id: chatState.data.issue_id,
                hours: chatState.data.hours,
                comments: chatState.data.comments,
                activity_id: 9
            }, {
                headers: {
                    'X-Redmine-Url': settingsRes.redmine_url,
                    'X-Redmine-Key': settingsRes.redmine_token
                }
            });

            setSuccessMsg('Logged successfully!');
            setChatState(null);
        } catch (e: any) {
            setError(e.message || 'Submission failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 flex items-center justify-center cursor-move"
                style={{ left: position.x, top: position.y }}
                onMouseDown={handleMouseDown}
            >
                <Bot className="h-6 w-6" />
            </button>
        );
    }

    // Correction: the closed button and the open window should probably share the position of "Bottom Right" corner concepts?
    // Or just top-left of the element.
    // If I use the same (x,y) for the Button as for the Window:
    // The button is small (60x60), the window is large (400x600).
    // If (x,y) is top-left:
    // Button at (1000, 800) -> OK.
    // Window at (1000, 800) -> The top-left of window is at button position. This effectively moves the window "down-right" relative to where it would 'grow' from normally.
    // Usually chat bubbles grow up-left from the trigger.
    // If we make it draggable, users usually drag the WINDOW.
    // When closed, where does the button go? To the same top-left?
    // Let's assume the user drags the "Component".
    // If I drag the window to (500, 500), then close it. The button appears at (500, 500).
    // This seems acceptable.

    const widthClass = isExpanded ? 'w-[800px]' : 'w-96';

    return (
        <div
            className={`fixed ${widthClass} z-50 animate-in slide-in-from-bottom-10 fade-in duration-200 transition-all`}
            style={{ left: position.x, top: position.y }}
        >
            <div className="bg-card border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div
                    className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground cursor-move"
                    onMouseDown={handleMouseDown}
                >
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
