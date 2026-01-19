import React, { useState, useEffect } from "react";
import { SummaryConfig } from "@/components/ai-summary/SummaryConfig";
import { SummaryView } from "@/components/ai-summary/SummaryView";
import { SummaryHistory } from "@/components/ai-summary/SummaryHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { Loader2 } from "lucide-react";

export default function AIWorkSummaryPage() {
    const { token } = useAuth();
    const { showError } = useToast();

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
            showError("請選擇開始日期");
            return;
        }
        setGenerating(true);
        try {
            const res = await api.post("/ai-summary/generate", {
                start_date: startDate,
                end_date: endDate || undefined // let backend handle default
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentReport(res as any);
            fetchHistory(); // Refresh list
        } catch (error) {
            showError("生成失敗，請檢查設定或稍後再試");
        } finally {
            setGenerating(false);
        }
    };

    const handleSelectReport = (id: number) => {
        // Find existing or fetch details
        // Since list response has full markdown (wait, implementation details: router sends full markdown in list? yes.)
        const r = reports.find(item => item.id === id);
        if (r) {
            setCurrentReport(r);
        }
    };

    return (
        <div className="container mx-auto p-6 h-screen flex flex-col overflow-hidden">
            <h1 className="text-3xl font-bold mb-6">AI 工作總結</h1>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mb-4">
                    <TabsTrigger value="generate">產生報告</TabsTrigger>
                    <TabsTrigger value="history">歷史紀錄</TabsTrigger>
                </TabsList>

                <TabsContent value="generate" className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    {/* Left: Config & Control */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4 overflow-y-auto pb-4">
                        <SummaryConfig onConfigSaved={() => { }} />

                        <div className="border p-4 rounded-lg bg-card text-card-foreground shadow-sm">
                            <h3 className="font-semibold mb-4">生成選項</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label>開始日期</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>結束日期 (選填，預設今天)</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleGenerate} disabled={generating}>
                                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {generating ? "生成中 (需時較長)..." : "開始生成總結"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right: View */}
                    <div className="w-full md:w-2/3 h-full overflow-hidden">
                        {currentReport ? (
                            <SummaryView report={currentReport} />
                        ) : (
                            <div className="flex h-full items-center justify-center border rounded-lg bg-muted/10 text-muted-foreground p-8 text-center">
                                {generating ? "AI 正在分析 Redmine 紀錄並撰寫報告..." : "請設定條件並點擊生成，或從歷史紀錄選取報告"}
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 flex gap-6 overflow-hidden">
                    <div className="w-1/3 overflow-y-auto">
                        <SummaryHistory reports={reports} onSelectReport={handleSelectReport} />
                    </div>
                    <div className="w-2/3 h-full overflow-hidden">
                        {currentReport ? (
                            <SummaryView report={currentReport} />
                        ) : (
                            <div className="flex h-full items-center justify-center border rounded-lg bg-muted/10 text-muted-foreground">
                                請選擇一份報告檢視
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
