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
 * 確保時間字串被解析為 UTC 時間
 * 後端使用 datetime.utcnow() 儲存，但序列化時可能沒有時區標記
 * @param dateStr - 日期字串
 * @returns Date 物件
 */
function parseAsUTC(dateStr: string): Date {
    // 如果沒有時區標記 (Z 或 +/-offset)，假設為 UTC
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
        return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
}

/**
 * 格式化日期時間為 yyyy/mm/dd HH:mm 格式 (本地時區)
 * @param date - Date 物件或日期字串 (假設後端傳來的是 UTC 時間)
 * @returns 格式化後的日期時間字串 (轉換為本地時區)
 */
export function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? parseAsUTC(date) : date;
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

