import {
  getApiBaseUrl,
  initializeApiConfig,
  refreshApiConfig,
  usesLanBackendDiscovery,
} from './config';

/** Abort hanging requests so the UI does not spin forever (Vercel cold start is still bounded). */
const REQUEST_TIMEOUT_MS = 45_000;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      if (__DEV__) {
        console.log(`[api] ${options.method ?? 'GET'} ${url}`);
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          message: `Request timed out (${REQUEST_TIMEOUT_MS / 1000}s). Check network, VPN, and that the API is up.`,
          status: 0,
        } as ApiError;
      }

      // Only re-run LAN discovery + retry when using a local/private backend URL.
      if (
        error instanceof Error &&
        !hasRetriedAfterRefresh &&
        usesLanBackendDiscovery()
      ) {
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
