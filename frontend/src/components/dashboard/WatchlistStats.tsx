import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface WatchlistStat {
    id: number;
    redmine_project_id: number;
    project_name: string;
    open_issues_count: number;
}

import { api } from '@/lib/api';

export function WatchlistStats() {
    const [stats, setStats] = useState<WatchlistStat[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // Get API Key
                const settingsRes = await api.get<any>('/settings');
                const apiKey = settingsRes.redmine_token;

                if (apiKey) {
                    const res = await api.get<WatchlistStat[]>('/watchlist/stats', {}, {
                        headers: { 'X-Redmine-API-Key': apiKey }
                    });
                    setStats(res);
                }
            } catch (e) {
                console.error("Failed to fetch watchlist stats", e);
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
