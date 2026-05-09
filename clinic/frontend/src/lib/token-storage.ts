const ACCESS_TOKEN_KEY = 'clinic.accessToken';
const REFRESH_TOKEN_KEY = 'clinic.refreshToken';
const USER_KEY = 'clinic.user';
const AUTH_COOKIE = 'clinic.auth';
const ROLE_COOKIE = 'clinic.role';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export const tokenStorage = {
  getAccessToken() {
    if (!canUseStorage()) return null;
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser<T>() {
    if (!canUseStorage()) return null;
    const raw = window.sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setSession(accessToken: string, user: unknown, refreshToken?: string) {
    if (!canUseStorage()) return;
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    if (refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    const role = (user as { role?: string } | null)?.role;
    window.document.cookie = `${AUTH_COOKIE}=1; path=/; sameSite=lax`;
    if (role) {
      window.document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; sameSite=lax`;
    }
  },
  clear() {
    if (!canUseStorage()) return;
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
    window.document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0`;
  }
};
