import { useState, useEffect, useCallback } from 'react';
import { Command, Search, Clock, LayoutDashboard, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface CommandItem {
    id: string;
    title: string;
    icon: React.ReactNode;
    action: () => void;
    category: 'navigation' | 'action' | 'search';
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const navigate = useNavigate();

    const staticCommands: CommandItem[] = [
        { id: 'nav-dashboard', title: 'Go to Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigate('/'), category: 'navigation' },
        { id: 'nav-settings', title: 'Go to Settings', icon: <Settings className="h-4 w-4" />, action: () => navigate('/settings'), category: 'navigation' },
        { id: 'nav-timelog', title: 'Go to Time Log', icon: <Clock className="h-4 w-4" />, action: () => navigate('/time-log'), category: 'navigation' },
    ];

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setOpen(prev => !prev);
        }
        if (e.key === 'Escape') {
            setOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleSelect = (item: CommandItem) => {
        item.action();
        setOpen(false);
        setQuery('');
    };

    const filteredCommands = staticCommands.filter(cmd =>
        cmd.title.toLowerCase().includes(query.toLowerCase())
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <div
                className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg bg-background border rounded-lg shadow-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center border-b px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search commands or issues..."
                        className="flex-1 px-3 py-3 bg-transparent outline-none text-sm"
                        autoFocus
                    />
                    <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-80 overflow-auto p-2">
                    {filteredCommands.map(cmd => (
                        <button
                            key={cmd.id}
                            onClick={() => handleSelect(cmd)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-muted text-left"
                        >
                            {cmd.icon}
                            {cmd.title}
                        </button>
                    ))}
                    {filteredCommands.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-4">No results found</div>
                    )}
                </div>
                <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd>
                    <span>to toggle</span>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">ESC</kbd>
                    <span>to close</span>
                </div>
            </div>
        </div>
    );
}
