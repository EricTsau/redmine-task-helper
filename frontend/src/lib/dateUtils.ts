/**
 * 日期格式化工具函數
 * 統一日期顯示格式為 yyyy/mm/dd
 */

/**
 * 格式化日期為 yyyy/mm/dd 格式
 * @param date - Date 物件或日期字串
 * @returns 格式化後的日期字串
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * 格式化日期時間為 yyyy/mm/dd HH:mm 格式
 * @param date - Date 物件或日期字串
 * @returns 格式化後的日期時間字串
 */
export function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}
