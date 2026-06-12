import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/lib/env';
import { tokenStorage } from '@/lib/token-storage';
import { useAuthStore } from '@/store/auth-store';
import type { ApiErrorResponse } from '@/types/api';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  withCredentials: true
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken ?? tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean } | undefined;

    const requestPath = originalRequest?.url ?? '';
    const isAuthRequest = requestPath.includes('/auth/login') || requestPath.includes('/auth/register') || requestPath.includes('/auth/logout') || requestPath.includes('/auth/refresh');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      const { isHydrated, accessToken } = useAuthStore.getState();
      if (isHydrated && accessToken) {
        useAuthStore.getState().clearSession();
      }
    }

    return Promise.reject(error);
  }
);
