import { useState, useEffect } from 'react';
import { useTasks, type Task } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import { Play, RefreshCw, FolderOpen, CheckCircle, Loader2, Plus, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Network, Edit2, List } from 'lucide-react';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { RedmineTaskDetailModal } from '../tasks/RedmineTaskDetailModal';
import { getTaskHealthStatus, getTaskHealthColorClass, formatRedmineIssueUrl, type TaskHealthStatus } from '../tasks/taskUtils';
import { TaskMetaInfo } from '../tasks/TaskMetaInfo';
import { TaskGroupStats } from '../tasks/TaskGroupStats';
import { StatusSelect } from '../tasks/StatusSelect';

interface TaskListViewProps {
    startTimer: (id: number, comment?: string) => void;
}

type GroupBy = 'project' | 'status' | 'none';

export function TaskListView({ startTimer }: TaskListViewProps) {
    const { tasks, loading, error, refresh } = useTasks();
    const [groupBy, setGroupBy] = useState<GroupBy>('project');
    const [refreshing, setRefreshing] = useState(false);
    const [warningDays, setWarningDays] = useState(2);
    const [severeDays, setSevereDays] = useState(3);
    const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [redmineUrl, setRedmineUrl] = useState<string>('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get<any>('/settings');
                if (res) {
                    setWarningDays(res.task_warning_days ?? 2);
                    setSevereDays(res.task_severe_warning_days ?? 3);
                    if (res.redmine_url) setRedmineUrl(res.redmine_url);
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
            }
        };
        fetchSettings();
    }, []);

    // Create Task Modal State
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createProjectCtx, setCreateProjectCtx] = useState<{ id: number; name: string } | null>(null);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    const [watchlist, setWatchlist] = useState<{ redmine_project_id: number; project_name: string }[]>([]);
    const [allProjects, setAllProjects] = useState<{ id: number; name: string; parent_id?: number | null }[]>([]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await api.get<{ id: number; name: string; parent_id?: number | null }[]>('/projects');
                setAllProjects(res);
            } catch (e) {
                console.error("Failed to fetch projects", e);
            }
        };
        fetchProjects();
    }, []);

    // Expand/Collapse state
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) {
                next.delete(groupName);
            } else {
                next.add(groupName);
            }
            return next;
        });
    };

    const expandAll = () => {
        const currentKeys = Object.keys(deriveGroupedTasks());
        setExpandedGroups(new Set(currentKeys));
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
    };

    // Helper to check if a project is monitored (in watchlist or child of watchlist)
    const isProjectMonitored = (projectId: number) => {
        // Direct match
        if (watchlist.some(w => w.redmine_project_id === projectId)) return true;

        // Parent match
        const project = allProjects.find(p => p.id === projectId);
        if (project?.parent_id) {
            // Check if parent is in watchlist
            // Note: recursive check would be better for deep nesting, but start with 1 level
            if (watchlist.some(w => w.redmine_project_id === project.parent_id)) return true;
        }
        return false;
    };

    // Duplicate derivation for use in handlers (optimization: memoize this later if needed)
    const deriveGroupedTasks = () => {
        return tasks.reduce<Record<string, GroupData>>((acc, task) => {
            // Filter out non-monitored projects if we are grouping by project
            // Logic: strictly hide if NOT monitored.
            // But we should allow 'All Tasks' if groupBy is not project? 
            // User request implies "In my task list page", "Logistics CRM ... not monitored should not be displayed".
            // So we should filter GLOBALLY for this view?
            // Yes, "My Tasks" usually implies "Tasks I care about".

            if (!isProjectMonitored(task.project_id)) {
                return acc;
            }

            let key: string;
            switch (groupBy) {
                case 'project': key = task.project_name; break;
                case 'status': key = task.status_name; break;
                default: key = 'All Tasks';
            }
            if (!acc[key]) {
                acc[key] = { tasks: [], stats: { total: 0, warning: 0, severe: 0 } };
            }
            acc[key].tasks.push(task);
            acc[key].stats.total++;
            const status = getTaskStatus(task);
            if (status === 'warning') acc[key].stats.warning++;
            if (status === 'severe') acc[key].stats.severe++;
            return acc;
        }, groupBy === 'project'
            ? watchlist.reduce((acc, p) => ({ ...acc, [p.project_name]: { tasks: [], stats: { total: 0, warning: 0, severe: 0 } } }), {} as Record<string, GroupData>)
            : {});
    };

    useEffect(() => {
        const fetchWatchlist = async () => {
            try {
                const res = await api.get<{ redmine_project_id: number; project_name: string }[]>('/watchlist');
                setWatchlist(res);
            } catch (e) {
                console.error("Failed to fetch watchlist", e);
            }
        };
        fetchWatchlist();
    }, []);

    // Helper to find project ID by name
    const getProjectIdByName = (name: string) => {
        return watchlist.find(p => p.project_name === name)?.redmine_project_id;
    };

    const openCreateModal = (projectName: string, projectId?: number) => {
        const pid = projectId || getProjectIdByName(projectName);
        if (pid) {
            setCreateProjectCtx({ id: pid, name: projectName });
            setCreateModalOpen(true);
        }
    };

    // Helper to determine status based on updated_on
    const getTaskStatus = (task: Task): TaskHealthStatus => {
        return getTaskHealthStatus(task, { warningDays, severeDays });
    };

    // Helper to build tree
    const buildTaskTree = (flatTasks: Task[]) => {
        const taskMap = new Map<number, Task & { children: any[] }>();
        // Initialize map
        flatTasks.forEach(t => taskMap.set(t.id, { ...t, children: [] }));

        const roots: (Task & { children: any[] })[] = [];

        // Build hierarchy
        flatTasks.forEach(t => {
            const node = taskMap.get(t.id)!;
            if (t.parent && taskMap.has(t.parent.id)) {
                taskMap.get(t.parent.id)!.children.push(node);
            } else {
                roots.push(node); // Parent not in list or no parent -> Root in this view
            }
        });

        return roots;
    };

    // Tree Node State (Expand/Collapse)
    const [treeExpanded, setTreeExpanded] = useState<Set<number>>(new Set());

    // Auto-expand all on load/change
    useEffect(() => {
        if (tasks.length > 0 && treeExpanded.size === 0) {
            const allIds = tasks.map(t => t.id);
            setTreeExpanded(new Set(allIds));
        }
    }, [tasks.length]);

    const toggleTreeNode = (id: number) => {
        setTreeExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Tree view expand/collapse all functions
    const expandAllTree = () => {
        const allIds = tasks.map(t => t.id);
        setTreeExpanded(new Set(allIds));
    };

    const collapseAllTree = () => {
        setTreeExpanded(new Set());
    };

    const renderTreeNodes = (nodes: (Task & { children: any[] })[]) => {
        return nodes.map(node => {
            const status = getTaskStatus(node);
            const bgClass = getTaskHealthColorClass(status);
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = treeExpanded.has(node.id);

            return (
                <div key={node.id} className="tree-node-container space-y-2">
                    <div
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${bgClass}`}
                    >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            {/* Tree Toggle */}
                            <div className="flex-shrink-0 w-6 flex justify-center">
                                {hasChildren ? (
                                    <button
                                        onClick={() => toggleTreeNode(node.id)}
                                        className="p-0.5 hover:bg-black/10 rounded transition-colors"
                                    >
                                        {isExpanded ? <ChevronDown className="h-4 w-4 opacity-70" /> : <ChevronRight className="h-4 w-4 opacity-70" />}
                                    </button>
                                ) : (
                                    <span className="w-4" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{node.subject}</div>
                                    {hasChildren && !isExpanded && (
                                        <span className="text-xs bg-muted px-1.5 rounded-full text-muted-foreground">
                                            {node.children.length} 子任務
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <a
                                        href={formatRedmineIssueUrl(redmineUrl, node.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-primary transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                        title="在 Redmine 中開啟"
                                    >
                                        #{node.id}
                                    </a>
                                    <span>•</span>
                                    <span>{node.project_name}</span>
                                    <span>•</span>
                                    <StatusSelect
                                        currentStatusId={node.status_id}
                                        currentStatusName={node.status_name}
                                        onStatusChange={async (statusId) => {
                                            try {
                                                await api.put(`/tasks/${node.id}`, { status_id: statusId });
                                                await refresh();
                                            } catch (e) {
                                                console.error("Status update failed", e);
                                            }
                                        }}
                                    />
                                    {node.parent && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded ml-1">Parent: #{node.parent.id}</span>}
                                    <TaskMetaInfo
                                        estimated_hours={node.estimated_hours}
                                        spent_hours={node.spent_hours}
                                        updated_on={node.updated_on}
                                        status={status}
                                    />
                                    {node.assigned_to && (
                                        <span className="text-xs text-muted-foreground/70 ml-2" title="被指派者">
                                            👤 {node.assigned_to.name}
                                        </span>
                                    )}
                                    {node.author && (
                                        <span className="text-xs text-muted-foreground/70 ml-1" title="建立者">
                                            📝 {node.author.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setEditingTask(node)}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                                title="查看詳情與筆記"
                            >
                                <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => startTimer(node.id)}
                                className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                title="開始計時"
                            >
                                <Play className="h-4 w-4 fill-current" />
                            </button>
                        </div>
                    </div>
                    {/* Children */}
                    {hasChildren && isExpanded && (
                        <div className="pl-6 border-l-2 border-muted/30 ml-3 space-y-2">
                            {renderTreeNodes(node.children)}
                        </div>
                    )}
                </div>
            );
        });
    };

    interface GroupData {
        tasks: Task[];
        stats: { total: number; warning: number; severe: number };
    }

    // Grouping logic (Memoized to avoid re-calc on every render if possible, but for now simple variable)
    const groupedTasks = deriveGroupedTasks();

    // Auto-expand on load/change
    useEffect(() => {
        if (Object.keys(groupedTasks).length > 0 && expandedGroups.size === 0) {
            setExpandedGroups(new Set(Object.keys(groupedTasks)));
        }
    }, [tasks.length, groupBy, watchlist.length, allProjects.length]);

    if (loading && !refreshing) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) return <div className="p-3 bg-destructive/10 text-destructive rounded-md">Error: {error}</div>;

    return (
        <div className="space-y-4">
            {/* Header / Controls */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">我的任務</h2>
                <div className="flex items-center gap-2">
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="px-2 py-1 text-sm border rounded bg-background"
                    >
                        <option value="project">依專案</option>
                        <option value="status">依狀態</option>
                        <option value="none">無分組</option>
                    </select>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
                        title="從 Redmine 刷新"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <div className="flex items-center border rounded overflow-hidden">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 ${viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted'} border-r`}
                            title="列表檢視"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('tree')}
                            className={`p-2 ${viewMode === 'tree' ? 'bg-muted' : 'hover:bg-muted'}`}
                            title="樹狀檢視"
                        >
                            <Network className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex items-center border rounded overflow-hidden ml-2">
                        <button
                            onClick={viewMode === 'tree' ? expandAllTree : expandAll}
                            className="p-2 hover:bg-muted border-r"
                            title="全部展開"
                        >
                            <ChevronsDown className="h-4 w-4" />
                        </button>
                        <button
                            onClick={viewMode === 'tree' ? collapseAllTree : collapseAll}
                            className="p-2 hover:bg-muted"
                            title="全部收合"
                        >
                            <ChevronsUp className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-6">
                {Object.entries(groupedTasks).map(([groupName, { tasks: groupTasks, stats }]) => (
                    <div key={groupName} className="space-y-2">
                        {/* Group Header */}
                        {groupBy !== 'none' && (
                            <div
                                className="flex items-center justify-between text-sm font-medium text-muted-foreground border-b pb-1 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleGroup(groupName)}
                            >
                                <div className="flex items-center gap-2">
                                    {expandedGroups.has(groupName) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {groupBy === 'project' && <FolderOpen className="h-4 w-4" />}
                                    {groupBy === 'status' && <CheckCircle className="h-4 w-4" />}
                                    <span>{groupName}</span>
                                    <div className="ml-2">
                                        <TaskGroupStats
                                            stats={stats}
                                            warningDays={warningDays}
                                            severeDays={severeDays}
                                        />
                                    </div>
                                </div>

                                {/* Add Task Button (For projects in Watchlist OR their subprojects) */}
                                {groupBy === 'project' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Try to find project ID from tasks or allProjects
                                            let pid = getProjectIdByName(groupName); // Check watchlist first
                                            if (!pid) {
                                                // Check tasks
                                                const task = groupTasks[0];
                                                if (task) pid = task.project_id;
                                            }
                                            if (!pid) {
                                                // Check allProjects by name (fallback)
                                                const p = allProjects.find(ap => ap.name === groupName);
                                                if (p) pid = p.id;
                                            }

                                            if (pid) {
                                                openCreateModal(groupName, pid);
                                            }
                                        }}
                                        className="p-1 hover:bg-muted rounded hover:text-foreground transition-colors"
                                        title={`在 ${groupName} 新增任務`}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Tasks */}
                        {expandedGroups.has(groupName) && (
                            <div className="grid gap-2">
                                {viewMode === 'tree' && groupBy === 'project' ? (
                                    <div className="mt-2">
                                        {renderTreeNodes(buildTaskTree(groupTasks))}
                                    </div>
                                ) : (
                                    groupTasks.map(task => {
                                        const status = getTaskStatus(task);
                                        const bgClass = getTaskHealthColorClass(status);

                                        return (
                                            <div
                                                key={task.id}
                                                className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${bgClass}`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{task.subject}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        <a
                                                            href={formatRedmineIssueUrl(redmineUrl, task.id)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:underline hover:text-primary transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="在 Redmine 中開啟"
                                                        >
                                                            #{task.id}
                                                        </a>
                                                        {' '}• {task.project_name} • {task.status_name}
                                                        <TaskMetaInfo
                                                            estimated_hours={task.estimated_hours}
                                                            spent_hours={task.spent_hours}
                                                            updated_on={task.updated_on}
                                                            status={status}
                                                        />
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
                                                            {task.assigned_to && (
                                                                <span title="被指派者">
                                                                    👤 {task.assigned_to.name}
                                                                </span>
                                                            )}
                                                            {task.author && (
                                                                <span title="建立者">
                                                                    📝 {task.author.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingTask(task)}
                                                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                                                        title="查看詳情與筆記"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => startTimer(task.id)}
                                                        className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                                        title="開始計時"
                                                    >
                                                        <Play className="h-4 w-4 fill-current" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {tasks.length === 0 && watchlist.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                        Redmine 中目前沒有分配給您的開啟任務。
                    </div>
                )}
            </div>

            {/* Create Task Modal */}
            {
                createProjectCtx && (
                    <TaskCreateModal
                        isOpen={createModalOpen}
                        onClose={() => setCreateModalOpen(false)}
                        projectId={createProjectCtx.id}
                        projectName={createProjectCtx.name}
                        onTaskCreated={refresh}
                    />
                )
            }

            {
                editingTask && (
                    <RedmineTaskDetailModal
                        taskId={editingTask.id}
                        subject={editingTask.subject}
                        onClose={() => setEditingTask(null)}
                        onUpdate={refresh}
                    />
                )
            }
        </div >
    );
}
