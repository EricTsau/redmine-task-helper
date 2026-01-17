import { useState, useCallback, useEffect } from 'react';

export interface PendingFile {
    id: string;
    file: File;
    previewUrl?: string;
    type: 'image' | 'file';
}

interface UseFileAttachmentsReturn {
    pendingFiles: PendingFile[];
    addFiles: (files: FileList | File[]) => string[];
    addFile: (file: File) => string;
    removeFile: (id: string) => void;
    clearFiles: () => void;
    getFileById: (id: string) => PendingFile | undefined;
}

/**
 * Hook for managing file attachments before upload
 */
export function useFileAttachments(): UseFileAttachmentsReturn {
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

    // Clean up object URLs on unmount
    useEffect(() => {
        return () => {
            pendingFiles.forEach(pf => {
                if (pf.previewUrl) {
                    URL.revokeObjectURL(pf.previewUrl);
                }
            });
        };
    }, []);

    const addFile = useCallback((file: File): string => {
        const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

        const pendingFile: PendingFile = {
            id,
            file,
            previewUrl,
            type: isImage ? 'image' : 'file'
        };

        setPendingFiles(prev => [...prev, pendingFile]);
        return id;
    }, []);

    const addFiles = useCallback((files: FileList | File[]): string[] => {
        const fileArray = Array.from(files);
        return fileArray.map(file => addFile(file));
    }, [addFile]);

    const removeFile = useCallback((id: string) => {
        setPendingFiles(prev => {
            const file = prev.find(f => f.id === id);
            if (file?.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
            return prev.filter(f => f.id !== id);
        });
    }, []);

    const clearFiles = useCallback(() => {
        setPendingFiles(prev => {
            prev.forEach(pf => {
                if (pf.previewUrl) {
                    URL.revokeObjectURL(pf.previewUrl);
                }
            });
            return [];
        });
    }, []);

    const getFileById = useCallback((id: string): PendingFile | undefined => {
        return pendingFiles.find(f => f.id === id);
    }, [pendingFiles]);

    return {
        pendingFiles,
        addFiles,
        addFile,
        removeFile,
        clearFiles,
        getFileById
    };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Convert Markdown image/link syntax to Redmine Textile format
 * - ![alt](url) → !url!
 * - ![{{file-id}}](pending) → !filename.ext! (after upload)
 * - [text](url) → "text":url
 */
export function markdownToTextile(
    markdown: string,
    fileMapping: Map<string, string> // file-id → uploaded filename
): string {
    let textile = markdown;

    // Replace pending image placeholders with Redmine attachment link syntax
    // Pattern 1: ![...](pending:<file-id>) -> !filename!
    textile = textile.replace(
        /!\[[^\]]*\]\(pending:([^\)]+)\)/g,
        (_, fileId) => {
            const filename = fileMapping.get(fileId);
            return filename ? `!${filename}!` : '';
        }
    );

    // Pattern 2 (Legacy): ![{{file-id}}](pending) -> !filename!
    textile = textile.replace(
        /!\[\{\{([^}]+)\}\}\]\(pending\)/g,
        (_, fileId) => {
            const filename = fileMapping.get(fileId);
            return filename ? `!${filename}!` : '';
        }
    );

    // Replace pending attachment placeholders
    // Pattern 1: [...](attachment:<file-id>)
    textile = textile.replace(
        /\[[^\]]*\]\(attachment:([^\)]+)\)/g,
        (_, fileId) => {
            const filename = fileMapping.get(fileId);
            return filename ? `attachment:${filename}` : '';
        }
    );

    // Pattern 2 (Legacy): [{{file-id}}](attachment)
    textile = textile.replace(
        /\[\{\{([^}]+)\}\}\]\(attachment\)/g,
        (_, fileId) => {
            const filename = fileMapping.get(fileId);
            return filename ? `attachment:${filename}` : '';
        }
    );

    // If people are using Markdown in Redmine, keep standard Markdown images as is
    // Pattern: ![alt](url) -> ![alt](url) (no change needed if staying in Markdown)
    // textile = textile.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `!${url}!`);

    // Replace Markdown links with Textile IF needed, but if the user requested ![](filename), 
    // it implies they might be using Markdown mode in Redmine.
    // However, Redmine's "attachment:" syntax is Textile specific.
    // If the user is using commonmark, links are [text](url).
    // Let's stick closer to Markdown since the user asked for ![](attached_image).

    // textile = textile.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `"${text}":${url}`);

    return textile;
}

