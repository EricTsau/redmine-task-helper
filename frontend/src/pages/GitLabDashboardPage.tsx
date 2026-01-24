import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import { AICopilotFloating } from "@/components/shared/AICopilotFloating";
import { Loader2, GitCommit, GitPullRequest, Layers, Code2, RefreshCw, Filter, Search, Info, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export function GitLabDashboardPage() {
    const { token } = useAuth();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    // Days Filter
    const [days, setDays] = useState(7);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProject, setSelectedProject] = useState<string>("all");
    const [selectedAuthor, setSelectedAuthor] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/gitlab/metrics?days=${days}`, undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [days]);

    // Derived Data for Filters
    const uniqueProjects = useMemo(() => {
        if (!data?.recent_activity) return [];
        return Array.from(new Set(data.recent_activity.map((i: any) => i.project))).sort();
    }, [data]);

    const uniqueAuthors = useMemo(() => {
        if (!data?.recent_activity) return [];
        return Array.from(new Set(data.recent_activity.map((i: any) => i.author))).filter(Boolean).sort();
    }, [data]);

    // Filtered Activity
    const filteredActivity = useMemo(() => {
        if (!data?.recent_activity) return [];
        return data.recent_activity.filter((item: any) => {
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.project && item.project.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesProject = selectedProject === "all" || item.project === selectedProject;
            const matchesAuthor = selectedAuthor === "all" || item.author === selectedAuthor;
            const matchesType = selectedType === "all" || item.type === selectedType;
            return matchesSearch && matchesProject && matchesAuthor && matchesType;
        });
    }, [data, searchQuery, selectedProject, selectedAuthor, selectedType]);

    // Context for AI Copilot
    const getContextData = useCallback(() => {
        return {
            kpi: data?.stats ? {
                total_commits: data.stats.commits,
                total_mrs: data.stats.mrs,
                active_projects: data.stats.projects,
                instances: data.stats.instances
            } : {},
            commits: (data?.recent_activity || []).filter((i: any) => i.type === 'commit').slice(0, 20),
            merge_requests: (data?.recent_activity || []).filter((i: any) => i.type === 'mr').slice(0, 20),
            days_range: days
        };
    }, [data, days]);


    const StatsCard = ({ title, value, icon: Icon, color, description }: any) => (
        <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-4 relative group">
            <div className={`p-4 rounded-xl ${color} bg-opacity-20 text-white relative z-10`}>
                <Icon size={24} />
            </div>
            <div className="relative z-10 flex-1">
                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                    {title}
                    <span className="group/info relative cursor-help">
                        <Info className="w-3 h-3 text-slate-500" />
                        {/* Tooltip fixed to avoid clipping by overflow:hidden on other elements if they existed, 
                            but we removed overflow-hidden from the card container to be safe. 
                            We simply use absolute positioning here. */}
                        <span className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 p-2 bg-slate-900 text-slate-200 text-xs rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-white/10">
                            {description}
                            <span className="absolute left-1/2 top-full -mt-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900 block" />
                        </span>
                    </span>
                </span>
                <h3 className="text-3xl font-black tracking-tight">{value}</h3>
            </div>
            {/* Moved background blob here but without overflow hidden on the main card. 
                Instead we can use an absolute container for the background if we want clipping, 
                or just let it bleed if acceptable, or use a pseudo element.
                For now, let's wrap the blob in an overflow-hidden absolute div 
            */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className={`absolute -right-6 -bottom-6 w-24 h-24 ${color} opacity-10 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-500`} />
            </div>
        </div>
    );

    return (
        <>
            <div className="h-full flex flex-col animate-in fade-in duration-700 p-8 custom-scrollbar overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            {t('gitlabDashboard.title')}
                        </h1>
                        <p className="text-muted-foreground font-medium">{t('gitlabDashboard.subtitle')}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <select
                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                            >
                                <option value={7}>{t('aiSummary.7Days')}</option>
                                <option value={14}>14 {t('aiSummary.dateRange')}</option>
                                <option value={30}>{t('aiSummary.30Days')}</option>
                                <option value={60}>60 {t('aiSummary.dateRange')}</option>
                                <option value={90}>90 {t('aiSummary.dateRange')}</option>
                            </select>
                        </div>

                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                            title={t('gitlabDashboard.refresh')}
                        >
                            <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {loading && !data ? (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-8 pb-20">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatsCard
                                title={t('gitlabDashboard.stats.totalCommits')}
                                value={data?.stats?.commits || 0}
                                icon={GitCommit}
                                color="bg-emerald-500"
                                description={t('gitlabDashboard.stats.commitsDesc', { days })}
                            />
                            <StatsCard
                                title={t('gitlabDashboard.stats.mergeRequests')}
                                value={data?.stats?.mrs || 0}
                                icon={GitPullRequest}
                                color="bg-violet-500"
                                description={t('gitlabDashboard.stats.mrsDesc')}
                            />
                            <StatsCard
                                title={t('gitlabDashboard.stats.activeProjects')}
                                value={data?.stats?.projects || 0}
                                icon={Layers}
                                color="bg-blue-500"
                                description={t('gitlabDashboard.stats.projectsDesc')}
                            />
                            <StatsCard
                                title={t('gitlabDashboard.stats.instances')}
                                value={data?.stats?.instances || 0}
                                icon={Code2}
                                color="bg-orange-500"
                                description={t('gitlabDashboard.stats.instancesDesc')}
                            />
                        </div>

                        {/* Heatmap Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('gitlabDashboard.sections.heatmap')}</h3>
                            </div>
                            <ActivityHeatmap data={data?.heatmap || {}} />
                        </div>

                        {/* Timeline & Filters */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-5 bg-violet-500 rounded-full" />
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('gitlabDashboard.sections.explorer')}</h3>
                                </div>
                            </div>

                            {/* Filters Toolbar */}
                            <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center shadow-sm">
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[200px]">
                                    <Search className="w-4 h-4 text-slate-400" />
                                    <input
                                        className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder:text-slate-400"
                                        placeholder={t('gitlabDashboard.filters.searchPlaceholder')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                                <select
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20"
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                >
                                    <option value="all">{t('gitlabDashboard.filters.allProjects')}</option>
                                    {uniqueProjects.map((p: any) => <option key={p} value={p}>{p}</option>)}
                                </select>

                                <select
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20"
                                    value={selectedAuthor}
                                    onChange={(e) => setSelectedAuthor(e.target.value)}
                                >
                                    <option value="all">{t('gitlabDashboard.filters.allAuthors')}</option>
                                    {uniqueAuthors.map((a: any) => <option key={a} value={a}>{a}</option>)}
                                </select>

                                <select
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20"
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value)}
                                >
                                    <option value="all">{t('gitlabDashboard.filters.allTypes')}</option>
                                    <option value="commit">{t('gitlabDashboard.filters.commit')}</option>
                                    <option value="mr">{t('gitlabDashboard.filters.mr')}</option>
                                </select>

                                <div className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {t('gitlabDashboard.filters.showing', { count: filteredActivity.length })}
                                </div>
                            </div>

                            {/* Detail List */}
                            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[300px]">
                                <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-8">
                                    {filteredActivity.length === 0 && (
                                        <div className="pl-6 pt-4 text-muted-foreground flex items-center gap-2">
                                            <Filter className="w-4 h-4" /> {t('gitlabDashboard.sections.noFilterMatches')}
                                        </div>
                                    )}
                                    {filteredActivity.map((item: any, idx: number) => (
                                        <div key={idx} className="relative pl-6 group">
                                            <div className={`absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 bg-white ${item.type === 'commit' ? 'bg-emerald-500' : 'bg-violet-500'
                                                }`} />

                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-1">
                                                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                    {format(new Date(item.date), 'MMM dd HH:mm')}
                                                </span>
                                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${item.type === 'commit'
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-500'
                                                    : 'bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-500'
                                                    }`}>
                                                    {item.type}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">{item.project}</span>
                                            </div>

                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800/80 shadow-sm">
                                                <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">{item.title}</h4>

                                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                            {item.author?.[0]?.toUpperCase()}
                                                        </span>
                                                        <span className="font-semibold">{item.author}</span>
                                                    </div>

                                                    {item.type === 'commit' && item.stats && (
                                                        <div className="flex items-center gap-2 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                                                            <span className="text-emerald-600 dark:text-emerald-500">+{item.stats.additions}</span>
                                                            <span className="text-rose-600 dark:text-rose-500">-{item.stats.deletions}</span>
                                                        </div>
                                                    )}

                                                    {item.type === 'mr' && (
                                                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${item.state === 'merged' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {item.state}
                                                        </span>
                                                    )}

                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-500 hover:underline ml-auto font-bold"
                                                    >
                                                        {t('gitlabDashboard.viewOnGitLab')}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <AICopilotFloating contextType="gitlab_dashboard" getContextData={getContextData} />
        </>
    );
}

export default GitLabDashboardPage;
