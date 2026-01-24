import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Lock, Loader2, Server, Edit2, X, Users, Box, Check, TestTube } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';


interface GitLabInstance {
    id: number;
    instance_name: string;
    url: string;
    personal_access_token: string;
    target_users_json: string;
    target_projects_json: string;
}

interface GitLabWatchlist {
    id: number;
    instance_id: number;
    gitlab_project_id: number;
    project_name: string;
    project_path_with_namespace: string;
    is_included: boolean;
}

interface GitLabUser {
    id: number;
    username: string;
    name: string;
    state: string;
}

interface GitLabProject {
    id: number;
    name: string;
    path_with_namespace: string;
    description: string | null;
}

const GitLabSettings: React.FC = () => {
    const { token } = useAuth();
    const { showError, showSuccess } = useToast();

    // Instances state
    const [instances, setInstances] = useState<GitLabInstance[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Watchlist state
    const [watchlists, setWatchlists] = useState<GitLabWatchlist[]>([]);
    const [fetchingWatchlist, setFetchingWatchlist] = useState(false);

    const [formData, setFormData] = useState({
        instance_name: '',
        url: '',
        personal_access_token: '',
        target_users_json: '[]',
        target_projects_json: '[]'
    });
    
    // Step 1: GitLab connection setup
    const [step, setStep] = useState(1); // 1 for connection setup, 2 for watchlist selection
    const [connectionTested, setConnectionTested] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    
    // Step 2: GitLab users and projects selection
    const [gitlabUsers, setGitlabUsers] = useState<GitLabUser[]>([]);
    const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
    const [fetchingUsers, setFetchingUsers] = useState(false);
    const [fetchingProjects, setFetchingProjects] = useState(false);
    const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null);
    
    // Search filters
    const [userSearch, setUserSearch] = useState('');
    const [projectSearch, setProjectSearch] = useState('');

    useEffect(() => {
        if (token) {
            fetchInstances();
            fetchWatchlist();
        }
    }, [token]);

    const fetchInstances = async () => {
        setFetching(true);
        try {
            const data = await api.get<GitLabInstance[]>('/gitlab/instances');
            setInstances(data);
        } catch (error) {
            showError('Failed to fetch GitLab instances');
        } finally { setFetching(false); }
    };

    const fetchGitLabUsersAndProjects = async () => {
        setFetchingUsers(true);
        setFetchingProjects(true);
        try {
            const response = await api.post<{
                users: GitLabUser[];
                projects: GitLabProject[];
            }>('/gitlab/fetch-users-projects', {
                url: formData.url,
                personal_access_token: formData.personal_access_token
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setGitlabUsers(response.users);
            setGitlabProjects(response.projects);
        } catch (error) {
            showError('Failed to fetch GitLab users and projects');
        } finally {
            setFetchingUsers(false);
            setFetchingProjects(false);
        }
    };

    const fetchGitLabUsers = async (instanceId: number) => {
        setFetchingUsers(true);
        try {
            const data = await api.get<GitLabUser[]>(`/gitlab/users?instance_id=${instanceId}`, undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGitlabUsers(data);
        } catch (error) {
            showError('Failed to fetch GitLab users');
        } finally { setFetchingUsers(false); }
    };

    const fetchGitLabProjects = async (instanceId: number) => {
        setFetchingProjects(true);
        try {
            const data = await api.get<GitLabProject[]>(`/gitlab/projects?instance_id=${instanceId}`, undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGitlabProjects(data);
        } catch (error) {
            showError('Failed to fetch GitLab projects');
        } finally { setFetchingProjects(false); }
    };

    const fetchWatchlist = async () => {
        setFetchingWatchlist(true);
        try {
            const data = await api.get<GitLabWatchlist[]>('/gitlab/watchlists');
            setWatchlists(data);
        } catch (error) {
            console.error('Failed to fetch watchlist', error);
        } finally { setFetchingWatchlist(false); }
    };

    const handleAddInstance = (e: React.FormEvent) => {
        e.preventDefault();
        addInstance();
    };
    
    const addInstance = async () => {
        setLoading(true);
        try {
            // Convert selected IDs to JSON strings
            const formDataToSend = {
                ...formData,
                target_users_json: JSON.stringify(selectedUserIds),
                target_projects_json: JSON.stringify(selectedProjectIds)
            };
            
            await api.post('/gitlab/instances', formDataToSend);
            setIsAdding(false);
            resetForm();
            fetchInstances();
            showSuccess('Instance added');
        } catch (error) {
            showError('Failed to add instance');
        } finally { setLoading(false); }
    };

const handleUpdateInstance = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId === null) return;
        updateInstance();
    };
    
    const updateInstance = async () => {
        setLoading(true);
        try {
            // Convert selected IDs to JSON strings
            const formDataToSend = {
                ...formData,
                target_users_json: JSON.stringify(selectedUserIds),
                target_projects_json: JSON.stringify(selectedProjectIds)
            };
            
            await api.put(`/gitlab/instances/${editingId}`, formDataToSend);
            setEditingId(null);
            resetForm();
            fetchInstances();
            showSuccess('Updated successfully');
        } catch (error) {
            showError('Update failed');
        } finally { setLoading(false); }
    };

    const handleTestConnection = () => {
        testConnection();
    };
    
    const testConnection = async () => {
        setTestingConnection(true);
        try {
            const response = await api.post<{success: boolean; message: string}>(
                '/gitlab/test-connection',
                {
                    url: formData.url,
                    personal_access_token: formData.personal_access_token
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            if (response.success) {
                showSuccess(response.message);
                setConnectionTested(true);
            } else {
                showError(response.message);
                setConnectionTested(false);
            }
        } catch (error) {
            showError('Connection failed: Network error or server unavailable');
            setConnectionTested(false);
        } finally {
            setTestingConnection(false);
        }
    };

const handleDeleteInstance = async (id: number) => {
        if (!confirm('Are you sure you want to delete this instance?')) return;
        try {
            await api.delete(`/gitlab/instances/${id}`);
            fetchInstances();
            showSuccess('Deleted successfully');
        } catch (error) { showError('Failed to delete instance'); }
    };

    const toggleWatchlistInclusion = async (item: GitLabWatchlist) => {
        try {
            await api.put(`/gitlab/watchlists/${item.id}`, {
                ...item,
                is_included: !item.is_included
            });
            setWatchlists(prev => prev.map(wl =>
                wl.id === item.id ? { ...wl, is_included: !item.is_included } : wl
            ));
        } catch (error) { showError('Update failed'); }
    };

    const handleDeleteWatchlist = async (id: number) => {
        if (!confirm('Remove from watchlist?')) return;
        try {
            await api.delete(`/gitlab/watchlists/${id}`);
            fetchWatchlist();
            showSuccess('Removed successfully');
        } catch (error) { showError('Removal failed'); }
    };

    const startEditing = (inst: GitLabInstance) => {
        setEditingId(inst.id);
        setFormData({
            instance_name: inst.instance_name,
            url: inst.url,
            personal_access_token: inst.personal_access_token,
            target_users_json: inst.target_users_json || '[]',
            target_projects_json: inst.target_projects_json || '[]'
        });
        // Parse existing selections
        try {
            const users = JSON.parse(inst.target_users_json || '[]');
            const projects = JSON.parse(inst.target_projects_json || '[]');
            setSelectedUserIds(users);
            setSelectedProjectIds(projects);
        } catch (e) {
            setSelectedUserIds([]);
            setSelectedProjectIds([]);
        }
        // When editing, we start at step 1 but with connection already tested
        setConnectionTested(true);
        setStep(1);
        setIsAdding(false);
        setCurrentInstanceId(inst.id);
    };

    const resetForm = () => {
        setFormData({
            instance_name: '',
            url: '',
            personal_access_token: '',
            target_users_json: '[]',
            target_projects_json: '[]'
        });
        // Reset step and connection status when resetting form
        setStep(1);
        setConnectionTested(false);
        // Reset selection states
        setSelectedUserIds([]);
        setSelectedProjectIds([]);
        setGitlabUsers([]);
        setGitlabProjects([]);
        setCurrentInstanceId(null);
        // Reset search filters
        setUserSearch('');
        setProjectSearch('');
    };

    return (
        <div className="space-y-16">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-sky-100/50 rounded-2xl border border-sky-100 flex items-center justify-center">
                        <Globe className="w-8 h-8 text-sky-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-800">來源連接器設定</h2>
                        <p className="text-sm font-bold text-slate-400">管理 GitLab 數據來源、範圍與監控清單</p>
                    </div>
                </div>
                {!isAdding && editingId === null && (
                    <button
                        onClick={() => { setIsAdding(true); resetForm(); }}
                        className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-slate-900 text-white hover:brightness-110 active:scale-95 shadow-lg shadow-slate-200 text-xs font-black uppercase tracking-[0.2em] transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        新增實例
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {(isAdding || editingId !== null) && (
                <div className="relative p-1 rounded-[40px] bg-slate-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 border border-slate-200/50">
                    <form onSubmit={editingId !== null ? handleUpdateInstance : handleAddInstance} className="bg-white p-10 rounded-[38px] space-y-8">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                {editingId !== null ? <Edit2 className="w-5 h-5 text-sky-500" /> : <Plus className="w-5 h-5 text-sky-500" />}
                                {editingId !== null ? '編輯實例' : '新增實例'}
                            </h3>
                            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Step 1: Connection Setup */}
                        {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">實例名稱 (Name)</label>
                                    <input
                                        required
                                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] px-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                                        placeholder="e.g. Office GitLab"
                                        value={formData.instance_name}
                                        onChange={e => setFormData({ ...formData, instance_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">伺服器網址 (URL)</label>
                                    <div className="relative">
                                        <input
                                            required type="url"
                                            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] pl-12 pr-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                                            placeholder="https://gitlab.com"
                                            value={formData.url}
                                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                                        />
                                        <Server className="w-5 h-5 text-slate-300 absolute left-4 top-4.5" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Private Token</label>
                                    <div className="relative">
                                        <input
                                            required type="password"
                                            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] pl-12 pr-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                                            placeholder="glpat-..."
                                            value={formData.personal_access_token}
                                            onChange={e => setFormData({ ...formData, personal_access_token: e.target.value })}
                                        />
                                        <Lock className="w-5 h-5 text-slate-300 absolute left-4 top-4.5" />
                                    </div>
                                </div>
                                <div className="space-y-3 flex items-end">
                                    <button
                                        type="button"
                                        onClick={handleTestConnection}
                                        disabled={testingConnection || !formData.url || !formData.personal_access_token}
                                        className="flex items-center gap-2 px-6 py-4 bg-sky-500 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                                        測試連線
                                    </button>
                                    {connectionTested && (
                                        <span className="text-green-500 font-bold text-sm ml-2">✓ 連線成功</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Filtering Configuration (only shown after connection is tested) */}
                        {step === 2 && connectionTested && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Target Users Selection */}
                                <div className="space-y-3 lg:col-span-1">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Users className="w-3 h-3" /> 目標人員 (Target users)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="搜尋用戶..."
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg pl-3 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-full min-h-[100px] max-h-[300px] bg-slate-50 border border-slate-100 rounded-[24px] p-3 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all resize-none overflow-y-auto custom-scrollbar">
                                        {fetchingUsers ? (
                                            <div className="flex items-center justify-center h-full">
                                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                            </div>
                                        ) : gitlabUsers.length === 0 ? (
                                            <div className="text-slate-400 text-center py-4">
                                                無可用用戶
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {gitlabUsers
                                                    .filter(user => 
                                                        user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                        user.username.toLowerCase().includes(userSearch.toLowerCase())
                                                    )
                                                    .map(user => (
                                                        <div 
                                                            key={user.id} 
                                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                                                                selectedUserIds.includes(user.id) 
                                                                    ? 'bg-sky-100 border border-sky-200' 
                                                                    : 'hover:bg-white'
                                                            }`}
                                                            onClick={() => {
                                                                if (selectedUserIds.includes(user.id)) {
                                                                    setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                                                } else {
                                                                    setSelectedUserIds([...selectedUserIds, user.id]);
                                                                }
                                                            }}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                                                selectedUserIds.includes(user.id) 
                                                                    ? 'bg-sky-500 border-sky-500' 
                                                                    : 'border-slate-300'
                                                            }`}>
                                                                {selectedUserIds.includes(user.id) && (
                                                                    <Check className="w-3 h-3 text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-slate-800 truncate">{user.name}</div>
                                                                <div className="text-[10px] text-slate-500 truncate">{user.username}</div>
                                                            </div>
                                                            <div className={`text-xs px-2 py-1 rounded-full ${
                                                                user.state === 'active' 
                                                                    ? 'bg-green-100 text-green-800' 
                                                                    : 'bg-slate-100 text-slate-800'
                                                            }`}>
                                                                {user.state === 'active' ? 'Active' : 'Inactive'}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Target Projects Selection */}
                                <div className="space-y-3 lg:col-span-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Box className="w-3 h-3" /> 目標專案 (Target projects)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="搜尋專案..."
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg pl-3 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                                            value={projectSearch}
                                            onChange={(e) => setProjectSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-full min-h-[100px] max-h-[300px] bg-slate-50 border border-slate-100 rounded-[24px] p-3 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all resize-none overflow-y-auto custom-scrollbar">
                                        {fetchingProjects ? (
                                            <div className="flex items-center justify-center h-full">
                                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                            </div>
                                        ) : gitlabProjects.length === 0 ? (
                                            <div className="text-slate-400 text-center py-4">
                                                無可用專案
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {gitlabProjects
                                                    .filter(project => 
                                                        project.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
                                                        project.path_with_namespace.toLowerCase().includes(projectSearch.toLowerCase()) ||
                                                        (project.description && project.description.toLowerCase().includes(projectSearch.toLowerCase()))
                                                    )
                                                    .map(project => (
                                                        <div 
                                                            key={project.id} 
                                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                                                                selectedProjectIds.includes(project.id) 
                                                                    ? 'bg-sky-100 border border-sky-200' 
                                                                    : 'hover:bg-white'
                                                            }`}
                                                            onClick={() => {
                                                                if (selectedProjectIds.includes(project.id)) {
                                                                    setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                                                                } else {
                                                                    setSelectedProjectIds([...selectedProjectIds, project.id]);
                                                                }
                                                            }}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                                                selectedProjectIds.includes(project.id) 
                                                                    ? 'bg-sky-500 border-sky-500' 
                                                                    : 'border-slate-300'
                                                            }`}>
                                                                {selectedProjectIds.includes(project.id) && (
                                                                    <Check className="w-3 h-3 text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-slate-800 truncate">{project.name}</div>
                                                                <div className="text-[10px] text-slate-500 truncate">{project.path_with_namespace}</div>
                                                                {project.description && (
                                                                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{project.description}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation between steps */}
                        <div className="flex justify-between pt-4">
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="px-8 py-4 bg-slate-200 text-slate-700 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:brightness-95 transition-all"
                                >
                                    上一步
                                </button>
                            )}
                            {step === 1 && connectionTested && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingId) {
                                            // For editing, we already have the instance ID
                                            fetchGitLabUsers(editingId);
                                            fetchGitLabProjects(editingId);
                                            setCurrentInstanceId(editingId);
                                            
                                            // Parse existing selections
                                            try {
                                                const users = JSON.parse(formData.target_users_json || '[]');
                                                const projects = JSON.parse(formData.target_projects_json || '[]');
                                                setSelectedUserIds(users);
                                                setSelectedProjectIds(projects);
                                            } catch (e) {
                                                setSelectedUserIds([]);
                                                setSelectedProjectIds([]);
                                            }
                                        } else {
                                            // For adding new instance, fetch users and projects using the connection details
                                            fetchGitLabUsersAndProjects();
                                        }
                                        setStep(2);
                                    }}
                                    className="px-8 py-4 bg-sky-500 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:brightness-110 active:scale-95 transition-all"
                                >
                                    下一步 (設定過濾條件)
                                </button>
                            )}
                            <div className="ml-auto">
                                <button
                                    type="submit" 
                                    disabled={loading || (step === 1 && !connectionTested)}
                                    className="px-12 py-4 bg-slate-900 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId !== null ? '更新連結' : '建立連線')}
                                </button>
                            </div>
                        </div>


                    </form>
                </div>
            )}

            {/* Instance List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {fetching && instances.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
                        <Loader2 className="w-10 h-10 animate-spin" />
                        <span className="text-xs font-black uppercase tracking-widest">Loading Connectors...</span>
                    </div>
                ) : instances.map(inst => (
                    <div key={inst.id} className="bg-slate-50/50 border border-slate-100 p-8 rounded-[40px] space-y-8 hover:bg-white hover:shadow-xl hover:border-white transition-all duration-500 group">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm">
                                    <Globe className="w-7 h-7 text-sky-500" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{inst.instance_name}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-70">GitLab Instance</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditing(inst)} className="p-3 text-slate-300 hover:text-sky-500 hover:bg-white rounded-2xl transition-all"><Edit2 className="w-5 h-5" /></button>
                                <button onClick={() => handleDeleteInstance(inst.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-white rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/60 rounded-2xl border border-white/80">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 text-center">人員過濾</span>
                                <span className="text-lg font-black text-slate-700 block text-center">
                                    {(() => { try { return JSON.parse(inst.target_users_json || '[]').length; } catch { return 0; } })()}
                                </span>
                            </div>
                            <div className="p-4 bg-white/60 rounded-2xl border border-white/80">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 text-center">專案監控</span>
                                <span className="text-lg font-black text-slate-700 block text-center">
                                    {(() => { try { return JSON.parse(inst.target_projects_json || '[]').length; } catch { return 0; } })()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Watchlist Section - Embedded in Settings */}
            <div className="pt-10 border-t border-slate-100 space-y-10">
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-800">人員監控清單 (Watchlist)</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">勾選以加載特定對象至數據報表</p>
                    </div>
                    <button onClick={fetchWatchlist} className={`p-4 hover:bg-slate-50 rounded-2xl transition-all ${fetchingWatchlist ? 'animate-spin' : ''}`}>
                        <Loader2 className="w-6 h-6 text-slate-300" />
                    </button>
                </div>

                <div className="bg-slate-50/50 rounded-[40px] border border-slate-100 overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white/30">
                                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">納入數據</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">類型</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">對象名稱</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                            {watchlists.map(wl => (
                                <tr key={wl.id} className="hover:bg-white transition-all group/row">
                                    <td className="px-8 py-5">
                                        <button
                                            onClick={() => toggleWatchlistInclusion(wl)}
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${wl.is_included ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-200 text-white'}`}
                                        >
                                            <Check className={`w-4 h-4 transition-transform ${wl.is_included ? 'scale-100' : 'scale-0'}`} />
                                        </button>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">GitLab Project</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-slate-800 text-sm tracking-tight">{wl.project_name}</span>
                                            <span className="text-[9px] text-slate-300 font-mono">{wl.project_path_with_namespace}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button onClick={() => handleDeleteWatchlist(wl.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/row:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {watchlists.length === 0 && !fetchingWatchlist && (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-300 italic">
                                        尚未連結任何監控數據來源
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GitLabSettings;
