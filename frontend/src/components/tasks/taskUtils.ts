

export interface TaskStatusConfig {
    warningDays: number;
    severeDays: number;
}

export interface TaskBasicInfo {
    updated_on: string | null;
}

export type TaskHealthStatus = 'normal' | 'warning' | 'severe';

export function getTaskHealthStatus(task: TaskBasicInfo, config: TaskStatusConfig): TaskHealthStatus {
    if (!task.updated_on) return 'normal';

    const updatedDate = new Date(task.updated_on);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 3600 * 24);

    if (daysSinceUpdate > config.severeDays) return 'severe';
    if (daysSinceUpdate > config.warningDays) return 'warning';
    return 'normal';
}

export function getTaskHealthColorClass(status: TaskHealthStatus): string {
    switch (status) {
        case 'warning':
            return "bg-yellow-50 dark:bg-yellow-950/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900";
        case 'severe':
            return "bg-red-50 dark:bg-red-950/10 hover:bg-red-100/50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900";
    }
    return "bg-card hover:bg-accent/50";
}

export function formatRedmineIssueUrl(baseUrl: string, issueId: number): string {
    if (!baseUrl) return '#';
    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}/issues/${issueId}`;
}
