
import { useState, useMemo, useEffect } from 'react';
import { Search, X, Loader2, Check, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import './ProjectSelectModal.css';

interface Project {
    id: number;
    name: string;
    parent_id: number | null;
    children?: Project[];
}

interface ProjectSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (projectId: number, projectName: string) => void;
    currentProjectId?: number | null;
}

export function ProjectSelectModal({ isOpen, onClose, onSelect, currentProjectId }: ProjectSelectModalProps) {
    const [keyword, setKeyword] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(currentProjectId || null);

    // Fetch projects
    useEffect(() => {
        if (!isOpen) return;

        const loadProjects = async () => {
            setLoading(true);
            try {
                const res = await api.get<Project[]>('/projects');
                setProjects(res || []);
            } catch (error) {
                console.error("Failed to load projects", error);
            } finally {
                setLoading(false);
            }
        };
        loadProjects();
    }, [isOpen]);

    // Build tree
    const projectTree = useMemo(() => {
        if (!Array.isArray(projects)) return [];
        const map = new Map<number, Project>();
        const roots: Project[] = [];

        // Clone to avoid mutation issues if reused
        const items = projects.map(p => ({ ...p, children: [] as Project[] }));

        items.forEach(item => map.set(item.id, item));

        items.forEach(item => {
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id)!.children!.push(item);
            } else {
                roots.push(item);
            }
        });
        return roots;
    }, [projects]);

    // Recursive renderer
    const ProjectItem = ({ project, level = 0 }: { project: Project, level?: number }) => {
        const [expanded, setExpanded] = useState(true);
        const hasChildren = project.children && project.children.length > 0;

        // Filter by keyword if provided (simple filter: if project or any child matches)
        // Actually simple tree filter is complex. Let's just filter visible items or highlight.
        // For simplicity: if keyword exists, flatten the list? Or just filter top level?
        // Let's implement flat list if keyword is present, tree if not.

        return (
            <div>
                <div
                    className={`flex items-center px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded text-sm ${selectedId === project.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    onClick={() => setSelectedId(project.id)}
                >
                    <div
                        className="mr-1 p-0.5 rounded hover:bg-muted text-muted-foreground"
                        onClick={(e) => {
                            if (hasChildren) {
                                e.stopPropagation();
                                setExpanded(!expanded);
                            }
                        }}
                    >
                        {hasChildren ? (
                            expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                        ) : <span className="w-3 h-3 inline-block" />}
                    </div>

                    {expanded ? <FolderOpen className="w-4 h-4 mr-2 text-blue-500" /> : <Folder className="w-4 h-4 mr-2 text-blue-500" />}

                    <span>{project.name}</span>
                    {selectedId === project.id && <Check className="w-3 h-3 ml-auto text-primary" />}
                </div>

                {hasChildren && expanded && (
                    <div>
                        {project.children!.map(child => (
                            <ProjectItem key={child.id} project={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Flat renderer for search
    const filteredProjects = useMemo(() => {
        if (!keyword) return [];
        return projects.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
    }, [projects, keyword]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-md rounded-lg shadow-xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">選擇 Redmine 專案</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="搜尋專案..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-20 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            載入中...
                        </div>
                    ) : (
                        keyword ? (
                            <div className="space-y-1">
                                {filteredProjects.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-4 text-sm">無符合結果</div>
                                ) : (
                                    filteredProjects.map(p => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-muted/50 rounded text-sm ${selectedId === p.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                            onClick={() => setSelectedId(p.id)}
                                        >
                                            <Folder className="w-4 h-4 mr-2 text-blue-500" />
                                            {p.name}
                                            {selectedId === p.id && <Check className="w-3 h-3 ml-auto text-primary" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {projectTree.map(p => (
                                    <ProjectItem key={p.id} project={p} />
                                ))}
                            </div>
                        )
                    )}
                </div>

                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-md"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => {
                            if (selectedId) {
                                const p = projects.find(x => x.id === selectedId);
                                if (p) onSelect(selectedId, p.name);
                            }
                        }}
                        disabled={!selectedId}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                        確認選擇
                    </button>
                </div>
            </div>
        </div>
    );
}
