import { Home, Clock, Settings, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Sidebar() {
    const location = useLocation();
    const navItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/" },
        { icon: Clock, label: "Time Log", href: "/time-log" },
        { icon: Settings, label: "Settings", href: "/settings" },
    ];

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
                </div>
            </div>
        </aside>
    );
}
