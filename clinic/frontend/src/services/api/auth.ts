import { apiClient } from '@/services/api/client';
import type { AuthTokens, AuthUser, UserRole } from '@/types/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export async function login(request: LoginRequest) {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', request);
  return data;
}

export async function register(request: RegisterRequest) {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', request);
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}
