import { Settings, LayoutDashboard, Shield, LogOut, Brain, PieChart, FileText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
    compact?: boolean;
}

export function Sidebar({ compact = false }: SidebarProps) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navItems = [
        { icon: LayoutDashboard, label: "My Workbench", href: "/" },
        { icon: PieChart, label: "Executive Dashboard", href: "/executive-dashboard" },
        { icon: Brain, label: "AI 專案規劃", href: "/ai-planner" },
        { icon: FileText, label: "AI 工作總結", href: "/ai-summary" },
        { icon: Settings, label: "Settings", href: "/settings" },
    ];

    if (user?.is_admin) {
        navItems.push({ icon: Shield, label: "Administration", href: "/admin" });
    }

    if (compact) {
        return (
            <aside className="hidden md:flex flex-col w-20 glass-sidebar flex-shrink-0 z-20">
                <div className="flex items-center justify-center h-20 border-b border-border/30">
                    <Link to="/" className="p-2" title="Redmine Task Helper">
                        <img src="/logo.png" alt="Logo" className="h-10 w-10 drop-shadow-glow" />
                    </Link>
                </div>
                <nav className="flex-1 flex flex-col items-center gap-4 py-6">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`relative p-3 rounded-xl transition-all duration-300 group ${isActive
                                    ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    }`}
                                title={item.label}
                            >
                                <item.icon className="h-6 w-6" />
                                {isActive && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-glow" />}
                            </Link>
                        );
                    })}
                    <button
                        onClick={logout}
                        className="p-3 mt-auto rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={`Logout ${user?.full_name || user?.username || ''}`}
                    >
                        <LogOut className="h-6 w-6" />
                    </button>
                </nav>
            </aside>
        );
    }

    return (
        <aside className="hidden md:block w-72 glass-sidebar flex-shrink-0 z-20 overflow-hidden">
            <div className="flex h-full flex-col">
                <div className="flex h-20 items-center border-b border-border/30 px-6">
                    <Link to="/" className="flex items-center gap-3 font-bold text-lg tracking-tight">
                        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                            <img src="/logo.png" alt="Logo" className="h-6 w-6" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Redmine Helper</span>
                    </Link>
                </div>
                <div className="flex-1 flex flex-col py-6">
                    <nav className="flex flex-col px-4 gap-2">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={`flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 relative group overflow-hidden ${isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                                        }`}
                                >
                                    <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-primary" : ""}`} />
                                    <span>{item.label}</span>
                                    {isActive && (
                                        <>
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-glow" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
                                        </>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto px-4 pb-6">
                        <div className="glass-card p-4 rounded-2xl border-border/30 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Shield className="h-12 w-12" />
                            </div>
                            <div className="flex flex-col space-y-3 relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground truncate">
                                        {user?.full_name || user?.username || 'Redmine User'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Active Session</span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground text-sm font-bold transition-all duration-300 border border-destructive/20 active:scale-95"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
