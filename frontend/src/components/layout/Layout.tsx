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
        <div className="flex h-screen w-full bg-background overflow-hidden">
            <Sidebar />
            <main className={`flex-1 overflow-auto p-6 md:p-8 ${isFullWidth ? '' : ''}`}>
                <div className={`mx-auto space-y-8 ${isFullWidth ? 'w-full h-full' : 'max-w-6xl'}`}>
                    {children}
                </div>
            </main>
            <FloatingTimer />
        </div>
    );
}
