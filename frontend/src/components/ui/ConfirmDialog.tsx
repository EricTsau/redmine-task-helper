import { X } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    children: React.ReactNode;
}

export function ConfirmDialog({
    open,
    title,
    onConfirm,
    onCancel,
    confirmText = '確認',
    cancelText = '取消',
    children
}: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-card border rounded-lg shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="p-1 rounded hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {children}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
