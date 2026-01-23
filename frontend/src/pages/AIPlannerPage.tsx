import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PRDEditor } from '@/components/prd/PRDEditor';
import { PRDChatPanel } from '@/components/prd/PRDChatPanel';
import { TaskListView } from '@/components/planner/TaskListView';
import { GanttEditor } from '@/components/planner/GanttEditor';
import {
    FileText,
    Plus,
    Trash2,
    CalendarRange,
    Layout,
    Settings,
    ListTodo
} from 'lucide-react';
import { ProjectSelectModal } from '@/components/planner/ProjectSelectModal';
import './AIPlannerPage.css';

// ============ Interfaces ============

interface PRDDocument {
    id: number;
    title: string;
    project_id: number | null;
    project_name: string | null;
    content: string;
    conversation_history: string; // JSON string
    status: string;
}

interface PRDListItem {
    id: number;
    title: string;
    project_id: number | null;
    project_name: string | null;
    status: string;
}

interface PlanningProject {
    id: number;
    name: string;
    prd_document_id: number | null;
    redmine_project_id: number | null;
    redmine_project_name?: string | null;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// ============ Component ============

export const AIPlannerPage: React.FC = () => {
    const { showSuccess, showError } = useToast();

    // Sidebar State
    const [prdList, setPrdList] = useState<PRDListItem[]>([]);
    const [currentPRD, setCurrentPRD] = useState<PRDDocument | null>(null);
    const [showNewPRDDialog, setShowNewPRDDialog] = useState(false);
    const [newPRDTitle, setNewPRDTitle] = useState('');

    // Project State
    const [planningProject, setPlanningProject] = useState<PlanningProject | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState<'prd' | 'tasks' | 'gantt'>('prd');
    const [loadingPRD, setLoadingPRD] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);

    // Data Synchronization
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataChange = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    // Initial Load
    useEffect(() => {
        fetchPRDList();
    }, []);

    // When PRD changes, fetch its Planning Project
    useEffect(() => {
        if (currentPRD) {
            fetchPlanningProject(currentPRD.id);
        } else {
            setPlanningProject(null);
        }
    }, [currentPRD?.id]);

    // ============ API Calls ============

    const fetchPRDList = async () => {
        try {
            const res = await api.get<PRDListItem[]>('/prd');
            setPrdList(res);
        } catch (error) {
            console.error('Failed to fetch PRD list:', error);
        }
    };

    const fetchPRD = async (id: number) => {
        setLoadingPRD(true);
        try {
            const res = await api.get<PRDDocument>(`/prd/${id}`);
            setCurrentPRD(res);
            // Reset tab to PRD when switching documents? Or keep?
            // Keep active tab is usually better UX, but if switching context, maybe PRD is safer.
            // Let's keep active tab unless it's Gantt/Tasks and no project exists.
        } catch (error) {
            console.error('Failed to fetch PRD:', error);
        } finally {
            setLoadingPRD(false);
        }
    };

    const fetchPlanningProject = async (prdId: number) => {
        try {
            const res = await api.get<PlanningProject[]>(`/planning/projects?prd_document_id=${prdId}`);
            if (res.length > 0) {
                setPlanningProject(res[0]); // Use the most recent one
            } else {
                setPlanningProject(null);
            }
        } catch (error) {
            console.error('Failed to fetch planning project:', error);
            setPlanningProject(null);
        }
    };

    const createPRD = async () => {
        if (!newPRDTitle.trim()) return;
        try {
            const res = await api.post<PRDDocument>('/prd', { title: newPRDTitle.trim() });
            setPrdList([res, ...prdList]);
            setCurrentPRD(res);
            setShowNewPRDDialog(false);
            setNewPRDTitle('');
        } catch (error) {
            console.error('Failed to create PRD:', error);
        }
    };

    const deletePRD = async (id: number) => {
        if (!confirm('確定要刪除此 PRD 嗎？相關的規劃專案可能也會受到影響。')) return;
        try {
            await api.delete(`/prd/${id}`);
            setPrdList(prdList.filter(p => p.id !== id));
            if (currentPRD?.id === id) {
                setCurrentPRD(null);
                setPlanningProject(null);
            }
        } catch (error) {
            console.error('Failed to delete PRD:', error);
        }
    };

    const createPlanningProject = async () => {
        if (!currentPRD) return;
        if (!confirm(`確定要為 "${currentPRD.title}" 建立規劃專案嗎？`)) return;

        try {
            const res = await api.post<PlanningProject>('/planning/projects', {
                name: currentPRD.title,
                prd_document_id: currentPRD.id
            });
            setPlanningProject(res);
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
            // Switch to tasks tab to show progression
            setActiveTab('tasks');
        } catch (error) {
            console.error('Failed to create planning project:', error);
        }
    };

    // ============ Handlers ============

    const handlePRDContentChange = (content: string) => {
        if (currentPRD) {
            setCurrentPRD({ ...currentPRD, content });
        }
    };

    const handlePRDSave = async () => {
        if (currentPRD) {
            await api.put(`/prd/${currentPRD.id}`, { content: currentPRD.content });
            fetchPRDList(); // Refresh list to update timestamps or snippets if we had them
        }
    };

    const handleMessageSent = (messages: Message[], updatedContent: string) => {
        if (currentPRD) {
            setCurrentPRD({
                ...currentPRD,
                content: updatedContent,
                conversation_history: JSON.stringify(messages),
            });
        }
    };

    const getConversationHistory = (): Message[] => {
        if (!currentPRD) return [];
        try {
            return JSON.parse(currentPRD.conversation_history);
        } catch {
            return [];
        }
    };

    const handleSetRedmineProject = async (redmineProjectId: number, name: string) => {
        if (!planningProject) return;
        try {
            await api.put(`/planning/projects/${planningProject.id}`, {
                redmine_project_id: redmineProjectId,
                redmine_project_name: name
            });
            // Update local state
            setPlanningProject(prev => prev ? ({ ...prev, redmine_project_id: redmineProjectId, redmine_project_name: name }) : null);
            setRefreshTrigger(prev => prev + 1); // Trigger data refresh
            setShowProjectModal(false);
            showSuccess(`已將預設專案設為: ${name}`);
        } catch (e) {
            console.error(e);
            showError('設定失敗');
        }
    };

    // ============ Render ============

    return (
        <div className="planner-page animate-in fade-in duration-700">
            {/* Sidebar */}
            <div className={`planner-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    {!sidebarCollapsed && <h2 className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">Redmine AI</h2>}
                    <button
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? "展開側邊欄" : "收起側邊欄"}
                    >
                        <Layout size={18} />
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <div className="sidebar-actions">
                        <button className="new-prd-btn" onClick={() => setShowNewPRDDialog(true)}>
                            <Plus size={18} />
                            <span>CREATE NEW PRD</span>
                        </button>
                    </div>
                )}

                <div className="sidebar-list custom-scrollbar">
                    {prdList.map(prd => (
                        <div
                            key={prd.id}
                            className={`sidebar-item group ${currentPRD?.id === prd.id ? 'active' : ''}`}
                            onClick={() => fetchPRD(prd.id)}
                            title={prd.title}
                        >
                            <FileText size={18} className={currentPRD?.id === prd.id ? 'text-tech-cyan' : ''} />
                            {!sidebarCollapsed && (
                                <>
                                    <span className="item-title">{prd.title}</span>
                                    <button
                                        className="delete-item-btn"
                                        onClick={(e) => { e.stopPropagation(); deletePRD(prd.id); }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="planner-main">
                {!currentPRD ? (
                    <div className="empty-state animate-in fade-in zoom-in-95 duration-500">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                            <FileText size={80} className="relative text-muted-foreground/30" />
                        </div>
                        <h3 className="tracking-tight">Strategic Planning Studio</h3>
                        <p className="text-muted-foreground max-w-sm font-medium mt-2">
                            Select an existing Product Requirement Document or initialize a new one to begin AI-powered planning.
                        </p>
                        <button className="primary-btn mt-8 flex items-center gap-2" onClick={() => setShowNewPRDDialog(true)}>
                            <Plus size={18} />
                            <span>INITIALIZE WORKSPACE</span>
                        </button>
                    </div>
                ) : loadingPRD ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-glow" />
                        <span className="text-xs font-black tracking-widest text-muted-foreground uppercase">Syncing Neural Data...</span>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="planner-header">
                            <div className="header-info min-w-0">
                                <h1 className="truncate">{currentPRD.title}</h1>
                                <span className={`status-badge`}>{currentPRD.status}</span>

                                {planningProject && (
                                    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 ml-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-tech-cyan animate-pulse shadow-glow-cyan" />
                                            <span className="text-[10px] font-black tracking-wider text-tech-cyan uppercase">Project Link</span>
                                        </div>
                                        <div className="h-4 w-px bg-white/10" />
                                        {planningProject.redmine_project_id ? (
                                            <button
                                                className="text-xs font-bold text-foreground hover:text-tech-cyan transition-colors"
                                                onClick={() => setShowProjectModal(true)}
                                            >
                                                {planningProject.redmine_project_name || `#${planningProject.redmine_project_id}`}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowProjectModal(true)}
                                                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <Settings className="w-3 h-3" />
                                                <span>Configure Target</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="header-tabs">
                                {[
                                    { id: 'prd', icon: FileText, label: 'PRD Workspace' },
                                    { id: 'tasks', icon: ListTodo, label: 'Task Matrix' },
                                    { id: 'gantt', icon: CalendarRange, label: 'Timeline' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id as any)}
                                    >
                                        <tab.icon size={16} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="planner-content">
                            {/* PRD Tab */}
                            <div className={`tab-pane ${activeTab === 'prd' ? 'active' : ''}`}>
                                <div className="prd-split-view">
                                    <div className="prd-chat-section">
                                        <PRDChatPanel
                                            prdId={currentPRD.id}
                                            conversationHistory={getConversationHistory()}
                                            onMessageSent={handleMessageSent}
                                        />
                                    </div>
                                    <div className="prd-editor-section custom-scrollbar">
                                        <div className="max-w-4xl mx-auto glass-card rounded-3xl p-1 border-border/20">
                                            <PRDEditor
                                                prdId={currentPRD.id}
                                                content={currentPRD.content}
                                                onContentChange={handlePRDContentChange}
                                                onSave={handlePRDSave}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tasks Tab */}
                            <div className={`tab-pane ${activeTab === 'tasks' ? 'active' : ''}`}>
                                {planningProject ? (
                                    <div className="p-8 max-w-5xl mx-auto w-full">
                                        <div className="glass-card rounded-3xl border-border/20 overflow-hidden min-h-[600px]">
                                            <TaskListView
                                                projectId={planningProject.id}
                                                refreshTrigger={refreshTrigger}
                                                onDataChange={handleDataChange}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="project-not-found space-y-6">
                                        <div className="p-6 bg-white/5 rounded-full border border-white/10">
                                            <ListTodo size={40} className="text-muted-foreground/40" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3>PLANNING MODULE UNINITIALIZED</h3>
                                            <p className="text-muted-foreground max-w-xs font-medium">
                                                Convert your requirements into an actionable planning project to begin task generation.
                                            </p>
                                        </div>
                                        <button className="primary-btn flex items-center gap-2" onClick={createPlanningProject}>
                                            <Plus size={18} />
                                            <span>GENERATE PROJECT</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Gantt Tab */}
                            <div className={`tab-pane ${activeTab === 'gantt' ? 'active' : ''}`}>
                                {planningProject ? (
                                    <div className="h-full w-full p-4">
                                        <div className="glass-card rounded-2xl border-border/20 h-full overflow-hidden">
                                            <GanttEditor
                                                planningProjectId={planningProject.id}
                                                refreshTrigger={refreshTrigger}
                                                onDataChange={handleDataChange}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="project-not-found space-y-6">
                                        <div className="p-6 bg-white/5 rounded-full border border-white/10">
                                            <CalendarRange size={40} className="text-muted-foreground/40" />
                                        </div>
                                        <button className="primary-btn" onClick={createPlanningProject}>
                                            INITIALIZE GANTT
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* New PRD Dialog */}
            {showNewPRDDialog && (
                <div className="modal-overlay" onClick={() => setShowNewPRDDialog(false)}>
                    <div className="modal-content animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <h3>INITIALIZE NEW PRD</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Document Title</label>
                                <input
                                    type="text"
                                    placeholder="Enter strategic title..."
                                    value={newPRDTitle}
                                    onChange={e => setNewPRDTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createPRD()}
                                    autoFocus
                                    className="w-full"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button className="cancel-btn flex-1" onClick={() => setShowNewPRDDialog(false)}>ABORT</button>
                                <button className="primary-btn flex-1" onClick={createPRD}>CREATE</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Select Modal */}
            {showProjectModal && (
                <ProjectSelectModal
                    isOpen={showProjectModal}
                    onClose={() => setShowProjectModal(false)}
                    onSelect={handleSetRedmineProject}
                    currentProjectId={planningProject?.redmine_project_id}
                />
            )}
        </div>
    );
}

export default AIPlannerPage;
