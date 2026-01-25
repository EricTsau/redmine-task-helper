import { useState, useEffect } from "react";
import { Settings, LayoutDashboard, Shield, LogOut, Brain, FileText, ChevronLeft, ChevronRight, Code2, Target } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

export function Sidebar() {
    const { user, logout } = useAuth();
    const { t } = useTranslation();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', String(isCollapsed));
    }, [isCollapsed]);

    const navItems = [
        { icon: LayoutDashboard, label: t('nav.workbench'), href: "/" },
        // { icon: PieChart, label: t('nav.executiveDashboard'), href: "/executive-dashboard" },
        { icon: Brain, label: t('nav.aiPlanner'), href: "/ai-planner" },
        { icon: FileText, label: t('nav.aiSummary'), href: "/ai-summary" },
        { icon: Target, label: t('nav.okrCopilot'), href: "/okr-copilot" },
        { icon: Code2, label: "GitLab", href: "/gitlab-dashboard" },
        { icon: Settings, label: t('nav.settings'), href: "/settings" },
    ];

    if (user?.is_admin) {
        navItems.push({ icon: Shield, label: t('nav.admin'), href: "/admin" });
    }

    return (
        <aside
            className={`hidden md:flex flex-col glass-sidebar flex-shrink-0 z-20 transition-all duration-500 ease-in-out relative group/sidebar ${isCollapsed ? "w-20" : "w-72"
                }`}
        >
            {/* Collapse Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-24 bg-primary text-primary-foreground rounded-full p-1 shadow-lg opacity-0 group-hover/sidebar:opacity-100 transition-opacity z-30"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div className="flex h-full flex-col">
                {/* Logo Area */}
                <div className={`flex h-20 items-center border-b border-white/5 px-6 ${isCollapsed ? 'justify-center' : ''}`}>
                    <Link to="/" className="flex items-center gap-3 font-bold text-lg tracking-tight">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/30 shadow-glow-primary">
                            <img src="/logo.png" alt="Logo" className="h-6 w-6 animate-pulse" />
                        </div>
                        {!isCollapsed && (
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 font-sans">
                                Redmine Helper
                            </span>
                        )}
                    </Link>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 flex flex-col py-6 overflow-y-auto overflow-x-hidden">
                    <nav className="flex flex-col px-4 gap-2">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    title={isCollapsed ? item.label : ""}
                                    className={`flex items-center rounded-xl p-3 text-sm font-semibold transition-all duration-300 relative group overflow-hidden ${isActive
                                        ? "bg-primary/20 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                        } ${isCollapsed ? 'justify-center' : 'gap-4 px-4'}`}
                                >
                                    <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-primary animate-glow" : ""}`} />
                                    {!isCollapsed && <span>{item.label}</span>}

                                    {isActive && (
                                        <>
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-glow-primary" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                                        </>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Info & Logout */}
                    <div className="mt-auto px-4 pb-6">
                        <div className={`glass-card p-4 rounded-2xl border-white/10 relative overflow-hidden group/user ${isCollapsed ? 'flex justify-center p-2' : ''
                            }`}>
                            {!isCollapsed ? (
                                <div className="flex flex-col space-y-3 relative z-10 text-xs">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-foreground truncate">
                                            {user?.full_name || user?.username || 'Redmine User'}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Active Member</span>
                                    </div>
                                    <button
                                        onClick={logout}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all duration-300 border border-destructive/20 active:scale-95"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span className="font-bold">{t('nav.signOut')}</span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={logout}
                                    title={`Logout ${user?.username}`}
                                    className="p-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300 animate-in fade-in zoom-in"
                                >
                                    <LogOut className="h-6 w-6" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
