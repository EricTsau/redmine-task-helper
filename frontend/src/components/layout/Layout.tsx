import { Sidebar } from "./Sidebar";
import { FloatingTimer } from "../timer/FloatingTimer";
import { useLocation } from "react-router-dom";

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const isFullWidthObj = ["/ai-planner", "/gantt", "/ai-summary"];
    const isFullWidth = isFullWidthObj.some(path => location.pathname.startsWith(path));

    return (
        <div className="flex h-screen w-full bg-modern-app overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <div className={`flex-1 overflow-auto p-6 md:p-8 ${isFullWidth ? 'w-full h-full' : 'mx-auto w-full max-w-7xl'}`}>
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 h-full">
                        {children}
                    </div>
                </div>
            </main>
            <FloatingTimer />
        </div>
    );
}
