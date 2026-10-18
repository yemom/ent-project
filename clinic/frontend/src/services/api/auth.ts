import { apiClient } from '@/services/api/client';
import { toSession, type AuthResponse } from '@/lib/auth-session';
import type { AuthTokens, AuthUser, UserRole } from '@/types/api';

export type { AuthResponse };
export { toSession };

/**
 * No password-reset endpoint is exported, and none exists on the server.
 *
 * <p>An earlier `forgotPassword()` helper here posted to `/auth/forgot-password`,
 * which `AuthController` has never mapped — every call it made answered 404. There
 * is no mail transport in this deployment to deliver a reset link, and re-issuing a
 * password is a clinic-administrator action, so the recovery screen describes that
 * workflow instead of pretending to send mail.
 */

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

/**
 * `GET /auth/me` returns the caller's profile plus the permissions the API enforces.
 */
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
