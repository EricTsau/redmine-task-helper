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
            case 'critical': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
            case 'warning': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
            case 'healthy': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
            default: return 'text-gray-500';
        }
    };

    if (loading && !data) {
        return <div className="p-8 flex justify-center"><RefreshCw className="animate-spin w-6 h-6 text-gray-400" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-blue-600" />
                        Executive Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">Real-time portfolio insights and risk assessment</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchDashboard}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setBriefingOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-md transition-all hover:shadow-lg"
                    >
                        <FileText className="w-4 h-4" />
                        Generate AI Briefing
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-500 mb-2">Total Projects</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data?.total_projects}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-l-4 border-red-500 dark:border-gray-700">
                    <div className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Critical
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data?.portfolio_health.critical}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-l-4 border-yellow-500 dark:border-gray-700">
                    <div className="text-sm font-medium text-yellow-600 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Warning
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data?.portfolio_health.warning}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-l-4 border-green-500 dark:border-gray-700">
                    <div className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Healthy
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data?.portfolio_health.healthy}</div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Project List */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Health Overview</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4">Project Name</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Overdue Tasks</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {data?.project_health_list.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getHealthColor(p.health_status)}`}>
                                                {p.health_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                            {p.overdue_count > 0 ? (
                                                <span className="text-red-500 font-bold">{p.overdue_count}</span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Col: Risk Radar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-red-500" />
                            Risk Radar (Top 5)
                        </h3>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto">
                        <div className="space-y-4">
                            {data?.top_risks.length === 0 && (
                                <p className="text-gray-500 text-center py-4">No critical risks detected.</p>
                            )}
                            {data?.top_risks.map(risk => (
                                <div key={risk.id} className="group p-4 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 hover:border-red-200 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{risk.project_name}</div>
                                        <span className="text-xs font-mono text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">
                                            Due: {risk.due_date}
                                        </span>
                                    </div>
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2" title={risk.subject}>
                                        {risk.subject}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                                            {risk.assigned_to.charAt(0)}
                                        </div>
                                        {risk.assigned_to}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-center">
                        <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">View All Risks</button>
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
