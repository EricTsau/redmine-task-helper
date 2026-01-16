import { useState } from 'react';
import { RewriteButton } from '@/components/ai/RewriteButton';

interface NotesFieldProps {
    initialValue?: string;
    onChange?: (value: string) => void;
}

export function NotesField({ initialValue = '', onChange }: NotesFieldProps) {
    const [value, setValue] = useState(initialValue);

    const handleChange = (newValue: string) => {
        setValue(newValue);
        onChange?.(newValue);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Notes</label>
                <RewriteButton
                    text={value}
                    onRewrite={(rewritten) => handleChange(rewritten)}
                />
            </div>
            <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Add notes, next steps, or comments..."
                className="w-full min-h-[120px] p-3 bg-background border rounded-md resize-none text-sm"
            />
        </div>
    );
}
