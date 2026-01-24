import { useState, useRef, useEffect, type ClipboardEvent, type ChangeEvent, forwardRef, useImperativeHandle } from 'react';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Image as ImageIcon, Eye, Edit2, Send, Sparkles, Wand2, X, Paperclip, Trash2, FileIcon, Bold, Italic, Strikethrough, Heading, Link, Quote, Code, List, ListOrdered } from 'lucide-react';
import { useFileAttachments, formatFileSize, markdownToTextile, type PendingFile } from '@/hooks/useFileAttachments';

interface UploadToken {
    filename: string;
    token: string;
    content_type: string;
}

export interface WorkLogEditorHandle {
    setMode: (mode: 'edit' | 'preview') => void;
    setContent: (content: string) => void;
    focus: () => void;
}

interface WorkLogEditorProps {
    initialContent?: string;
    issueId?: number;
    onUpdate: (content: string) => void;
    onSubmit?: (content: string) => void;
    onSubmitWithFiles?: (content: string, files: PendingFile[], uploads: UploadToken[]) => Promise<void>;

    hideSaveButton?: boolean;
    submitLabel?: string;
    placeholder?: string;
    className?: string;
}

export const WorkLogEditor = forwardRef<WorkLogEditorHandle, WorkLogEditorProps>(({
    initialContent = '',
    issueId,


    onUpdate,
    onSubmit,
    onSubmitWithFiles,
    hideSaveButton = false,
    submitLabel = '送出',
    placeholder = "Type work log here... (Ctrl+V to paste images)",
    className = ''
}, ref) => {
    const [content, setContent] = useState(initialContent);
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
        setMode: (newMode) => setMode(newMode),
        setContent: (newContent) => {
            setContent(newContent);
            onUpdate(newContent); // Sync with parent state if needed, though strictly this might be "viewing"
            // If we are setting content programmatically for preview, we might not want to trigger 'onUpdate' as a user edit?
            // But WorkLogEditor state usually reflects "what is in the box".
            // Let's assume setContent implies replacing the draft.
        },
        focus: () => textareaRef.current?.focus()
    }));

    // Image compression helper
    const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Canvas to Blob failed'));
                        }
                    }, 'image/jpeg', quality);
                };
            };
            reader.onerror = (e) => reject(e);
        });
    };


    // File attachments
    const { pendingFiles, addFile, removeFile, clearFiles, getFileById } = useFileAttachments();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Initial content sync
    useEffect(() => {
        // Only update if initialContent changes meaningfully and we aren't dirty?
        // Or if parent forces it.
        // For simple usage, we sync.
        if (initialContent !== content && !hasUnsavedChanges) {
            setContent(initialContent);
        }
    }, [initialContent]);

    // Floating Widget State
    const [selection, setSelection] = useState({ start: 0, end: 0, text: '' });
    const [showFloatingWidget, setShowFloatingWidget] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiResult, setAiResult] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        setError(null);
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                let file = items[i].getAsFile();
                if (!file) continue;

                // Compress if it's too large or just always compress for web to be safe
                if (file.size > 5 * 1024 * 1024) { // > 5MB
                    try {
                        file = await compressImage(file);
                    } catch (err) {
                        console.error("Compression failed", err);
                    }
                }
                // Add to pending files
                const fileId = addFile(file);

                // Insert markdown image
                const markdownImage = `![Loading ${file.name}...](${fileId})`;
                const textarea = e.target as HTMLTextAreaElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newText = content.substring(0, start) + markdownImage + content.substring(end);

                setContent(newText);
                onUpdate(newText);
            }
        }
    };

    const insertText = (before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);

        setContent(newText);
        onUpdate(newText);

        // Restore selection / focus
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const MarkdownToolbar = () => (
        <div className="flex items-center gap-1 border-b p-1 bg-muted/20 overflow-x-auto">
            <button onClick={() => insertText('**', '**')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Bold">
                <Bold className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertText('*', '*')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Italic">
                <Italic className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertText('~~', '~~')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Strikethrough">
                <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-border mx-1" />
            <button onClick={() => insertText('# ')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Heading">
                <Heading className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertText('> ')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Quote">
                <Quote className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertText('`', '`')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Code">
                <Code className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-border mx-1" />
            <button onClick={() => insertText('- ')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Bullet List">
                <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertText('1. ')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Ordered List">
                <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-border mx-1" />
            <button onClick={() => insertText('[', '](url)')} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Link">
                <Link className="w-3.5 h-3.5" />
            </button>
        </div>
    );



    const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;

            let finalFile = file;
            if (file.size > 5 * 1024 * 1024) { // > 5MB
                try {
                    finalFile = await compressImage(file);
                } catch (err) {
                    console.error("Compression failed", err);
                }
            }

            const fileId = addFile(finalFile);
            const placeholder = `![image](pending:${fileId})`;
            setContent(prev => prev + '\n' + placeholder);
            setHasUnsavedChanges(true);
        }

        // Reset input
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            // Check for size limit (5MB as per Redmine error)
            if (file.size > 40 * 1024 * 1024) {
                setError(`檔案 ${file.name} 超過 40MB 限制，無法上傳。`);
                return;
            }

            const fileId = addFile(file);
            // Use different placeholder for non-image files
            const placeholder = file.type.startsWith('image/')
                ? `![image](pending:${fileId})`
                : `[${file.name}](attachment:${fileId})`;
            setContent(prev => prev + '\n' + placeholder);
            setHasUnsavedChanges(true);
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };


    const handleRemoveFile = (fileId: string) => {
        removeFile(fileId);
        // Also remove placeholder from content
        // Regex to match ![...](pending:<fileId>) or [...](attachment:<fileId>)
        setContent(prev => {
            // Clean up image placeholders: ![...](pending:fileId)
            let updated = prev.replace(new RegExp(`!\\[[^\\]]*\\]\\(pending:${fileId}\\)\\n?`, 'g'), '');
            // Clean up attachment placeholders: [...](attachment:fileId)
            updated = updated.replace(new RegExp(`\\[[^\\]]*\\]\\(attachment:${fileId}\\)\\n?`, 'g'), '');
            return updated;
        });
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (!hasUnsavedChanges) return;
        setIsSubmitting(true);
        try {
            await onUpdate(content);
            setHasUnsavedChanges(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!onSubmit && !onSubmitWithFiles) {
            await handleSave();
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            // If we have pending files, upload them first
            if (pendingFiles.length > 0 && onSubmitWithFiles) {
                // Upload files to Redmine
                const formData = new FormData();
                pendingFiles.forEach(pf => {
                    formData.append('files', pf.file);
                });

                // Use ApiClient.post which now supports FormData
                let uploadData;
                try {
                    uploadData = await api.post<any>('/upload/batch', formData);
                } catch (err: any) {
                    throw new Error(err.message || '上傳檔案失敗，可能是檔案太大或網路問題。');
                }

                const uploads: UploadToken[] = uploadData.uploads;

                // Build file ID to filename mapping
                const fileMapping = new Map<string, string>();
                pendingFiles.forEach((pf, index) => {
                    if (uploads[index]) {
                        fileMapping.set(pf.id, uploads[index].filename);
                    }
                });

                // Convert content to Textile
                const textileContent = markdownToTextile(content, fileMapping);

                // Submit with files
                await onSubmitWithFiles(textileContent, pendingFiles, uploads);
                clearFiles();
            } else if (onSubmit) {
                // No files, just submit content
                // Still convert to Textile for consistency
                const textileContent = markdownToTextile(content, new Map());
                await onSubmit(textileContent);
            }

            setHasUnsavedChanges(false);
        } catch (err: any) {
            console.error(err);
            setError(err.message || '送出失敗');
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleGenerateLog = async () => {
        // If we have selected text, open the AI Edit widget instead of generating new content
        if (selection.text) {
            setShowFloatingWidget(true);
            return;
        }

        setIsAiProcessing(true);
        try {
            const res = await api.post<any>('/timer/log/generate', {
                issue_id: issueId || 0,
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
                setSelection({ start: textarea.selectionStart, end: textarea.selectionEnd, text });
                // Don't show widget automatically on select anymore
                // setShowFloatingWidget(true);
            }
        } else {
            // Clear selection state and hide widget if selection is gone
            setSelection({ start: 0, end: 0, text: '' });
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
        const newValue = e.target.value;
        setContent(newValue);
        setHasUnsavedChanges(true);
        onUpdate(newValue);
    };

    // Custom image renderer for preview mode
    const renderImage = ({ src, alt }: { src?: string; alt?: string }) => {
        // Check if this is a pending file placeholder using URL scheme
        if (src && src.startsWith('pending:')) {
            const fileId = src.split('pending:')[1];
            const pendingFile = getFileById(fileId);
            if (pendingFile?.previewUrl) {
                // If we have a preview URL (blob), show it
                return (
                    <img
                        src={pendingFile.previewUrl}
                        alt={pendingFile.file.name}
                        className="max-w-full h-auto rounded border"
                    />
                );
            }
            return <span className="text-muted-foreground">[圖片載入中...]</span>;
        }

        // Fallback for old style placeholders or other images
        const pendingMatch = alt?.match(/\{\{([^}]+)\}\}/);
        if (pendingMatch && src === 'pending') {
            const fileId = pendingMatch[1];
            const pendingFile = getFileById(fileId);
            if (pendingFile?.previewUrl) {
                return (
                    <img
                        src={pendingFile.previewUrl}
                        alt={pendingFile.file.name}
                        className="max-w-full h-auto rounded border"
                    />
                );
            }
            return <span className="text-muted-foreground">[圖片載入中...]</span>;
        }

        return <img src={src} alt={alt} className="max-w-full h-auto rounded" />;
    };

    return (
        <div className={`flex flex-col h-full border rounded-md overflow-hidden bg-card relative ${className}`}>
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
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={isAiProcessing}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"
                        title={selection.text ? "AI Edit Selection" : "Auto-generate log content"}
                    >
                        <Wand2 className="w-3 h-3" />
                        <span>{selection.text ? "Edit" : "Generate"}</span>
                    </button>

                    {/* Image button */}
                    <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-background/50"
                        title="添加圖片"
                    >
                        <ImageIcon className="w-3 h-3" />
                        <span>Image</span>
                    </button>
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                    />

                    {/* Attach file button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-background/50"
                        title="附加檔案"
                    >
                        <Paperclip className="w-3 h-3" />
                        <span>Attach</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!hideSaveButton && (
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
                            <span>{submitLabel}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/15 text-destructive px-3 py-2 text-xs flex justify-between items-center border-b">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 relative min-h-[150px] flex flex-col">
                {mode === 'edit' && <MarkdownToolbar />}
                {mode === 'edit' ? (
                    <div className="relative w-full flex-1">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            onPaste={handlePaste}
                            onSelect={handleSelect}
                            className="w-full h-full p-3 resize-none focus:outline-none bg-background text-foreground font-mono text-sm"
                            placeholder={placeholder}
                        />{/* Floating AI Widget */}
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
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            urlTransform={(url) => url}
                            components={{
                                img: renderImage,
                                // Customize table styling if needed, though prose usually handles it
                                table: ({ node, ...props }) => (
                                    <table className="border-collapse table-auto w-full text-sm" {...props} />
                                ),
                                th: ({ node, ...props }) => (
                                    <th className="border px-4 py-2 font-medium bg-muted" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                    <td className="border px-4 py-2" {...props} />
                                )
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Pending Files List */}
            {pendingFiles.length > 0 && (
                <div className="border-t p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        <span>待上傳檔案 ({pendingFiles.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {pendingFiles.map(pf => (
                            <div
                                key={pf.id}
                                className="flex items-center gap-2 px-2 py-1 bg-background border rounded text-xs group"
                            >
                                {pf.type === 'image' && pf.previewUrl ? (
                                    <img
                                        src={pf.previewUrl}
                                        alt={pf.file.name}
                                        className="w-8 h-8 object-cover rounded"
                                    />
                                ) : (
                                    <FileIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div className="flex flex-col">
                                    <span className="font-medium truncate max-w-[100px]" title={pf.file.name}>
                                        {pf.file.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {formatFileSize(pf.file.size)}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleRemoveFile(pf.id)}
                                    className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="移除"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
