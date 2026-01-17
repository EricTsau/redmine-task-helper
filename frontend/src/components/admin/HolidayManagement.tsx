import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import {
    Calendar,
    Plus,
    Trash2,
    Upload,
    Save,
    Loader2
} from 'lucide-react';

interface Holiday {
    id: number;
    date: string;
    name: string;
    created_at: string;
}

interface HolidaySettings {
    exclude_saturday: boolean;
    exclude_sunday: boolean;
    updated_at: string;
}

interface HolidayManagementProps {
    onStatus: (status: { type: 'success' | 'error'; message: string }) => void;
}

export const HolidayManagement: React.FC<HolidayManagementProps> = ({ onStatus }) => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [settings, setSettings] = useState<HolidaySettings>({
        exclude_saturday: true,
        exclude_sunday: true,
        updated_at: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [holidaysRes, settingsRes] = await Promise.all([
                api.get<Holiday[]>('/admin/holidays'),
                api.get<HolidaySettings>('/admin/holidays/settings')
            ]);
            setHolidays(holidaysRes);
            setSettings(settingsRes);
        } catch (e) {
            console.error('Failed to fetch holidays', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.date || !newHoliday.name) return;

        try {
            await api.post('/admin/holidays', newHoliday);
            onStatus({ type: 'success', message: '假日新增成功' });
            setNewHoliday({ date: '', name: '' });
            setShowAddForm(false);
            fetchData();
        } catch (e: any) {
            onStatus({ type: 'error', message: e.message || '新增失敗' });
        }
    };

    const handleDeleteHoliday = async (id: number) => {
        try {
            await api.delete(`/admin/holidays/${id}`);
            onStatus({ type: 'success', message: '假日已刪除' });
            fetchData();
        } catch (e: any) {
            onStatus({ type: 'error', message: e.message || '刪除失敗' });
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.put('/admin/holidays/settings', {
                exclude_saturday: settings.exclude_saturday,
                exclude_sunday: settings.exclude_sunday
            });
            onStatus({ type: 'success', message: '設定已儲存' });
        } catch (e: any) {
            onStatus({ type: 'error', message: e.message || '儲存失敗' });
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post<{
                status: string;
                imported: number;
                skipped: number;
                errors: string[];
            }>('/admin/holidays/import', formData);

            let message = `匯入完成：${res.imported} 個新增, ${res.skipped} 個已存在`;
            if (res.errors.length > 0) {
                message += ` (${res.errors.length} 個錯誤)`;
            }
            onStatus({ type: 'success', message });
            fetchData();
        } catch (e: any) {
            onStatus({ type: 'error', message: e.message || '匯入失敗' });
        }

        // 清除選擇
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            {/* 週末設定 */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    週末設定
                </h3>
                <p className="text-muted-foreground text-sm">
                    設定是否將週末視為非工作日，影響甘特圖排程計算
                </p>
                <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.exclude_saturday}
                            onChange={(e) => setSettings({ ...settings, exclude_saturday: e.target.checked })}
                            className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
                        />
                        <span className="font-medium">排除週六</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.exclude_sunday}
                            onChange={(e) => setSettings({ ...settings, exclude_sunday: e.target.checked })}
                            className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
                        />
                        <span className="font-medium">排除週日</span>
                    </label>
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        儲存設定
                    </button>
                </div>
            </div>

            <hr />

            {/* 假日列表 */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold">自訂假日</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                            新增特殊假日（如國定假日），這些日期將從工作日計算中排除
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 border rounded-xl font-semibold hover:bg-muted transition-all"
                        >
                            <Upload className="h-4 w-4" />
                            匯入 CSV
                        </button>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all"
                        >
                            <Plus className="h-4 w-4" />
                            新增假日
                        </button>
                    </div>
                </div>

                {/* 新增表單 */}
                {showAddForm && (
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                        <input
                            type="date"
                            value={newHoliday.date}
                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                            className="h-10 px-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none"
                        />
                        <input
                            type="text"
                            placeholder="假日名稱"
                            value={newHoliday.name}
                            onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                            className="flex-1 h-10 px-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none"
                        />
                        <button
                            onClick={handleAddHoliday}
                            disabled={!newHoliday.date || !newHoliday.name}
                            className="h-10 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                        >
                            確認
                        </button>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewHoliday({ date: '', name: '' });
                            }}
                            className="h-10 px-4 border rounded-lg font-semibold hover:bg-muted transition-all"
                        >
                            取消
                        </button>
                    </div>
                )}

                {/* 假日列表 */}
                {holidays.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>尚未設定任何假日</p>
                        <p className="text-sm mt-1">點擊「新增假日」或「匯入 CSV」來開始</p>
                    </div>
                ) : (
                    <div className="border rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">日期</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">名稱</th>
                                    <th className="px-4 py-3 text-right text-sm font-bold text-muted-foreground">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {holidays.map((holiday) => (
                                    <tr key={holiday.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-sm">{holiday.date}</td>
                                        <td className="px-4 py-3">{holiday.name}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteHoliday(holiday.id)}
                                                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                title="刪除"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    CSV 格式：每行一筆，格式為「YYYY-MM-DD, 假日名稱」
                </p>
            </div>
        </div>
    );
};

export default HolidayManagement;
