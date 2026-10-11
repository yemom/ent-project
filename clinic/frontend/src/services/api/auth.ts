import { apiClient } from '@/services/api/client';
import { toSession, type AuthResponse } from '@/lib/auth-session';
import type { AuthTokens, AuthUser, UserRole } from '@/types/api';

export type { AuthResponse };
export { toSession };

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

export async function login(request: LoginRequest): Promise<AuthTokens & { user: AuthUser }> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', request);
  return toSession(data);
}

export async function register(
  request: RegisterRequest
): Promise<AuthTokens & { user: AuthUser }> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', request);
  return toSession(data);
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return data;
}

/** `/auth/me` returns the caller's profile plus the permissions the API enforces. */
export interface CurrentUserResponse extends AuthUser {
  permissions: string[];
}

export async function getMe(): Promise<CurrentUserResponse> {
  const { data } = await apiClient.get<CurrentUserResponse>('/auth/me');
  return data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}
