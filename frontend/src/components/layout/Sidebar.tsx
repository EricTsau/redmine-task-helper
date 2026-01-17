import { Home, Settings, LayoutDashboard, Shield, LogOut, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
    compact?: boolean;
}

export function Sidebar({ compact = false }: SidebarProps) {
    const { user, logout } = useAuth();
    const navItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/" },
        { icon: Brain, label: "AI 專案規劃", href: "/ai-planner" },
        { icon: Settings, label: "Settings", href: "/settings" },
    ];

    if (user?.is_admin) {
        navItems.push({ icon: Shield, label: "Administration", href: "/admin" });
    }

    if (compact) {
        return (
            <aside className="hidden md:flex flex-col w-16 bg-muted/40 border-r flex-shrink-0">
                <div className="flex items-center justify-center h-14 border-b">
                    <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Redmine Flow">
                        <Home className="h-6 w-6" />
                    </Link>
                </div>
                <nav className="flex-1 flex flex-col items-center gap-2 py-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={`p-3 rounded-lg transition-colors ${location.pathname === item.href
                                ? "bg-muted text-primary"
                                : "text-muted-foreground hover:text-primary hover:bg-muted"
                                }`}
                            title={item.label}
                        >
                            <item.icon className="h-5 w-5" />
                        </Link>
                    ))}
                    <button
                        onClick={logout}
                        className="p-3 mt-auto rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </nav>
            </aside>
        );
    }

    return (
        <aside className="hidden border-r bg-muted/40 md:block w-64 flex-shrink-0">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link to="/" className="flex items-center gap-2 font-semibold">
                        <Home className="h-6 w-6" />
                        <span className="">Redmine Flow</span>
                    </Link>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${location.pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground"
                                    }`}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-auto px-4 pb-4">
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-destructive hover:bg-destructive/10"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
