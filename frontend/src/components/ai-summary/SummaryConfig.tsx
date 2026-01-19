import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

interface Project {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
}

interface ConfigProps {
    onConfigSaved: () => void;
}

export function SummaryConfig({ onConfigSaved }: ConfigProps) {
    const { showSuccess, showError } = useToast();
    const { token } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

    // In a real scenario, we might want to fetch ALL users or users from selected projects.
    // Simplifying to manual input or fetching from selected projects later.
    // For now, let's fetch projects and maybe a list of "recent users" or "project members".
    // Since get_project_members endpoint exists implicitly or we can add one.
    // Let's assume we just allow selecting Projects for now to keep it simple, 
    // or we need a way to select Users.
    // A better UX: Select Project -> Show Members -> Select Members.
    const [members, setMembers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProjects();
        fetchSettings();
    }, []);

    useEffect(() => {
        if (selectedProjectIds.length > 0) {
            fetchMembers(selectedProjectIds);
        } else {
            setMembers([]);
        }
    }, [selectedProjectIds]);

    const fetchProjects = async () => {
        try {
            const res = await api.get<Project[]>("/projects", undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res as any);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get<any>("/ai-summary/settings", undefined, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedProjectIds(res.target_project_ids || []);
            setSelectedUserIds(res.target_user_ids || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMembers = async (projectIds: number[]) => {
        // We probably need an endpoint to get members of multiple projects.
        // Or we loop CLIENT SIDE (bad for perf but ok for MVP).
        // Let's rely on backend service 'fetching members' or just listing all known users?
        // Actually, Redmine 'get_project_members' is per project.
        // Let's implement a loop here for MVP.
        let allMembers: User[] = [];
        for (const pid of projectIds) {
            try {
                const res = await api.get<any>(`/projects/${pid}/members`, undefined, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // res should be list of members (direct response or in data prop depending on API structure? backend RedmineService returns list directly mostly, but let's check. 
                // api.ts returns response directly if JSON.
                // Redmine usually returns { memberships: [...] } or list? 
                // Let's assume list or handle both. 
                // Based on previous code assumption: res.data. 
                // But my api.ts returns parsed JSON body directly as T. 
                // So if backend returns list, T is list.
                // Let's cast to any and access safely.
                const data = Array.isArray(res) ? res : (res.memberships || res.data || []);
                allMembers = [...allMembers, ...data];
            } catch (e) {
                console.warn(`Failed to fetch members for project ${pid}`, e);
            }
        }

        // Dedup by ID
        const unique = Array.from(new Map(allMembers.map(item => [item.id, item])).values());
        setMembers(unique);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put("/ai-summary/settings", {
                project_ids: selectedProjectIds,
                user_ids: selectedUserIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showSuccess("設定已儲存");
            onConfigSaved();
        } catch (error) {
            showError("儲存失敗");
        } finally {
            setLoading(false);
        }
    };

    // Toggle helper
    const toggleSelection = (id: number, list: number[], setList: (l: number[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(i => i !== id));
        } else {
            setList([...list, id]);
        }
    };

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>設定關注清單</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label className="mb-2 block">1. 選擇專案</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
                        {projects.map(p => (
                            <div key={p.id} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id={`proj-${p.id}`}
                                    checked={selectedProjectIds.includes(p.id)}
                                    onChange={() => toggleSelection(p.id, selectedProjectIds, setSelectedProjectIds)}
                                />
                                <label htmlFor={`proj-${p.id}`} className="text-sm cursor-pointer">{p.name}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <Label className="mb-2 block">2. 選擇關注人員 (需先選擇專案)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
                        {members.length === 0 && <span className="text-muted-foreground text-sm">請先選擇專案以載入人員</span>}
                        {members.map(u => (
                            <div key={u.id} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id={`user-${u.id}`}
                                    checked={selectedUserIds.includes(u.id)}
                                    onChange={() => toggleSelection(u.id, selectedUserIds, setSelectedUserIds)}
                                />
                                <label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">{u.name}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <Button onClick={handleSave} disabled={loading}>
                    {loading ? "儲存中..." : "儲存設定"}
                </Button>
            </CardContent>
        </Card>
    );
}
