const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api/v1' : 'http://127.0.0.1:8000/api/v1');

type RequestOptions = RequestInit & {
    params?: Record<string, string>;
    responseType?: 'json' | 'text' | 'blob';
};

export class ApiError extends Error {
    public status: number;
    public message: string;
    public data?: any;

    constructor(status: number, message: string, data?: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.message = message;
        this.data = data;
    }
}

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;
    private refreshTokenStr: string | null = null;

    private isRefreshing = false;
    private refreshSubscribers: ((token: string) => void)[] = [];

    private onAuthFailure: (() => void) | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        // Load tokens from storage on init
        this.token = localStorage.getItem('token');
        this.refreshTokenStr = localStorage.getItem('refresh_token');
    }

    public onUnauthorized(cb: () => void) {
        this.onAuthFailure = cb;
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    setRefreshToken(token: string | null) {
        this.refreshTokenStr = token;
        if (token) {
            localStorage.setItem('refresh_token', token);
        } else {
            localStorage.removeItem('refresh_token');
        }
    }

    private onRefreshed(token: string) {
        this.refreshSubscribers.forEach(cb => cb(token));
        this.refreshSubscribers = [];
    }

    private addRefreshSubscriber(cb: (token: string) => void) {
        this.refreshSubscribers.push(cb);
    }

    private async refreshToken(): Promise<string | null> {
        if (!this.refreshTokenStr) return null;

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: this.refreshTokenStr }),
            });

            if (!response.ok) {
                throw new Error('Refresh failed');
            }

            const data = await response.json();
            this.setToken(data.access_token);
            this.setRefreshToken(data.refresh_token);
            return data.access_token;
        } catch (error) {
            // Refresh failed, clear everything
            this.setToken(null);
            this.setRefreshToken(null);
            this.onAuthFailure?.();
            return null;
        }
    }

    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { params, ...init } = options;

        // Build URL with query parameters
        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, value);
                }
            });
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}${searchParams.toString()}`;
        }

        // Default headers
        const headers: HeadersInit = {
            ...init.headers,
        };

        if (this.token) {
            (headers as any)['Authorization'] = `Bearer ${this.token}`;
        }

        // Auto-set JSON content type if not FormData and not already set
        if (!(init.body instanceof FormData) && !(headers as any)['Content-Type']) {
            (headers as any)['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...init,
            headers,
        });

        // Handle errors
        if (!response.ok) {
            // Check for 401 and try refresh if applicable
            if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
                if (!this.isRefreshing) {
                    this.isRefreshing = true;
                    const newToken = await this.refreshToken();
                    this.isRefreshing = false;

                    if (newToken) {
                        this.onRefreshed(newToken);
                        // Retry original request
                        return this.request<T>(endpoint, options);
                    }
                } else {
                    // Wait for refresh to complete
                    return new Promise((resolve) => {
                        this.addRefreshSubscriber(() => {
                            resolve(this.request<T>(endpoint, options));
                        });
                    });
                }
            }

            let errorMessage = `HTTP Error ${response.status}`;
            let errorData: any = {};
            try {
                errorData = await response.json();
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    } else if (Array.isArray(errorData.detail)) {
                        // Handle Pydantic validation errors
                        errorMessage = errorData.detail
                            .map((err: any) => `${err.msg} (${err.loc.join('.')})`)
                            .join('\n');
                    } else {
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                // Ignore JSON parse error on error response
            }
            throw new ApiError(response.status, errorMessage, errorData);
        }

        // Return empty response for 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        // Check response type
        if (init.responseType === 'blob') {
            return await response.blob() as unknown as T;
        }

        // Handle Blob via Header (legacy)
        if (init.headers && (init.headers as any)['Accept'] === 'application/octet-stream') {
            // Type assertion for T (assuming T is Blob)
            return await response.blob() as unknown as T;
        }

        // Check content type for other formats if needed, or rely on caller to expect JSON by default
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (e) {
                return {} as T;
            }
        }

        // Fallback for text/other
        try {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch {
                return text as unknown as T;
            }
        } catch (e) {
            return {} as T;
        }
    }

    async get<T>(endpoint: string, params?: Record<string, string>, options?: Omit<RequestOptions, 'params' | 'method'>): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET', params });
    }

    async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined)
        });
    }

    /**
     * Streaming POST helper that behaves like `request` but returns the raw Response
     * so callers can read `response.body` as a stream. Automatically attempts refresh on 401.
     */
    async stream(endpoint: string, options: RequestOptions = {}): Promise<Response> {
        const { params, ...init } = options;

        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, value);
                }
            });
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}${searchParams.toString()}`;
        }

        const headers: HeadersInit = {
            ...init.headers,
        };

        if (this.token) {
            (headers as any)['Authorization'] = `Bearer ${this.token}`;
        }

        if (!(init.body instanceof FormData) && !(headers as any)['Content-Type']) {
            (headers as any)['Content-Type'] = 'application/json';
        }

        let response = await fetch(url, {
            ...init,
            headers,
        });

        // Try refresh on 401 once
        if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
            const newToken = await this.refreshToken();
            if (newToken) {
                (headers as any)['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, {
                    ...init,
                    headers,
                });
            }
        }

        return response;
    }


    async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async delete<T>(endpoint: string, params?: Record<string, string>, options?: Omit<RequestOptions, 'params' | 'method'>): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE', params });
    }

    async getBlob(endpoint: string): Promise<Blob> {
        return this.request<Blob>(endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/octet-stream'
            }
        });
    }
}

export const api = new ApiClient(API_BASE);
