import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Loader2 } from 'lucide-react';

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

    const renderProjectItem = (project: Project, depth: number = 0) => {
        const isWatched = watchedIds.has(project.id);
        const isCovered = isUnderWatchedProject(project);
        const isDisabled = isWatched || isCovered;

        // If searching, we flatten the tree but maintain basic info
        const shouldShow = searchQuery
            ? project.name.toLowerCase().includes(searchQuery.toLowerCase())
            : true;

        const children = projectsByParent[project.id] || [];

        return (
            <div key={project.id} className="space-y-1">
                {shouldShow && (
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded-md group">
                        <div className="flex items-center gap-2 overflow-hidden" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                            {depth > 0 && <span className="text-muted-foreground">└</span>}
                            <span className={`text-sm truncate ${isCovered ? 'text-muted-foreground italic' : ''}`}>
                                {project.name}
                                {isCovered && <span className="ml-2 text-[10px] bg-muted px-1 rounded">Covered by parent</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isWatched ? (
                                <span className="text-[10px] text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">Watching</span>
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
                {/* 
                   If NOT searching, we show tree. 
                   If searching, we only show children if they are also rendered by the main loop or if we want to show the full path.
                   For simplicity in MVP, if NOT searching, we recurse.
                */}
                {!searchQuery && children.map(child => renderProjectItem(child, depth + 1))}
            </div>
        );
    };


    return (
        <section className="space-y-4 p-6 border rounded-lg">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="text-xl">👁️</span> Watchlist
                </h2>
                <button onClick={fetchData} className="p-2 hover:bg-muted rounded-full">
                    <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <p className="text-sm text-muted-foreground">
                Select projects for AI analysis and monitoring. Only watched projects will be processed.
            </p>

            {/* Watchlist */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Watching ({watchlist.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {watchlist.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm">
                            <span className="font-medium">{item.project_name}</span>
                            <button
                                onClick={() => removeFromWatchlist(item.redmine_project_id)}
                                className="text-muted-foreground hover:text-destructive p-1"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {watchlist.length === 0 && (
                        <div className="col-span-full py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                            No projects watched yet. Add one below.
                        </div>
                    )}
                </div>
            </div>

            {/* Add Project */}
            <div className="space-y-3 pt-4 border-t">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search Redmine projects..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1 p-1">
                    {searchQuery ? (
                        allProjects
                            .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(p => renderProjectItem(p, 0))
                    ) : (
                        projectsByParent[0]?.map(p => renderProjectItem(p, 0))
                    )}
                    {allProjects.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                            No projects found. Please check your Redmine connection.
                        </p>
                    )}
                    {searchQuery && allProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                            No matching projects found
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
