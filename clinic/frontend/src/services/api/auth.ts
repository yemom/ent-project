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

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Password reset is self-service.
 *
 * <p>Both endpoints are public, because nobody can reset a password they cannot
 * sign in with. What makes that safe lives on the server, not here:
 * `POST /auth/forgot-password` answers identically for a registered address, an
 * unknown one and a deactivated account, so this layer — and the screen built on
 * it — never learns whether an account exists.
 *
 * <p>Redeeming a token invalidates every refresh token for the account, so any
 * session the user holds elsewhere stops working immediately.
 */
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  /**
   * Whether this deployment has a mail transport configured.
   *
   * <p>`false` means the server refused the request honestly instead of pretending
   * a message went out. It says nothing about whether the address is registered,
   * and the screen must not read it as an account-existence signal: it routes the
   * user to the front desk for every address alike.
   */
  emailSent: boolean;
}

export async function forgotPassword(
  request: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  const { data } = await apiClient.post<ForgotPasswordResponse>(
    '/auth/forgot-password',
    request
  );
  return data;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export async function resetPassword(request: ResetPasswordRequest): Promise<string> {
  const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', request);
  return data.message;
}