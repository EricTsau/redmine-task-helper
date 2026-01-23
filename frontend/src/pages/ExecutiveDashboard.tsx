import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, FileText, LayoutDashboard, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { ExecutiveBriefingModal } from '@/components/dashboard/ExecutiveBriefingModal';

interface DashboardData {
    portfolio_health: {
        critical: number;
        warning: number;
        healthy: number;
    };
    total_projects: number;
    project_health_list: Array<{
        id: number;
        name: string;
        identifier: string;
        health_status: 'critical' | 'warning' | 'healthy';
        overdue_count: number;
    }>;
    top_risks: Array<{
        id: number;
        project_name: string;
        subject: string;
        due_date: string;
        assigned_to: string;
    }>;
}

export const ExecutiveDashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [briefingOpen, setBriefingOpen] = useState(false);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const res = await api.get('/dashboard/executive-summary');
            setData(res as DashboardData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'critical': return 'text-tech-rose bg-tech-rose/10 border-tech-rose/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
            case 'warning': return 'text-tech-amber bg-tech-amber/10 border-tech-amber/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
            case 'healthy': return 'text-tech-cyan bg-tech-cyan/10 border-tech-cyan/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]';
            default: return 'text-muted-foreground bg-muted/20';
        }
    };

    if (loading && !data) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin shadow-glow" />
                </div>
                <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">分析傳輸中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 shadow-glow">
                            <LayoutDashboard className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                            Executive View
                        </h1>
                    </div>
                    <p className="text-muted-foreground font-medium ml-1">Real-time portfolio insights and strategic risk assessment</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={fetchDashboard}
                        className="p-3 glass-card rounded-2xl border-border/30 hover:text-primary transition-all active:scale-95 group"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    </button>
                    <button
                        onClick={() => setBriefingOpen(true)}
                        className="relative group px-6 py-3 rounded-2xl font-bold text-sm overflow-hidden tech-button-primary"
                    >
                        <div className="relative z-10 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>Generate AI Briefing</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Projects', value: data?.total_projects, color: 'primary' },
                    { label: 'Critical Risks', value: data?.portfolio_health.critical, color: 'rose', icon: AlertTriangle },
                    { label: 'Warning Alerts', value: data?.portfolio_health.warning, color: 'amber', icon: Clock },
                    { label: 'Healthy Systems', value: data?.portfolio_health.healthy, color: 'cyan', icon: CheckCircle },
                ].map((kpi, i) => (
                    <div key={i} className="group relative">
                        <div className={`absolute -inset-0.5 bg-gradient-to-br from-tech-${kpi.color}/20 to-transparent rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500`} />
                        <div className="relative glass-card p-6 rounded-3xl border-border/30 flex flex-col justify-between h-full hover:border-tech-${kpi.color}/40 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{kpi.label}</span>
                                {kpi.icon && <kpi.icon className={`w-4 h-4 text-tech-${kpi.color}`} />}
                            </div>
                            <div className={`text-4xl font-black tracking-tighter text-tech-${kpi.color} group-hover:scale-105 transition-transform`}>
                                {kpi.value || 0}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Project List */}
                <div className="lg:col-span-2 glass-card rounded-3xl border-border/30 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border/20 flex justify-between items-center bg-white/5">
                        <h3 className="text-lg font-bold tracking-tight">Portfolio Health Matrix</h3>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-muted/10 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                                    <th className="px-8 py-5">Project Identification</th>
                                    <th className="px-8 py-5 text-center">Health Status</th>
                                    <th className="px-8 py-5 text-right">Deviations</th>
                                    <th className="px-8 py-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                                {data?.project_health_list.map(p => (
                                    <tr key={p.id} className="group hover:bg-primary/5 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.identifier}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all duration-300 ${getHealthColor(p.health_status)}`}>
                                                    {p.health_status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {p.overdue_count > 0 ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-tech-rose/10 text-tech-rose border border-tech-rose/20 font-bold text-xs ring-2 ring-tech-rose/5 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {p.overdue_count} OVERDUE
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground opacity-30">—</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground font-bold text-xs transition-all active:scale-95">
                                                ANALYZE
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Col: Risk Radar */}
                <div className="flex flex-col gap-8">
                    <div className="glass-card rounded-3xl border-border/30 flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-border/20 flex items-center justify-between bg-white/5">
                            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                                <Activity className="w-5 h-5 text-tech-rose" />
                                Critical Risk Radar
                            </h3>
                            <span className="text-[10px] font-black bg-tech-rose/20 text-tech-rose px-2 py-0.5 rounded uppercase">Real-time</span>
                        </div>
                        <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {data?.top_risks.length === 0 ? (
                                <div className="text-center py-12 space-y-3">
                                    <CheckCircle className="w-12 h-12 text-tech-cyan/20 mx-auto" />
                                    <p className="text-muted-foreground font-medium">All systems operational.</p>
                                </div>
                            ) : (
                                data?.top_risks.map((risk, i) => (
                                    <div key={risk.id} className="group relative p-4 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-border/20 hover:border-tech-rose/30 transition-all duration-500 animate-in fade-in slide-in-from-right-4" style={{ animationDelay: `${i * 100}ms` }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[150px]">{risk.project_name}</div>
                                            <span className="text-[9px] font-black text-tech-rose border border-tech-rose/20 bg-tech-rose/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                Due: {risk.due_date}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-foreground leading-tight mb-4 line-clamp-2 group-hover:text-tech-rose transition-colors">
                                            {risk.subject}
                                        </h4>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-tech-indigo flex items-center justify-center text-[10px] font-black text-white shadow-glow">
                                                    {risk.assigned_to.charAt(0)}
                                                </div>
                                                <span className="text-xs font-bold text-muted-foreground">{risk.assigned_to}</span>
                                            </div>
                                            <div className="h-1 w-12 bg-border/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-tech-rose animate-pulse" style={{ width: '70%' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-border/10 bg-muted/5">
                            <button className="w-full py-2.5 text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all uppercase tracking-widest">
                                Expand Intelligence Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ExecutiveBriefingModal
                isOpen={briefingOpen}
                onClose={() => setBriefingOpen(false)}
            />
        </div>
    );
};
