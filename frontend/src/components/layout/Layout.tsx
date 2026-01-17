import { Sidebar } from "./Sidebar";
import { FloatingTimer } from "../timer/FloatingTimer";

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6 md:p-8">
                <div className="mx-auto max-w-6xl space-y-8">
                    {children}
                </div>
            </main>
            <FloatingTimer />
        </div>
    );
}
