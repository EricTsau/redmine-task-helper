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
    ListTodo,
    Loader2
} from 'lucide-react';
import { ProjectSelectModal } from '@/components/planner/ProjectSelectModal';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();

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
        if (!confirm(t('aiPlanner.confirmDeletePRD'))) return;
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
        if (!confirm(t('aiPlanner.confirmCreateProject', { title: currentPRD.title }))) return;

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
            showSuccess(t('aiPlanner.projectSet', { name }));
        } catch (e) {
            console.error(e);
            showError(t('aiPlanner.settingFailed'));
        }
    };

    // ============ Render ============

    return (
        <div className="h-full flex overflow-hidden animate-in fade-in duration-700 space-x-6 pb-4">
            {/* Sidebar */}
            <div className={`rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl flex flex-col transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'w-[80px]' : 'w-[280px]'} relative overflow-hidden shadow-sm`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tech-cyan via-primary to-tech-violet opacity-60" />

                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-200/50 flex items-center justify-between shrink-0 h-[88px]">
                    {!sidebarCollapsed && (
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 truncate">
                            {t('aiPlanner.title')}
                        </h2>
                    )}
                    <button
                        className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800 active:scale-95 ml-auto"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? t('aiPlanner.expandSidebar') : t('aiPlanner.collapseSidebar')}
                    >
                        <Layout size={18} />
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <div className="p-4 shrink-0">
                        <button
                            className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-tech-cyan to-tech-indigo text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-tech-cyan/20 active:scale-95 transition-all hover:brightness-105"
                            onClick={() => setShowNewPRDDialog(true)}
                        >
                            <Plus size={16} />
                            <span>{t('aiPlanner.createNewPRD')}</span>
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {prdList.map(prd => (
                        <div
                            key={prd.id}
                            className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${currentPRD?.id === prd.id
                                ? 'bg-primary/10 border-primary/20 text-primary-foreground'
                                : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900 hover:border-slate-200/60'
                                }`}
                            onClick={() => fetchPRD(prd.id)}
                            title={prd.title}
                        >
                            <FileText size={18} className={`shrink-0 ${currentPRD?.id === prd.id ? 'text-primary animate-pulse' : 'text-slate-400 group-hover:text-primary/70'}`} />
                            {!sidebarCollapsed && (
                                <>
                                    <span className={`text-xs font-bold truncate flex-1 ${currentPRD?.id === prd.id ? 'text-primary' : ''}`}>{prd.title}</span>
                                    <button
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
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
            <div className="flex-1 flex flex-col min-w-0 rounded-[32px] border border-white/40 bg-white/60 backdrop-blur-xl relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tech-cyan via-tech-purple to-tech-rose opacity-40" />

                {!currentPRD ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-8 animate-in fade-in zoom-in-95 duration-700">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full" />
                            <div className="p-8 bg-white/40 backdrop-blur-md rounded-full border border-white/60 relative shadow-xl">
                                <FileText size={64} className="text-slate-300" />
                            </div>
                        </div>
                        <div className="space-y-3 max-w-md">
                            <h3 className="text-2xl font-black tracking-tight text-slate-800">{t('aiPlanner.emptyStateTitle')}</h3>
                            <p className="text-slate-500 font-medium text-sm leading-relaxed">
                                {t('aiPlanner.emptyStateDescription')}
                            </p>
                        </div>
                        <button
                            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-105 shadow-sm"
                            onClick={() => setShowNewPRDDialog(true)}
                        >
                            <Plus size={16} />
                            <span>{t('aiPlanner.initializeWorkspace')}</span>
                        </button>
                    </div>
                ) : loadingPRD ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-tech-cyan/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="h-10 w-10 animate-spin text-tech-cyan relative" />
                        </div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">{t('aiPlanner.syncingData')}</span>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="h-20 shrink-0 border-b border-slate-200/50 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md">
                            <div className="flex items-center gap-6 min-w-0 flex-1">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-xl font-black tracking-tight truncate text-slate-800">{currentPRD.title}</h1>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200`}>{currentPRD.status}</span>
                                    </div>

                                    {planningProject ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-tech-cyan animate-pulse" />
                                            <span className="text-[10px] font-bold text-tech-cyan uppercase tracking-wider">{t('aiPlanner.projectLink')}</span>
                                            <span className="text-[10px] text-slate-300">•</span>
                                            {planningProject.redmine_project_id ? (
                                                <button
                                                    className="text-[10px] font-bold text-slate-500 hover:text-primary transition-colors flex items-center gap-1 group"
                                                    onClick={() => setShowProjectModal(true)}
                                                >
                                                    {planningProject.redmine_project_name || `#${planningProject.redmine_project_id}`}
                                                    <Settings className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setShowProjectModal(true)}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors"
                                                >
                                                    <span>{t('aiPlanner.configureTarget')}</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex p-1 bg-slate-100/50 rounded-xl border border-white/40 backdrop-blur-sm">
                                {[
                                    { id: 'prd', icon: FileText, label: t('aiPlanner.prdWorkspace') },
                                    { id: 'tasks', icon: ListTodo, label: t('aiPlanner.taskMatrix') },
                                    { id: 'gantt', icon: CalendarRange, label: t('aiPlanner.timeline') },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                            ? 'bg-white text-primary shadow-sm border border-slate-200/50'
                                            : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
                                            }`}
                                        onClick={() => setActiveTab(tab.id as any)}
                                    >
                                        <tab.icon size={14} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area with Scrollbar */}
                        <div className="flex-1 overflow-hidden relative bg-slate-50/30">
                            {/* PRD Tab */}
                            <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'prd' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="h-full flex overflow-hidden">
                                    <div className="w-[360px] border-r border-slate-200/50 flex flex-col bg-white/20 backdrop-blur-sm">
                                        <PRDChatPanel
                                            prdId={currentPRD.id}
                                            conversationHistory={getConversationHistory()}
                                            onMessageSent={handleMessageSent}
                                        />
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                        <div className="max-w-4xl mx-auto space-y-6">
                                            <div className="glass-card bg-white/70 border-white/60 rounded-2xl p-1 shadow-sm">
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
                            </div>

                            {/* Tasks Tab */}
                            <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'tasks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="h-full overflow-y-auto custom-scrollbar p-6">
                                    {planningProject ? (
                                        <div className="max-w-5xl mx-auto">
                                            <div className="glass-card bg-white/70 border-white/60 rounded-2xl overflow-hidden min-h-[600px] shadow-sm">
                                                <TaskListView
                                                    projectId={planningProject.id}
                                                    refreshTrigger={refreshTrigger}
                                                    onDataChange={handleDataChange}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center space-y-6">
                                            <div className="p-6 bg-white/40 rounded-full border border-white/60 shadow-lg">
                                                <ListTodo size={40} className="text-slate-300" />
                                            </div>
                                            <div className="space-y-2 text-center">
                                                <h3 className="text-xl font-bold text-slate-800">{t('aiPlanner.planningModuleUninitialized')}</h3>
                                                <p className="text-slate-500 max-w-xs font-medium text-sm">
                                                    {t('aiPlanner.planningModuleDescription')}
                                                </p>
                                            </div>
                                            <button
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
                                                onClick={createPlanningProject}
                                            >
                                                <Plus size={16} />
                                                <span>{t('aiPlanner.generateProject')}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Gantt Tab */}
                            <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'gantt' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="h-full p-4">
                                    {planningProject ? (
                                        <div className="glass-card bg-white/70 border-white/60 rounded-2xl h-full overflow-hidden shadow-sm">
                                            <GanttEditor
                                                planningProjectId={planningProject.id}
                                                refreshTrigger={refreshTrigger}
                                                onDataChange={handleDataChange}
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center space-y-6">
                                            <div className="p-6 bg-white/40 rounded-full border border-white/60 shadow-lg">
                                                <CalendarRange size={40} className="text-slate-300" />
                                            </div>
                                            <button
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
                                                onClick={createPlanningProject}
                                            >
                                                {t('aiPlanner.initializeGantt')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* New PRD Dialog */}
            {showNewPRDDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200" onClick={() => setShowNewPRDDialog(false)}>
                    <div
                        className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-black tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">{t('aiPlanner.initializeNewPRD')}</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('aiPlanner.documentTitle')}</label>
                                <input
                                    type="text"
                                    placeholder={t('aiPlanner.enterTitle')}
                                    value={newPRDTitle}
                                    onChange={e => setNewPRDTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createPRD()}
                                    autoFocus
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-slate-300"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    className="flex-1 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                    onClick={() => setShowNewPRDDialog(false)}
                                >
                                    {t('aiPlanner.abort')}
                                </button>
                                <button
                                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-tech-cyan to-tech-indigo text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-tech-cyan/20 hover:brightness-110 transition-all"
                                    onClick={createPRD}
                                >
                                    {t('aiPlanner.create')}
                                </button>
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
