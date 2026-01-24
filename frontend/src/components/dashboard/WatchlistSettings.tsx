import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

interface Project {
    id: number;
    name: string;
    identifier: string;
    parent_id?: number;
}

interface WatchlistItem {
    id: number;
    redmine_project_id: number;
    project_name: string;
}

import { api } from '@/lib/api';

export function WatchlistSettings() {
    const [allProjects, setAllProjects] = useState<Project[]>([]); // Renamed from 'projects'
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingId, setAddingId] = useState<number | null>(null); // Kept for the button loading state
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Watchlist
            const wRes = await api.get<WatchlistItem[]>('/watchlist');
            setWatchlist(wRes);

            // Fetch Redmine Projects
            const pRes = await api.get<Project[]>('/projects');
            setAllProjects(pRes || []);
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const addToWatchlist = async (project: Project) => {
        setAddingId(project.id);
        try {
            const res = await api.post<WatchlistItem>('/watchlist', {
                redmine_project_id: project.id,
                project_name: project.name
            });
            setWatchlist(prev => [...prev, res]);
        } catch (e) {
            console.error("Add failed", e);
        } finally {
            setAddingId(null);
        }
    };

    const removeFromWatchlist = async (redmine_id: number) => {
        try {
            await api.delete(`/watchlist/${redmine_id}`);
            setWatchlist(prev => prev.filter(item => item.redmine_project_id !== redmine_id));
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    // Filter and sort projects for hierarchical display
    const watchedIds = new Set(watchlist.map(w => w.redmine_project_id));
    const isUnderWatchedProject = (project: Project) => {
        let currentParentId = project.parent_id;
        while (currentParentId) {
            if (watchedIds.has(currentParentId)) return true;
            const parent = allProjects.find(p => p.id === currentParentId);
            currentParentId = parent?.parent_id;
        }
        return false;
    };

    const projectsByParent: Record<number, Project[]> = {};
    allProjects.forEach(p => {
        const pid = p.parent_id || 0;
        if (!projectsByParent[pid]) projectsByParent[pid] = [];
        projectsByParent[pid].push(p);
    });

    // Calculate which nodes should be auto-expanded (parents of watched projects)
    const autoExpandedNodes = useMemo(() => {
        const expanded = new Set<number>();
        watchlist.forEach(w => {
            const project = allProjects.find(p => p.id === w.redmine_project_id);
            if (project?.parent_id) {
                expanded.add(project.parent_id);
            }
        });
        return expanded;
    }, [watchlist, allProjects]);

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

    const renderProjectItem = (project: Project, depth: number = 0) => {
        const isWatched = watchedIds.has(project.id);
        const isCovered = isUnderWatchedProject(project);
        const isDisabled = isWatched || isCovered;

        // If searching, we flatten the tree but maintain basic info
        const shouldShow = searchQuery
            ? project.name.toLowerCase().includes(searchQuery.toLowerCase())
            : true;

        const children = projectsByParent[project.id] || [];
        const hasChildren = children.length > 0;
        const isExpanded = isNodeExpanded(project.id);

        return (
            <div key={project.id} className="space-y-0.5">
                {shouldShow && (
                    <div className="flex items-center justify-between p-2 hover:bg-white/10 rounded-lg group transition-colors">
                        <div className="flex items-center gap-1 overflow-hidden" style={{ paddingLeft: `${depth * 1}rem` }}>
                            {hasChildren && !searchQuery ? (
                                <button
                                    onClick={() => toggleNode(project.id)}
                                    className="p-0.5 hover:bg-white/20 rounded transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                </button>
                            ) : (
                                <span className="w-4" />
                            )}
                            <span className={`text-sm truncate ${isCovered ? 'text-muted-foreground italic' : ''}`}>
                                {project.name}
                                {isCovered && <span className="ml-2 text-[10px] bg-muted/30 px-1.5 py-0.5 rounded">{t('watchlist.coveredByParent')}</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isWatched ? (
                                <span className="text-[10px] text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">{t('watchlist.watching')}</span>
                            ) : (
                                <button
                                    onClick={() => addToWatchlist(project)}
                                    disabled={isDisabled || addingId === project.id}
                                    className={`p-1 rounded transition-opacity ${isDisabled
                                        ? 'opacity-30 cursor-not-allowed'
                                        : 'opacity-0 group-hover:opacity-100 bg-primary text-primary-foreground hover:bg-primary/90'
                                        }`}
                                >
                                    {addingId === project.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {/* Show children only if expanded and not searching */}
                {!searchQuery && isExpanded && children.map(child => renderProjectItem(child, depth + 1))}
            </div>
        );
    };

    const { t } = useTranslation();

    return (
        <section className="bg-white rounded-[48px] p-10 space-y-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-sky-100/50 rounded-2xl border border-sky-100">
                        <Plus className="w-6 h-6 text-sky-500" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-800">
                        {t('watchlist.title')}
                    </h2>
                </div>
                <button onClick={fetchData} className="p-3 hover:bg-slate-50 rounded-2xl transition-all active:scale-95 group">
                    <Loader2 className={`h-6 w-6 text-slate-300 group-hover:text-sky-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <p className="text-sm text-muted-foreground">
                {t('watchlist.description')}
            </p>

            {/* Watchlist */}
            <div className="space-y-6">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('watchlist.watching')} ({watchlist.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {watchlist.map(item => (
                        <div key={item.id} className="group flex items-center justify-between p-5 bg-slate-50/50 border border-slate-100 rounded-[28px] hover:bg-white hover:shadow-xl hover:border-white transition-all duration-300">
                            <span className="font-bold text-slate-700">{item.project_name}</span>
                            <button
                                onClick={() => removeFromWatchlist(item.redmine_project_id)}
                                className="text-slate-300 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-2xl transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {watchlist.length === 0 && (
                        <div className="col-span-full py-16 text-center text-sm font-bold text-slate-300 border-2 border-dashed border-slate-100 rounded-[40px]">
                            {t('watchlist.noProjectsWatched')}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Project */}
            <div className="space-y-6 pt-10 border-t border-slate-100">
                <div className="relative">
                    <Search className="absolute left-5 top-4.5 h-6 w-6 text-slate-300" />
                    <input
                        type="text"
                        placeholder={t('watchlist.searchProjects')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-15 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-200"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-0.5 p-2 custom-scrollbar">
                    {searchQuery ? (
                        allProjects
                            .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(p => renderProjectItem(p, 0))
                    ) : (
                        projectsByParent[0]?.map(p => renderProjectItem(p, 0))
                    )}
                    {allProjects.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t('watchlist.noProjectsFound')}
                        </p>
                    )}
                    {searchQuery && allProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t('watchlist.noMatchingProjects')}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
