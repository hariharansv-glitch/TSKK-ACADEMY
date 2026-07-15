'use client';

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { apiUrl, config } from '@/lib/config';
import { useAuthStore } from '@/store/auth-store';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  requestId?: string;
  timestamp?: string;
}

export interface ApiError {
  statusCode: number;
  code?: string;
  message: string;
  details?: unknown;
}

// Single shared axios instance with automatic token refresh on 401
export const api: AxiosInstance = axios.create({
  baseURL: `${config.apiBase}${config.apiPrefix}`,
  withCredentials: true,
  timeout: 30_000,
});

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return null;
    try {
      const res = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
        `${config.apiBase}${config.apiPrefix}/auth/refresh`,
        { refreshToken },
        { withCredentials: true },
      );
      const tokens = res.data.data;
      useAuthStore.getState().setTokens(tokens);
      return tokens.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.endsWith('/auth/refresh') &&
      !original.url?.endsWith('/auth/login')
    ) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }
    return Promise.reject(err);
  },
);

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<ApiEnvelope<T>>(config);
  return res.data.data;
}

/**
 * Fetch a binary response (e.g. PDF, PNG) as a blob. Unlike `apiRequest`,
 * this does not attempt to unwrap the JSON envelope.
 */
export async function apiBlobRequest(config: AxiosRequestConfig): Promise<Blob> {
  const res = await api.request<Blob>({ ...config, responseType: 'blob' });
  return res.data;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export async function apiListRequest<T>(config: AxiosRequestConfig): Promise<{
  items: T[];
  meta: PaginationMeta;
}> {
  const res = await api.request<ApiEnvelope<T[]> & { meta: PaginationMeta }>(config);
  return { items: res.data.data, meta: res.data.meta as PaginationMeta };
}

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message ?? data?.error ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export { apiUrl };
