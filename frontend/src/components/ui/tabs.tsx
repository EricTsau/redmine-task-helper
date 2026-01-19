import * as React from "react"
import { cn } from "@/lib/utils"

// Since we don't know if radix tabs is installed, we can check package.json or assume it is based on imports.
// package.json showed @radix-ui/react-slot but not tabs.
// However, creating a full custom tab component is safer if dependency is missing.
// I will create a simple custom Tab implementation that looks like shadcn without radix dependency if possible, or just install it.
// Checking imports earlier: I saw imports, I assumed they existed.
// Let's implement a simple custom Tab context for now to avoid installing more deps if not needed, 
// OR just implement simple state-driven tabs. 
// BUT `AIWorkSummaryPage` uses `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`.
// I'll implement a simple version that mimics the API.

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
} | null>(null)

const Tabs = ({ value, onValueChange, children, className }: any) => {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    )
}

const TabsList = ({ className, children }: any) => (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
        {children}
    </div>
)

const TabsTrigger = ({ value, children, className }: any) => {
    const context = React.useContext(TabsContext)
    if (!context) return null
    const isActive = context.value === value
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-background text-foreground shadow-sm",
                className
            )}
            onClick={() => context.onValueChange(value)}
        >
            {children}
        </button>
    )
}

const TabsContent = ({ value, children, className }: any) => {
    const context = React.useContext(TabsContext)
    if (!context || context.value !== value) return null
    return (
        <div
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
        >
            {children}
        </div>
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
