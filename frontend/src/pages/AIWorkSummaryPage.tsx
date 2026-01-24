import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SummaryConfig } from "@/components/ai-summary/SummaryConfig";
import { SummaryView } from "@/components/ai-summary/SummaryView";
import { SummaryHistory } from "@/components/ai-summary/SummaryHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { Loader2, PanelLeftOpen, PanelLeftClose } from "lucide-react";

export default function AIWorkSummaryPage() {
    const { t, i18n } = useTranslation();
    const { token } = useAuth();
    const { showError, showSuccess } = useToast();

    // State
    const [activeTab, setActiveTab] = useState("generate");
    const [reports, setReports] = useState<any[]>([]);
    const [currentReport, setCurrentReport] = useState<any>(null);

    // Gen params
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (token) {
            fetchHistory();
        }
    }, [token]);

    const fetchHistory = async () => {
        try {
            const res = await api.get<any[]>("/ai-summary/history", undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReports(res as any);
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerate = async () => {
        if (!startDate) {
            showError(t('aiSummary.selectStartDate'));
            return;
        }
        setGenerating(true);
        try {
            const res = await api.post("/ai-summary/generate", {
                start_date: startDate,
                end_date: endDate || undefined,
                language: i18n.language || 'zh-TW'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentReport(res as any);
            fetchHistory();
        } catch (error) {
            showError(t('aiSummary.generateFailed'));
        } finally {
            setGenerating(false);
        }
    };

    const handleSelectReport = (id: number) => {
        const r = reports.find(item => item.id === id);
        if (r) {
            setCurrentReport(r);
        }
    };

    const [isSetupCollapsed, setIsSetupCollapsed] = useState(false);

    const handleDeleteReport = async (id: number) => {
        if (!confirm(t('aiSummary.confirmDelete'))) return;

        try {
            await api.delete(`/ai-summary/${id}`);
            setReports(prev => prev.filter(r => r.id !== id));
            if (currentReport?.id === id) {
                setCurrentReport(null);
            }
            showSuccess(t('aiSummary.deleteSuccess'));
        } catch (error) {
            console.error(error);
            showError(t('aiSummary.deleteFailed'));
        }
    };

    const handleReportUpdate = (updatedReport: any) => {
        setReports(prev => prev.map(r => r.id === updatedReport.id ? { ...r, ...updatedReport } : r));
        if (currentReport?.id === updatedReport.id) {
            setCurrentReport((prev: any) => ({ ...prev, ...updatedReport }));
        }
    };

    return (
        <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">
                        {t('aiSummary.title')}
                    </h1>
                    <p className="text-muted-foreground font-medium">{t('aiSummary.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-muted/20 p-1 rounded-xl border border-border/20">
                        <button
                            onClick={() => setActiveTab("generate")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'generate' ? 'bg-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t('aiSummary.generate')}
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t('aiSummary.archive')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden">
                {/* Configuration / List Panel */}
                <div className={`transition-all duration-500 ease-in-out flex flex-col gap-6 ${isSetupCollapsed ? "lg:w-0 h-0 lg:h-auto opacity-0 overflow-hidden" : "w-full lg:w-1/3 min-w-[320px] h-1/2 lg:h-auto shrink-0 overflow-y-auto custom-scrollbar pr-2"}`}>
                    {activeTab === 'generate' ? (
                        <div className="space-y-6">
                            <div className="glass-card rounded-3xl border-border/20 p-1">
                                <SummaryConfig onConfigSaved={() => { }} />
                            </div>

                            <div className="glass-card p-8 rounded-3xl border-border/20 bg-gradient-to-br from-white/5 to-transparent space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                                    <h3 className="text-sm font-black uppercase tracking-widest">{t('aiSummary.reportParameters')}</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex gap-2 mb-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const end = new Date();
                                                const start = new Date();
                                                setEndDate(end.toISOString().split('T')[0]);
                                                setStartDate(start.toISOString().split('T')[0]);
                                            }}
                                            className="flex-1 bg-white/5 border-border/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 hover:text-primary"
                                        >
                                            {t('aiSummary.1Day')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const end = new Date();
                                                const start = new Date();
                                                start.setDate(end.getDate() - 6);
                                                setEndDate(end.toISOString().split('T')[0]);
                                                setStartDate(start.toISOString().split('T')[0]);
                                            }}
                                            className="flex-1 bg-white/5 border-border/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 hover:text-primary"
                                        >
                                            {t('aiSummary.7Days')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const end = new Date();
                                                const start = new Date();
                                                start.setDate(end.getDate() - 29);
                                                setEndDate(end.toISOString().split('T')[0]);
                                                setStartDate(start.toISOString().split('T')[0]);
                                            }}
                                            className="flex-1 bg-white/5 border-border/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 hover:text-primary"
                                        >
                                            {t('aiSummary.30Days')}
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t('aiSummary.rangeStart')}</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                                            className="bg-black/20 border-border/20 rounded-xl h-12 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t('aiSummary.rangeEnd')}</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                                            className="bg-black/20 border-border/20 rounded-xl h-12 focus:ring-primary/20"
                                        />
                                    </div>
                                    <Button
                                        className="w-full tech-button-primary h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
                                        onClick={handleGenerate}
                                        disabled={generating}
                                    >
                                        {generating ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>{t('aiSummary.synthesizing')}</span>
                                            </div>
                                        ) : (
                                            t('aiSummary.executeSynthesis')
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card rounded-3xl border-border/20 h-full overflow-hidden flex flex-col bg-white/5">
                            <SummaryHistory reports={reports} onSelectReport={handleSelectReport} onDelete={handleDeleteReport} />
                        </div>
                    )}
                </div>

                {/* Report View Panel */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <button
                            onClick={() => setIsSetupCollapsed(!isSetupCollapsed)}
                            className="p-2.5 rounded-xl bg-white/5 border border-border/10 hover:bg-white/10 transition-all text-muted-foreground hover:text-foreground active:scale-95"
                            title={isSetupCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {isSetupCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                        </button>

                        {currentReport && (
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-muted-foreground uppercase bg-white/5 px-3 py-1.5 rounded-lg border border-border/10">
                                    {t('aiSummary.reportId')}: {currentReport.id}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 glass-card rounded-[32px] border-border/20 relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tech-cyan via-tech-indigo to-tech-rose opacity-50" />

                        {currentReport ? (
                            <div className="flex-1 overflow-hidden p-1">
                                <SummaryView report={currentReport} onReportUpdated={handleReportUpdate} />
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                                <div className="p-8 bg-white/5 rounded-full border border-white/5 relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                    <Loader2 className={`w-16 h-16 text-muted-foreground/20 relative ${generating ? 'animate-spin' : ''}`} />
                                </div>
                                <div className="space-y-2 max-w-sm relative">
                                    <h3 className="text-xl font-bold tracking-tight">{t('aiSummary.intelligenceFeedEmpty')}</h3>
                                    <p className="text-muted-foreground font-medium text-sm">
                                        {generating
                                            ? t('aiSummary.processingMessage')
                                            : t('aiSummary.awaitingParameters')
                                        }
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
