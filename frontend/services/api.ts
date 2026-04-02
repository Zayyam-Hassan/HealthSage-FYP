import { getApiBaseUrl, initializeApiConfig, refreshApiConfig } from './config';

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

class ApiClient {
  private getBaseURL: () => string;

  constructor(getBaseURL: () => string) {
    this.getBaseURL = getBaseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    hasRetriedAfterRefresh = false,
  ): Promise<T> {
    await initializeApiConfig();

    const headers: HeadersInit =
      accessToken || options.headers
        ? {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          }
        : {
            'Content-Type': 'application/json',
          };

    const url = `${this.getBaseURL()}${endpoint}`;
    
    try {
      if (__DEV__) {
        console.log(`[api] ${options.method ?? 'GET'} ${url}`);
      }
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle non-JSON responses (like 204 No Content)
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (response.ok) {
          return {} as T;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail;
        const message = Array.isArray(detail)
          ? detail.map((e: { msg?: string; loc?: unknown }) => e.msg || JSON.stringify(e.loc)).join('; ')
          : typeof detail === 'string'
            ? detail
            : data.message || 'An error occurred';
        throw {
          message,
          status: response.status,
          detail: data.detail,
        } as ApiError;
      }

      return data;
    } catch (error) {
      if (error instanceof Error && !hasRetriedAfterRefresh) {
        await refreshApiConfig();
        return this.request<T>(endpoint, options, true);
      }
      if (error instanceof Error) {
        throw {
          message: `Unable to reach backend at ${url}. ${error.message}`,
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient(getApiBaseUrl);
