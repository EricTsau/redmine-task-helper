import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface RewriteButtonProps {
    text: string;
    onRewrite: (rewritten: string) => void;
}

export function RewriteButton({ text, onRewrite }: RewriteButtonProps) {
    const [loading, setLoading] = useState(false);
    const [style, setStyle] = useState<'professional' | 'casual' | 'formal' | 'concise'>('professional');

    const handleRewrite = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai/rewrite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, style })
            });
            if (res.ok) {
                const data = await res.json();
                onRewrite(data.rewritten);
            }
        } catch (e) {
            console.error('Rewrite failed', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <select
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
                className="text-xs border rounded px-2 py-1 bg-background"
            >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="concise">Concise</option>
            </select>
            <button
                onClick={handleRewrite}
                disabled={loading || !text.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Rewrite
            </button>
        </div>
    );
}
