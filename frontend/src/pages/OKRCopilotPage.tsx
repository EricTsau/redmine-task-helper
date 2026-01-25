import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AICopilotFloating } from "@/components/ai-chat/AICopilotFloating";
import {
    Target,
    Calendar,
    Download,
    RefreshCw,
    Image as ImageIcon,
    FileText,
    Presentation,
    FileType,
    Loader2,
    CheckCircle2,
    Copy,
    Check,
} from "lucide-react";

type QuickOption = "7days" | "14days" | "30days" | "custom";
type ExportFormat = "pptx" | "pdf" | "md";

interface DataPreview {
    completed_issues: number;
    in_progress_issues: number;  // 新增：進行中的 issues
    gitlab_commits: number;
    gitlab_releases: number;
    available_images: { url: string; caption: string; issue_id?: number }[];
}

const SecureImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
    const [blobUrl, setBlobUrl] = useState<string>("");

    useEffect(() => {
        let active = true;
        const fetchImage = async () => {
            if (!src) return;
            try {
                // Pass undefined for params, { responseType: 'blob' } for options
                const response = await api.get(src, undefined, { responseType: 'blob' });
                if (active) {
                    // Safety check: ensure response is a Blob
                    // If error occurs, api.get might throw or return generic object depending on api impl,
                    // but with responseType='blob' fix in api.ts, it should return Blob on success.
                    // If it returns text/json due to error, we should handle it.
                    if (response instanceof Blob) {
                        const url = URL.createObjectURL(response);
                        setBlobUrl(url);
                    } else if ((response as any).data instanceof Blob) {
                        const url = URL.createObjectURL((response as any).data);
                        setBlobUrl(url);
                    } else {
                        // On 204 or fallback, we might get empty object
                        console.warn("SecureImage received non-blob data", response);
                    }
                }
            } catch (err) {
                console.error("Failed to load secure image:", src, err);
            }
        };
        fetchImage();
        return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
    }, [src]);

    if (!blobUrl) return <div className={`bg-gray-200 animate-pulse ${className}`} />;

    return <img src={blobUrl} alt={alt} className={className} />;
};

export function OKRCopilotPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // Time picker state
    const [quickOption, setQuickOption] = useState<QuickOption>("7days");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Data preview state
    const [preview, setPreview] = useState<DataPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Selected images for gallery
    const [selectedImages, setSelectedImages] = useState<string[]>([]);

    // Export state - support multiple formats
    const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>(["md"]);
    const [generating, setGenerating] = useState(false);
    const [reportMarkdown, setReportMarkdown] = useState<string>("");
    const [copied, setCopied] = useState(false);

    // Get context data for AI Copilot
    const getContextData = useCallback(() => ({
        start_date: startDate,
        end_date: endDate,
        report_markdown: reportMarkdown,
        preview_data: preview,
        selected_images: selectedImages,
    }), [startDate, endDate, reportMarkdown, preview, selectedImages]);

    // Calculate dates based on quick option
    useEffect(() => {
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        setEndDate(formatDate(today));

        let start = new Date();
        switch (quickOption) {
            case "7days":
                start.setDate(today.getDate() - 7);
                break;
            case "14days":
                start.setDate(today.getDate() - 14);
                break;
            case "30days":
                start.setDate(today.getDate() - 30);
                break;
            case "custom":
                // Keep current values
                return;
        }
        setStartDate(formatDate(start));
    }, [quickOption]);

    // Fetch data preview when dates change
    useEffect(() => {
        if (startDate && endDate && quickOption !== "custom") {
            fetchPreview();
        }
    }, [startDate, endDate]);

    const fetchPreview = async () => {
        if (!startDate || !endDate) return;

        setLoadingPreview(true);
        try {
            const data = await api.post<DataPreview>("/api/okr-copilot/preview", {
                start_date: startDate,
                end_date: endDate,
            });
            setPreview(data);
        } catch (error) {
            console.error("Failed to fetch preview:", error);
            // Set empty preview on error
            setPreview({
                completed_issues: 0,
                in_progress_issues: 0,
                gitlab_commits: 0,
                gitlab_releases: 0,
                available_images: [],
            });
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            showToast(t("okrCopilot.selectDateRange"), "warning");
            return;
        }
        if (selectedFormats.length === 0) {
            showToast(t("okrCopilot.selectFormat"), "warning");
            return;
        }

        setGenerating(true);
        try {
            // Generate for each selected format
            for (const format of selectedFormats) {
                const data = await api.post<{ download_url?: string; markdown?: string }>("/api/okr-copilot/generate", {
                    start_date: startDate,
                    end_date: endDate,
                    format: format,
                    selected_images: selectedImages,
                });

                if (data.download_url) {
                    try {
                        const blob = await api.get<Blob>(data.download_url, undefined, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        // Extract filename from the URL if possible, or use a default
                        const filename = data.download_url.split('/').pop() || `report.${format}`;
                        link.setAttribute('download', filename);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } catch (err) {
                        console.error("Download failed", err);
                        showToast(t("okrCopilot.downloadFailed"), "error");
                    }
                } else if (data.markdown) {
                    setReportMarkdown(data.markdown);
                }
            }
            showToast(t("okrCopilot.generateSuccess"), "success");
        } catch (error) {
            console.error("Failed to generate report:", error);
            showToast(t("okrCopilot.generateFailed"), "error");
        } finally {
            setGenerating(false);
        }
    };

    const toggleImageSelection = (url: string) => {
        setSelectedImages((prev) =>
            prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
        );
    };

    const toggleFormatSelection = (format: ExportFormat) => {
        setSelectedFormats((prev) =>
            prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
        );
    };

    const quickOptions: { key: QuickOption; label: string }[] = [
        { key: "7days", label: t("okrCopilot.quickOptions.7days") },
        { key: "14days", label: t("okrCopilot.quickOptions.14days") },
        { key: "30days", label: t("okrCopilot.quickOptions.30days") },
        { key: "custom", label: t("okrCopilot.quickOptions.custom") },
    ];

    const exportOptions: { key: ExportFormat; label: string; icon: React.ReactNode }[] = [
        { key: "pptx", label: t("okrCopilot.export.pptx"), icon: <Presentation className="w-4 h-4" /> },
        { key: "pdf", label: t("okrCopilot.export.pdf"), icon: <FileType className="w-4 h-4" /> },
        { key: "md", label: t("okrCopilot.export.markdown"), icon: <FileText className="w-4 h-4" /> },
    ];

    // History state
    const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch history
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await api.get<any[]>("/api/okr-copilot/reports");
            setHistory(data);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            showToast(t("okrCopilot.history.fetchFailed"), "error");
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (activeTab === "history") {
            fetchHistory();
        }
    }, [activeTab]);

    const handleDownloadHistory = async (report: any) => {
        try {
            const url = `/api/okr-copilot/reports/${report.id}/download`;
            const blob = await api.get<Blob>(url, undefined, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', report.filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed", err);
            showToast(t("okrCopilot.downloadFailed"), "error");
        }
    };

    const handleDeleteHistory = async (id: number) => {
        if (!confirm(t("okrCopilot.history.confirmDelete"))) return;
        try {
            await api.delete(`/api/okr-copilot/reports/${id}`);
            showToast(t("okrCopilot.history.deleteSuccess"), "success");
            setHistory(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Delete failed", err);
            showToast(t("okrCopilot.history.deleteFailed"), "error");
        }
    };

    return (
        <div className="min-h-screen bg-background p-6">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                        <Target className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {t("okrCopilot.title")}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t("okrCopilot.subtitle")}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setActiveTab("generate")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "generate"
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }`}
                    >
                        {t("okrCopilot.tabs.generate")}
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "history"
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }`}
                    >
                        {t("okrCopilot.tabs.history")}
                    </button>
                </div>
            </div>

            {activeTab === "generate" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Time Picker & Export Options */}
                    <div className="space-y-6">
                        {/* Time Picker Card */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold text-foreground">
                                    {t("aiSummary.reportParameters")}
                                </h2>
                            </div>

                            {/* Quick Options */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {quickOptions.map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setQuickOption(opt.key)}
                                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${quickOption === opt.key
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Date Range */}
                            {quickOptions.find(o => o.key === quickOption)?.key === "custom" && (
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">
                                            {t("aiSummary.rangeStart")}
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">
                                            {t("aiSummary.rangeEnd")}
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Preview Button - always visible */}
                            <button
                                onClick={fetchPreview}
                                disabled={loadingPreview || !startDate || !endDate}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingPreview ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {t("common.preview")}
                            </button>
                        </div>

                        {/* Export Options Card */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-4">
                                <Download className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold text-foreground">
                                    {t("okrCopilot.export.title")}
                                </h2>
                            </div>

                            <div className="space-y-2 mb-4">
                                {exportOptions.map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => toggleFormatSelection(opt.key)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${selectedFormats.includes(opt.key)
                                            ? "bg-primary/20 text-primary border border-primary/30"
                                            : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
                                            }`}
                                    >
                                        {opt.icon}
                                        {opt.label}
                                        {selectedFormats.includes(opt.key) && (
                                            <CheckCircle2 className="w-4 h-4 ml-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerateReport}
                                disabled={generating || !startDate || !endDate || selectedFormats.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        {t("okrCopilot.ai.generating")}
                                    </>
                                ) : (
                                    <>
                                        <Target className="w-5 h-5" />
                                        {t("okrCopilot.ai.generateReport")}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Middle Column: Data Preview */}
                    <div className="space-y-6">
                        {/* Stats Preview */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold text-foreground">
                                    {t("okrCopilot.preview.title")}
                                </h2>
                            </div>

                            {loadingPreview ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">
                                        {t("okrCopilot.loadingPreview")}
                                    </span>
                                </div>
                            ) : preview ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                        <div className="text-2xl font-bold text-green-400">
                                            {preview.completed_issues}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("okrCopilot.preview.completedIssues")}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                        <div className="text-2xl font-bold text-yellow-400">
                                            {preview.in_progress_issues}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("okrCopilot.preview.inProgressIssues")}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                        <div className="text-2xl font-bold text-blue-400">
                                            {preview.gitlab_commits}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("okrCopilot.preview.gitlabCommits")}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                        <div className="text-2xl font-bold text-purple-400">
                                            {preview.gitlab_releases}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("okrCopilot.preview.gitlabReleases")}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <div className="text-2xl font-bold text-amber-400">
                                            {preview.available_images.length}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("okrCopilot.preview.availableImages")}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>{t("okrCopilot.selectDateRange")}</p>
                                </div>
                            )}
                        </div>

                        {/* Image Gallery */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-4">
                                <ImageIcon className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold text-foreground">
                                    {t("okrCopilot.gallery.title")}
                                </h2>
                            </div>

                            {preview?.available_images && preview.available_images.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {preview.available_images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => toggleImageSelection(img.url)}
                                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedImages.includes(img.url)
                                                ? "border-primary ring-2 ring-primary/50"
                                                : "border-transparent hover:border-white/20"
                                                }`}
                                        >
                                            <SecureImage
                                                src={`/ai-summary/image-proxy?url=${encodeURIComponent(img.url)}`}
                                                alt={img.caption || `Image ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {selectedImages.includes(img.url) && (
                                                <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                                    <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>{t("okrCopilot.gallery.noImages")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Report Preview */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 h-fit">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-foreground">
                                {t("okrCopilot.reportPreview")}
                            </h2>
                        </div>

                        {reportMarkdown ? (
                            <div className="space-y-4">
                                {/* Copy button */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(reportMarkdown);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
                                    >
                                        {copied ? (
                                            <><Check className="w-4 h-4 text-green-400" /> {t("common.copied")}</>
                                        ) : (
                                            <><Copy className="w-4 h-4" /> {t("common.copy")}</>
                                        )}
                                    </button>
                                </div>
                                {/* Rendered Markdown */}
                                <div className="prose prose-invert prose-sm max-w-none bg-white/5 p-6 rounded-xl overflow-auto max-h-[600px] prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-table:text-muted-foreground">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            img: ({ ...props }) => (
                                                <img {...props} className="max-w-full rounded border border-white/10 my-2" loading="lazy" />
                                            ),
                                            table: ({ ...props }) => (
                                                <table {...props} className="border-collapse border border-white/20 my-4" />
                                            ),
                                            th: ({ ...props }) => (
                                                <th {...props} className="border border-white/20 px-3 py-2 bg-white/5" />
                                            ),
                                            td: ({ ...props }) => (
                                                <td {...props} className="border border-white/20 px-3 py-2" />
                                            ),
                                        }}
                                    >
                                        {reportMarkdown}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium mb-2">{t("okrCopilot.noData")}</p>
                                <p className="text-sm">{t("okrCopilot.selectDateRange")}</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* History View */
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-6">
                            <RefreshCw className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-foreground flex-1">
                                {t("okrCopilot.history.title")}
                            </h2>
                            <button
                                onClick={fetchHistory}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                title={t("common.refresh")}
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : history.length > 0 ? (
                            <div className="space-y-3">
                                {history.map((report) => (
                                    <div
                                        key={report.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                                                {report.report_type === 'md' ? <FileText className="w-5 h-5" /> :
                                                    report.report_type === 'pdf' ? <FileType className="w-5 h-5" /> :
                                                        <Presentation className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-foreground">{report.filename}</h3>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(report.created_at).toLocaleString()}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{report.start_date} ~ {report.end_date}</span>
                                                    {report.meta_data?.status_color && (
                                                        <>
                                                            <span>•</span>
                                                            <div className={`w-2 h-2 rounded-full ${report.meta_data.status_color === 'green' ? 'bg-green-400' :
                                                                report.meta_data.status_color === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                                                                }`} />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleDownloadHistory(report)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors"
                                                title={t("common.download")}
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteHistory(report.id)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                title={t("common.delete")}
                                            >
                                                <span className="sr-only">{t("common.delete")}</span>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="w-4 h-4"
                                                >
                                                    <path d="M3 6h18" />
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium mb-2">{t("okrCopilot.history.noReports")}</p>
                            </div>
                        )}

                        <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300 flex items-start gap-3">
                            <div className="p-1 rounded-full bg-blue-500/20 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            </div>
                            <div>
                                <p className="font-medium mb-1">{t("okrCopilot.history.noteTitle")}</p>
                                <p className="opacity-90">{t("okrCopilot.history.noteDesc")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Copilot Floating Window */}
            <AICopilotFloating
                contextType="okr_copilot"
                getContextData={getContextData}
            />
        </div>
    );
}



export default OKRCopilotPage;
