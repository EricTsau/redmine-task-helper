import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Loader2 } from 'lucide-react';

interface Project {
    id: number;
    name: string;
    identifier: string;
}

interface WatchlistItem {
    id: number;
    redmine_project_id: number;
    project_name: string;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function WatchlistSettings() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingId, setAddingId] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Watchlist
            const wRes = await fetch(`${API_BASE}/watchlist`);
            if (wRes.ok) setWatchlist(await wRes.json());

            // Fetch Redmine Projects
            const redmineKey = localStorage.getItem('redmine_api_key');

            // Get URL from backend settings (public)
            const settingsRes = await fetch(`${API_BASE}/settings`);
            const settingsData = await settingsRes.json();
            const redmineUrl = settingsData.redmine_url;

            if (redmineKey && redmineUrl) {
                const pRes = await fetch(`${API_BASE}/projects`, {
                    headers: {
                        'X-Redmine-Key': redmineKey,
                        'X-Redmine-Url': redmineUrl
                    }
                });
                if (pRes.ok) setProjects(await pRes.json());
            }
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
            const res = await fetch(`${API_BASE}/watchlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redmine_project_id: project.id,
                    project_name: project.name
                })
            });
            if (res.ok) {
                const newItem = await res.json();
                setWatchlist(prev => [...prev, newItem]);
            }
        } catch (e) {
            console.error("Add failed", e);
        } finally {
            setAddingId(null);
        }
    };

    const removeFromWatchlist = async (redmine_id: number) => {
        try {
            const res = await fetch(`${API_BASE}/watchlist/${redmine_id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setWatchlist(prev => prev.filter(item => item.redmine_project_id !== redmine_id));
            }
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    // Filter projects: exclude already watched
    const watchedIds = new Set(watchlist.map(w => w.redmine_project_id));
    const availableProjects = projects
        .filter(p => !watchedIds.has(p.id))
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

                <div className="max-h-60 overflow-y-auto space-y-1 p-1">
                    {availableProjects.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md group">
                            <span className="text-sm">{project.name}</span>
                            <button
                                onClick={() => addToWatchlist(project)}
                                disabled={addingId === project.id}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                                {addingId === project.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Plus className="h-3 w-3" />
                                )}
                            </button>
                        </div>
                    ))}
                    {availableProjects.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                            {searchQuery ? 'No matching projects found' : 'All projects are being watched'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
