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
        <div className="planner-page">
            {/* Sidebar */}
            <div className={`planner-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    {!sidebarCollapsed && <h2>AI 專案規劃</h2>}
                    <button
                        className="icon-btn"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? "展開側邊欄" : "收起側邊欄"}
                    >
                        <Layout size={18} />
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <div className="sidebar-actions">
                        <button className="new-prd-btn" onClick={() => setShowNewPRDDialog(true)}>
                            <Plus size={16} />
                            新 PRD
                        </button>
                    </div>
                )}

                <div className="sidebar-list">
                    {prdList.map(prd => (
                        <div
                            key={prd.id}
                            className={`sidebar-item ${currentPRD?.id === prd.id ? 'active' : ''}`}
                            onClick={() => fetchPRD(prd.id)}
                            title={prd.title}
                        >
                            <FileText size={16} />
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
                    <div className="empty-state">
                        <FileText size={48} className="text-gray-300 mb-4" />
                        <h3>請選擇或建立 PRD 文件</h3>
                        <button className="primary-btn mt-4" onClick={() => setShowNewPRDDialog(true)}>
                            建立新 PRD
                        </button>
                    </div>
                ) : loadingPRD ? (
                    <div className="loading">載入中...</div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="planner-header">
                            <div className="header-info">
                                <h1>{currentPRD.title}</h1>
                                <span className={`status-badge ${currentPRD.status}`}>{currentPRD.status}</span>
                                {planningProject && (
                                    <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded ml-4">
                                        <span className="font-medium opacity-75">PLAN: {planningProject.name}</span>
                                        <span className="text-gray-300">|</span>
                                        {planningProject.redmine_project_id ? (
                                            <button
                                                className="hover:underline font-medium flex items-center gap-1"
                                                onClick={() => setShowProjectModal(true)}
                                                title={planningProject.redmine_project_name || `Redmine #${planningProject.redmine_project_id}`}
                                            >
                                                {planningProject.redmine_project_name || '(未命名專案)'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowProjectModal(true)}
                                                className="flex items-center gap-1 hover:underline text-blue-600"
                                            >
                                                <Settings className="w-3 h-3" />
                                                <span>設定 Redmine</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="header-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'prd' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('prd')}
                                >
                                    <FileText size={16} />
                                    PRD 工作區
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('tasks')}
                                >
                                    <ListTodo size={16} />
                                    任務清單
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'gantt' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('gantt')}
                                >
                                    <CalendarRange size={16} />
                                    甘特圖
                                </button>
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
                                    <div className="prd-editor-section">
                                        <PRDEditor
                                            prdId={currentPRD.id}
                                            content={currentPRD.content}
                                            onContentChange={handlePRDContentChange}
                                            onSave={handlePRDSave}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tasks Tab */}
                            <div className={`tab-pane ${activeTab === 'tasks' ? 'active' : ''}`}>
                                {planningProject ? (
                                    <TaskListView
                                        projectId={planningProject.id}
                                        refreshTrigger={refreshTrigger}
                                        onDataChange={handleDataChange}
                                    />
                                ) : (
                                    <div className="project-not-found">
                                        <h3>尚未建立規劃專案</h3>
                                        <p>您需要先為此 PRD 建立規劃專案，才能開始生成和管理任務。</p>
                                        <button className="primary-btn mt-4" onClick={createPlanningProject}>
                                            初始化規劃專案
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Gantt Tab */}
                            <div className={`tab-pane ${activeTab === 'gantt' ? 'active' : ''}`}>
                                {planningProject ? (
                                    <div className="h-full w-full">
                                        <GanttEditor
                                            planningProjectId={planningProject.id}
                                            refreshTrigger={refreshTrigger}
                                            onDataChange={handleDataChange}
                                        />
                                    </div>
                                ) : (
                                    <div className="project-not-found">
                                        <h3>尚未建立規劃專案</h3>
                                        <button className="primary-btn mt-4" onClick={createPlanningProject}>
                                            初始化規劃專案
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
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>建立新 PRD</h3>
                        <input
                            type="text"
                            placeholder="輸入 PRD 標題..."
                            value={newPRDTitle}
                            onChange={e => setNewPRDTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createPRD()}
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowNewPRDDialog(false)}>取消</button>
                            <button className="primary-btn" onClick={createPRD}>建立</button>
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
};

export default AIPlannerPage;
