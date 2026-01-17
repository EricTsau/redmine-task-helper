import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import {
    Send,
    Loader2,
    FolderOpen,
    MessageSquare,
    CheckCircle2,
    Calendar,
    Clock,
    ListTodo,
    Sparkles,
    ChevronDown,
    RefreshCw
} from 'lucide-react';

interface Project {
    id: number;
    name: string;
    identifier: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Task {
    subject: string;
    estimated_hours: number;
    start_date: string;
    due_date: string;
    predecessors: number[];
}

interface ChatResponse {
    conversation_id: number;
    ai_message: string;
    tasks: Task[];
    project_context: { id: number; name: string };
}

export const AIPlannerPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [parentTaskSubject, setParentTaskSubject] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 載入專案列表
    useEffect(() => {
        fetchProjects();
    }, []);

    // 自動捲動到最新訊息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchProjects = async () => {
        setProjectsLoading(true);
        try {
            const res = await api.get<Project[]>('/projects');
            setProjects(res);
        } catch (e) {
            console.error('Failed to fetch projects', e);
        } finally {
            setProjectsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !selectedProject || loading) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const res = await api.post<ChatResponse>(
                `/pm-copilot/projects/${selectedProject.id}/prd-chat`,
                {
                    message: userMessage,
                    conversation_id: conversationId
                }
            );

            setConversationId(res.conversation_id);
            setMessages(prev => [...prev, { role: 'assistant', content: res.ai_message }]);

            if (res.tasks && res.tasks.length > 0) {
                setGeneratedTasks(res.tasks);
                // 自動設定 Parent Task Subject
                if (!parentTaskSubject && res.tasks.length > 0) {
                    setParentTaskSubject(`${selectedProject.name} - PRD 任務`);
                }
            }
        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `錯誤：${e.message || '無法連接到 AI 服務'}`
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTasks = async () => {
        if (!conversationId || generatedTasks.length === 0 || !selectedProject || generating) return;

        setGenerating(true);
        try {
            const res = await api.post<{ parent_issue_id: number; child_issue_ids: number[]; status: string }>(
                `/pm-copilot/projects/${selectedProject.id}/generate-tasks`,
                {
                    conversation_id: conversationId,
                    parent_task_subject: parentTaskSubject || `${selectedProject.name} - PRD 任務`,
                    tasks: generatedTasks
                }
            );

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ 任務已成功產生到 Redmine！\n\n**Parent Issue**: #${res.parent_issue_id}\n**子任務數量**: ${res.child_issue_ids.length} 個\n\n任務 ID: ${res.child_issue_ids.map(id => `#${id}`).join(', ')}`
            }]);
            setGeneratedTasks([]);
        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ 產生任務失敗：${e.message}`
            }]);
        } finally {
            setGenerating(false);
        }
    };

    const resetConversation = () => {
        setMessages([]);
        setGeneratedTasks([]);
        setConversationId(null);
        setParentTaskSubject('');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary" />
                        AI 專案規劃
                    </h1>
                    <p className="text-muted-foreground text-lg mt-1">
                        透過 AI 協助拆解 PRD，自動產生任務到 Redmine
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
                {/* 左側：專案選擇 + 對話 */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {/* 專案選擇器 */}
                    <div className="bg-card border rounded-xl p-4 shadow-sm">
                        <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                            選擇專案
                        </label>
                        <div className="relative">
                            <select
                                className="w-full h-12 px-4 pr-10 rounded-xl border bg-background appearance-none cursor-pointer font-medium focus:ring-2 focus:ring-primary outline-none"
                                value={selectedProject?.id || ''}
                                onChange={(e) => {
                                    const project = projects.find(p => p.id === parseInt(e.target.value));
                                    setSelectedProject(project || null);
                                    resetConversation();
                                }}
                                disabled={projectsLoading}
                            >
                                <option value="">-- 請選擇專案 --</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>

                    {/* 對話區域 */}
                    <div className="bg-card border rounded-xl flex-1 flex flex-col shadow-sm min-h-[400px]">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                PRD 對話
                            </h3>
                            {messages.length > 0 && (
                                <button
                                    onClick={resetConversation}
                                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    重新開始
                                </button>
                            )}
                        </div>

                        {/* 訊息列表 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {!selectedProject ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>請先選擇一個專案</p>
                                    </div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <div className="text-center max-w-md">
                                        <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary opacity-70" />
                                        <p className="font-medium mb-2">開始描述您的專案需求</p>
                                        <p className="text-sm opacity-70">
                                            例如：「我們要開發一個新登入頁面，需要兩週，包含 UI 設計和後端 API」
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">AI 思考中...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* 輸入區 */}
                        <div className="p-4 border-t">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 h-12 px-4 rounded-xl border bg-background focus:ring-2 focus:ring-primary outline-none"
                                    placeholder={selectedProject ? "描述您的需求..." : "請先選擇專案"}
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={!selectedProject || loading}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!selectedProject || loading || !inputMessage.trim()}
                                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右側：任務預覽 */}
                <div className="bg-card border rounded-xl flex flex-col shadow-sm">
                    <div className="p-4 border-b">
                        <h3 className="font-bold flex items-center gap-2">
                            <ListTodo className="h-5 w-5" />
                            任務預覽
                            {generatedTasks.length > 0 && (
                                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                    {generatedTasks.length} 個任務
                                </span>
                            )}
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {generatedTasks.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">尚未產生任務</p>
                                    <p className="text-xs opacity-70 mt-1">與 AI 對話後會顯示任務清單</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {generatedTasks.map((task, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 bg-muted/50 rounded-xl border hover:border-primary/30 transition-colors"
                                    >
                                        <div className="font-medium text-sm mb-2">{task.subject}</div>
                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1 bg-background px-2 py-1 rounded-md">
                                                <Clock className="h-3 w-3" />
                                                {task.estimated_hours}h
                                            </span>
                                            <span className="flex items-center gap-1 bg-background px-2 py-1 rounded-md">
                                                <Calendar className="h-3 w-3" />
                                                {task.start_date} → {task.due_date}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 產生任務按鈕 */}
                    {generatedTasks.length > 0 && (
                        <div className="p-4 border-t space-y-3">
                            <input
                                type="text"
                                className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Parent Task 名稱"
                                value={parentTaskSubject}
                                onChange={(e) => setParentTaskSubject(e.target.value)}
                            />
                            <button
                                onClick={handleGenerateTasks}
                                disabled={generating}
                                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        產生中...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        生成並儲存到 Redmine
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIPlannerPage;
