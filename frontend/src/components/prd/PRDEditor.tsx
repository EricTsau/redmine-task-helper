/**
 * PRDEditor - PRD 文件 Markdown 編輯器元件
 * 支援預覽/編輯模式，以及 AI 局部編輯功能
 */
import React, { useState, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { api } from '../../lib/api';
import './PRDEditor.css';

interface PRDEditorProps {
    prdId: number;
    content: string;
    onContentChange: (content: string) => void;
    onSave: () => void;
    saving?: boolean;
}

export const PRDEditor: React.FC<PRDEditorProps> = ({
    prdId,
    content,
    onContentChange,
    onSave,
    saving = false,
}) => {
    const [mode, setMode] = useState<'preview' | 'edit'>('preview');
    const [selectedText, setSelectedText] = useState('');
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);

    // 處理文字選取
    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            setSelectedText(selection.toString());
            setShowAiPanel(true);
        }
    }, []);

    // AI 局部編輯
    const handleAiEdit = async () => {
        if (!selectedText || !aiInstruction.trim()) return;

        setAiLoading(true);
        try {
            const response = await api.post<{ edited_text: string }>(
                `/prd/${prdId}/ai-edit`,
                {
                    selected_text: selectedText,
                    instruction: aiInstruction,
                }
            );

            // 替換選取的文字
            const newContent = content.replace(selectedText, response.edited_text);
            onContentChange(newContent);

            setShowAiPanel(false);
            setSelectedText('');
            setAiInstruction('');
        } catch (error) {
            console.error('AI 編輯失敗:', error);
            alert('AI 編輯失敗，請稍後再試');
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="prd-editor">
            {/* 工具列 */}
            <div className="prd-editor-toolbar">
                <div className="mode-switcher">
                    <button
                        className={`mode-btn ${mode === 'preview' ? 'active' : ''}`}
                        onClick={() => setMode('preview')}
                    >
                        預覽
                    </button>
                    <button
                        className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
                        onClick={() => setMode('edit')}
                    >
                        編輯
                    </button>
                </div>
                <button
                    className="save-btn"
                    onClick={onSave}
                    disabled={saving}
                >
                    {saving ? '儲存中...' : '儲存'}
                </button>
            </div>

            {/* 編輯器區域 */}
            <div
                className="prd-editor-content"
                onMouseUp={handleTextSelection}
            >
                {mode === 'edit' ? (
                    <MDEditor
                        value={content}
                        onChange={(val) => onContentChange(val || '')}
                        height={500}
                        preview="edit"
                    />
                ) : (
                    <MDEditor.Markdown source={content || '（尚無內容）'} />
                )}
            </div>

            {/* AI 編輯面板 */}
            {showAiPanel && selectedText && (
                <div className="ai-edit-panel">
                    <div className="ai-edit-header">
                        <span>AI 編輯助手</span>
                        <button onClick={() => setShowAiPanel(false)}>×</button>
                    </div>
                    <div className="ai-edit-selected">
                        <strong>選取的文字：</strong>
                        <div className="selected-text">{selectedText.slice(0, 100)}...</div>
                    </div>
                    <div className="ai-edit-input">
                        <input
                            type="text"
                            placeholder="輸入修改指示，例如：更簡潔、更專業、翻譯成英文..."
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAiEdit();
                            }}
                        />
                        <button
                            onClick={handleAiEdit}
                            disabled={aiLoading || !aiInstruction.trim()}
                        >
                            {aiLoading ? '處理中...' : '套用'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PRDEditor;
