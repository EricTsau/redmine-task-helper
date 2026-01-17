/**
 * Decodes the payload from a JWT token (without validation)
 */
function decodeJwt(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * Checks if a JWT token is expired
 * @param token The JWT token string
 * @returns true if expired or invalid, false if valid
 */
export function isTokenExpired(token: string | null): boolean {
    if (!token) return true;

    const payload = decodeJwt(token);
    if (!payload || !payload.exp) return true;

    // exp is in seconds, Date.now() is in ms
    const currentTime = Date.now() / 1000;

    // Check if expired (with 10s buffer for clock skew)
    return payload.exp < (currentTime + 10);
}
