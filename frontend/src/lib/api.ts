const API_BASE = 'http://127.0.0.1:8000/api/v1';

type RequestOptions = RequestInit & {
    params?: Record<string, string>;
};

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    setToken(token: string | null) {
        this.token = token;
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
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                // Ignore JSON parse error on error response
            }
            throw new Error(errorMessage);
        }

        // Return empty response for 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        // Parse JSON
        try {
            return await response.json();
        } catch (e) {
            // For endpoints that return non-JSON success (rare but possible)
            // or empty body with 200 OK
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
}

export const api = new ApiClient(API_BASE);
