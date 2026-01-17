import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface WatchlistStat {
    id: number;
    redmine_project_id: number;
    project_name: string;
    open_issues_count: number;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function WatchlistStats() {
    const [stats, setStats] = useState<WatchlistStat[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // Determine credentials same way as other components
                const localKey = localStorage.getItem('redmine_api_key');
                const settingsRes = await fetch(`${API_BASE}/settings`);
                const settingsData = await settingsRes.json();
                const url = settingsData.redmine_url;

                if (localKey && url) {
                    const res = await fetch(`${API_BASE}/watchlist/stats`, {
                        headers: {
                            'X-Redmine-Key': localKey,
                            'X-Redmine-Url': url
                        }
                    });
                    if (res.ok) {
                        setStats(await res.json());
                    }
                }
            } catch (error) {
                console.error("Failed to fetch watchlist stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stats...
            </div>
        );
    }

    if (stats.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {stats.map(stat => (
                <div key={stat.id} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-2">
                    <div className="text-sm font-medium text-muted-foreground truncate" title={stat.project_name}>
                        {stat.project_name}
                    </div>
                    <div className="text-2xl font-bold flex items-baseline gap-2">
                        {stat.open_issues_count}
                        <span className="text-xs font-normal text-muted-foreground">open issues</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
