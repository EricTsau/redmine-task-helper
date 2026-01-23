import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Project {
    id: number;
    name: string;
    parent_id?: number;
}

interface User {
    id: number;
    name: string;
}

interface ConfigProps {
    onConfigSaved: () => void;
}

export function SummaryConfig({ onConfigSaved }: ConfigProps) {
    const { t } = useTranslation();
    const { showSuccess, showError } = useToast();
    const { token } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    // Members state
    const [members, setMembers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProjects();
        fetchSettings();
    }, []);

    useEffect(() => {
        if (selectedProjectIds.length > 0) {
            fetchMembers(selectedProjectIds);
        } else {
            setMembers([]);
        }
    }, [selectedProjectIds]);

    const fetchProjects = async () => {
        try {
            const res = await api.get<Project[]>("/projects", undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res as any);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get<any>("/ai-summary/settings", undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedProjectIds(res.target_project_ids || []);
            setSelectedUserIds(res.target_user_ids || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMembers = async (projectIds: number[]) => {
        // We probably need an endpoint to get members of multiple projects.
        // Or we loop CLIENT SIDE (bad for perf but ok for MVP).
        // Let's rely on backend service 'fetching members' or just listing all known users?
        // Actually, Redmine 'get_project_members' is per project.
        // Let's implement a loop here for MVP.
        let allMembers: User[] = [];
        for (const pid of projectIds) {
            try {
                const res = await api.get<any>(`/projects/${pid}/members`, undefined, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // res should be list of members (direct response or in data prop depending on API structure? backend RedmineService returns list directly mostly, but let's check. 
                // api.ts returns response directly if JSON.
                // Redmine usually returns { memberships: [...] } or list? 
                // Let's assume list or handle both. 
                // Based on previous code assumption: res.data. 
                // But my api.ts returns parsed JSON body directly as T. 
                // So if backend returns list, T is list.
                // Let's cast to any and access safely.
                const data = Array.isArray(res) ? res : (res.memberships || res.data || []);
                allMembers = [...allMembers, ...data];
            } catch (e) {
                console.warn(`Failed to fetch members for project ${pid}`, e);
            }
        }

        // Dedup by ID and sort alphabetically by name
        const unique = Array.from(new Map(allMembers.map(item => [item.id, item])).values());
        const sorted = unique.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(sorted);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put("/ai-summary/settings", {
                project_ids: selectedProjectIds,
                user_ids: selectedUserIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showSuccess(t('aiSummary.configSaved'));
            onConfigSaved();
        } catch (error) {
            showError(t('aiSummary.configSaveFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Toggle helper
    const toggleSelection = (id: number, list: number[], setList: (l: number[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(i => i !== id));
        } else {
            setList([...list, id]);
        }
    };

    // Build project tree structure
    const projectsByParent = useMemo(() => {
        const result: Record<number, Project[]> = {};
        projects.forEach(p => {
            const pid = p.parent_id || 0;
            if (!result[pid]) result[pid] = [];
            result[pid].push(p);
        });
        return result;
    }, [projects]);

    // Auto-expand parents of selected projects
    const autoExpandedNodes = useMemo(() => {
        const expanded = new Set<number>();
        selectedProjectIds.forEach(id => {
            const project = projects.find(p => p.id === id);
            if (project?.parent_id) {
                expanded.add(project.parent_id);
            }
        });
        return expanded;
    }, [selectedProjectIds, projects]);

    const isNodeExpanded = (id: number) => {
        return expandedNodes.has(id) || autoExpandedNodes.has(id);
    };

    const toggleNode = (id: number) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderProjectItem = (project: Project, depth: number = 0): React.ReactNode => {
        const children = projectsByParent[project.id] || [];
        const hasChildren = children.length > 0;
        const isExpanded = isNodeExpanded(project.id);
        const isSelected = selectedProjectIds.includes(project.id);

        return (
            <div key={project.id} className="space-y-0.5">
                <div
                    className="flex items-center gap-1 py-1 hover:bg-white/5 rounded px-1 transition-colors"
                    style={{ paddingLeft: `${depth * 0.75}rem` }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={() => toggleNode(project.id)}
                            className="p-0.5 hover:bg-white/20 rounded transition-colors shrink-0"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                        </button>
                    ) : (
                        <span className="w-4 shrink-0" />
                    )}
                    <input
                        type="checkbox"
                        id={`proj-${project.id}`}
                        checked={isSelected}
                        onChange={() => toggleSelection(project.id, selectedProjectIds, setSelectedProjectIds)}
                        className="rounded shrink-0"
                    />
                    <label htmlFor={`proj-${project.id}`} className="text-sm cursor-pointer truncate">
                        {project.name}
                    </label>
                </div>
                {isExpanded && children.map(child => renderProjectItem(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="glass-card rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h3 className="text-sm font-bold">{t('aiSummary.configTitle')}</h3>
            </div>
            <div className="space-y-4">
                <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">{t('aiSummary.selectProjects')}</Label>
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto border border-border/20 p-3 rounded-xl bg-white/5 custom-scrollbar">
                        {projectsByParent[0]?.map(p => renderProjectItem(p, 0))}
                        {projects.length === 0 && (
                            <span className="text-muted-foreground text-sm">{t('common.loading')}</span>
                        )}
                    </div>
                </div>

                <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">{t('aiSummary.selectMembers')}</Label>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-border/20 p-3 rounded-xl bg-white/5 custom-scrollbar">
                        {members.length === 0 && <span className="text-muted-foreground text-sm">{t('aiSummary.selectProjectFirst')}</span>}
                        {members.map(u => (
                            <div key={u.id} className="flex items-center space-x-2 py-1 hover:bg-white/5 rounded px-1 transition-colors">
                                <input
                                    type="checkbox"
                                    id={`user-${u.id}`}
                                    checked={selectedUserIds.includes(u.id)}
                                    onChange={() => toggleSelection(u.id, selectedUserIds, setSelectedUserIds)}
                                    className="rounded"
                                />
                                <label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer flex-1">{u.name}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <Button onClick={handleSave} disabled={loading} className="tech-button-primary">
                    {loading ? t('aiSummary.saving') : t('aiSummary.saveConfig')}
                </Button>
            </div>
        </div>
    );
}
