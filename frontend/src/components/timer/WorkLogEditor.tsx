import { useState, useRef, useEffect, type ClipboardEvent } from 'react';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon, Eye, Edit2, Send, Sparkles, Wand2, X } from 'lucide-react';

interface WorkLogEditorProps {
    initialContent?: string;
    onUpdate: (content: string) => void;
    onSubmit?: (content: string) => void;
}

export function WorkLogEditor({ initialContent = '', onUpdate, onSubmit }: WorkLogEditorProps) {
    const [content, setContent] = useState(initialContent);
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Initial content sync
    useEffect(() => {
        setContent(initialContent);
        setHasUnsavedChanges(false);
    }, [initialContent]);

    // Floating Widget State
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0, text: '' });
    const [showFloatingWidget, setShowFloatingWidget] = useState(false);
    // const [floatingPos, setFloatingPos] = useState({ top: 0, left: 0 }); // Future implementation
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiResult, setAiResult] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                setIsUploading(true);
                const blob = items[i].getAsFile();

                // TODO: Upload to backend
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    const imageMarkdown = `\n![Pasted Image](${base64}) \n`;
                    const newContent = content + imageMarkdown;
                    setContent(newContent);
                    setHasUnsavedChanges(true); // Mark as unsaved
                    setIsUploading(false);
                    // Also invoke local update if needed, but we wanted to stop auto-save.
                };
                reader.readAsDataURL(blob!);
                return;
            }
        }
    };

    // We keep handleSave as alternative manual save or just sync
    const handleSave = async () => {
        if (!hasUnsavedChanges) return;
        setIsSubmitting(true); // Re-use submitting state spinner
        try {
            await onUpdate(content); // Call parent update which calls API
            setHasUnsavedChanges(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!onSubmit) {
            // If no submit handler, fallback to save
            await handleSave();
            return;
        }
        setIsSubmitting(true);
        try {
            // First ensure we save draft
            await onUpdate(content);
            // Then submit
            await onSubmit(content);
            setHasUnsavedChanges(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateLog = async () => {
        setIsAiProcessing(true);
        try {
            // Basic context - enhancement could be passing more props
            const res = await api.post<any>('/timer/log/generate', {
                issue_id: 0, // Should come from props if available generally
                issue_subject: "Task",
            });

            if (res.content) {
                setContent(prev => prev + (prev ? '\n\n' : '') + res.content);
                setHasUnsavedChanges(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSelect = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (textarea.selectionStart !== textarea.selectionEnd) {
            const text = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
            if (text.trim().length > 0) {
                // Calculate position - rough approximation relative to textarea
                // For a real floating widget, we might need a more complex library or measurement 
                // But simply putting it near the top of the textarea or fixed is a start.
                // Let's try to position it relative to the container for now.

                // Better UX: Show it fixed above the textarea or use a portal. 
                // For MVP, lets show it "at the top of the selection" logic implies tracking caret coordinates which is hard in textarea.
                // We will verify "floating window" roughly by centering it or placing it near cursor if possible.
                // Simpler: Show it as a overlay "Context Menu" style near the mouse or just fixed absolute.

                setSelection({ start: textarea.selectionStart, end: textarea.selectionEnd, text });
                setShowFloatingWidget(true);
                // We rely on CSS absolute positioning for the widget, maybe centered horizontally?
            }
        } else {
            // Dismiss if no selection
            setShowFloatingWidget(false);
        }
    };

    const submitAiEdit = async () => {
        if (!aiInstruction || !selection.text) return;
        setIsAiProcessing(true);
        try {
            const res = await api.post<any>('/timer/log/refine-selection', {
                selection: selection.text,
                instruction: aiInstruction
            });
            setAiResult(res.content);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const applyAiEdit = (action: 'replace' | 'insert') => {
        const newText = action === 'replace' ? aiResult : selection.text + '\n' + aiResult;
        const before = content.substring(0, selection.start);
        const after = content.substring(selection.end);

        setContent(before + newText + after);
        setHasUnsavedChanges(true);
        resetFloatingWidget();
    };

    const resetFloatingWidget = () => {
        setShowFloatingWidget(false);
        setAiInstruction('');
        setAiResult('');
        setSelection({ start: 0, end: 0, text: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        setHasUnsavedChanges(true);
    };

    return (
        <div className="flex flex-col h-full border rounded-md overflow-hidden bg-card relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                <div className="flex gap-1">
                    <button
                        onClick={() => setMode('edit')}
                        className={`p-1.5 rounded transition-colors ${mode === 'edit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                        title="Edit"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`p-1.5 rounded transition-colors ${mode === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                        title="Preview"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={handleGenerateLog}
                        disabled={isAiProcessing}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"
                        title="Auto-generate log content"
                    >
                        <Wand2 className="w-3 h-3" />
                        <span>Generate</span>
                    </button>

                    <button className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-background/50">
                        <ImageIcon className="w-3 h-3" />
                        <span>Image</span>
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-all bg-primary text-primary-foreground hover:bg-primary/90`}
                    >
                        {isSubmitting ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send className="w-3 h-3" />
                        )}
                        <span>送出</span>
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative min-h-[150px]">
                {mode === 'edit' ? (
                    <div className="relative w-full h-full">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            onPaste={handlePaste}
                            onSelect={handleSelect}
                            className="w-full h-full p-3 resize-none focus:outline-none bg-background text-foreground font-mono text-sm"
                            placeholder="Type work log here... (Select text for AI edits)"
                        />

                        {/* Floating AI Widget */}
                        {showFloatingWidget && (
                            <div className="absolute top-4 right-4 z-10 w-80 bg-background border rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-1 text-xs font-semibold text-purple-600">
                                        <Sparkles className="w-3 h-3" />
                                        <span>AI Edit ({selection.text.length} chars)</span>
                                    </div>
                                    <button onClick={resetFloatingWidget} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>

                                {!aiResult ? (
                                    <div className="space-y-2">
                                        <input
                                            value={aiInstruction}
                                            onChange={e => setAiInstruction(e.target.value)}
                                            placeholder="Ask AI (e.g., 'Make shorter', 'Translate')..."
                                            className="w-full text-sm px-2 py-1 border rounded"
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && submitAiEdit()}
                                        />
                                        <button
                                            onClick={submitAiEdit}
                                            disabled={isAiProcessing || !aiInstruction}
                                            className="w-full bg-purple-600 text-white text-xs py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                                        >
                                            {isAiProcessing ? 'Thinking...' : 'Run AI'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="bg-muted p-2 rounded text-xs max-h-32 overflow-auto">
                                            {aiResult}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => applyAiEdit('replace')}
                                                className="flex-1 bg-primary text-primary-foreground text-xs py-1 rounded hover:bg-primary/90"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                onClick={() => applyAiEdit('insert')}
                                                className="flex-1 border text-xs py-1 rounded hover:bg-muted"
                                            >
                                                Insert
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
