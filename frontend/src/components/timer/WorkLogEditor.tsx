import { useState, type ClipboardEvent } from 'react';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { Bot, Image as ImageIcon, Eye, Edit2 } from 'lucide-react';

interface WorkLogEditorProps {
    initialContent?: string;
    onUpdate: (content: string) => void;
}

export function WorkLogEditor({ initialContent = '', onUpdate }: WorkLogEditorProps) {
    const [content, setContent] = useState(initialContent);
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [isUploading, setIsUploading] = useState(false);


    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                setIsUploading(true);
                const blob = items[i].getAsFile();

                // TODO: Upload to backend
                // For MVP, just encode base64 to show it works immediately locally
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    // Markdown image syntax
                    const imageMarkdown = `\n![Pasted Image](${base64}) \n`;
                    const newContent = content + imageMarkdown;
                    setContent(newContent);
                    onUpdate(newContent);
                    setIsUploading(false);
                };
                reader.readAsDataURL(blob!);
                return;
            }
        }
    };

    const handleAiFix = async () => {
        if (!content) return;

        try {
            // Assuming sessionData is available in scope or passed as prop
            const sessionData = {}; // Placeholder for sessionData
            const res = await api.post<any>('/timer/log/refine', {
                content: content,
                session_data: sessionData
            });
            setContent(res.refined_content);
            onUpdate(res.refined_content); // Ensure onUpdate is called with new content
        } catch (e) {
            console.error(e);
        } finally {

        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        onUpdate(e.target.value);
    };

    return (
        <div className="flex flex-col h-full border rounded-md overflow-hidden bg-card">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                <div className="flex gap-1">
                    <button
                        onClick={() => setMode('edit')}
                        className={`p - 1.5 rounded transition - colors ${mode === 'edit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'} `}
                        title="Edit"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`p - 1.5 rounded transition - colors ${mode === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'} `}
                        title="Preview"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex gap-1">
                    <button className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-background/50">
                        <ImageIcon className="w-3 h-3" />
                        <span>Add Image</span>
                    </button>
                    <button
                        onClick={handleAiFix}
                        disabled={isUploading}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary/80 rounded hover:bg-primary/10 disabled:opacity-50"
                    >
                        <Bot className="w-3 h-3" />
                        <span>{isUploading ? 'Fixing...' : 'AI Fix'}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative min-h-[150px]">
                {mode === 'edit' ? (
                    <textarea
                        value={content}
                        onChange={handleChange}
                        onPaste={handlePaste}
                        className="w-full h-full p-3 resize-none focus:outline-none bg-background text-foreground font-mono text-sm"
                        placeholder="Type work log here... (supports Markdown, Paste Image)"
                    />
                ) : (
                    <div className="w-full h-full p-3 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                )}
                {isUploading && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <span className="text-sm font-medium">Processing Image...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
