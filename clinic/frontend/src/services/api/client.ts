import axios, {
  AxiosError,
  AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/lib/env';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { tokenStorage } from '@/lib/token-storage';
import { useAuthStore } from '@/store/auth-store';
import type { ApiErrorResponse, AuthTokens, AuthUser } from '@/types/api';

/**
 * Requests that are safe to replay automatically after a transient failure.
 * Only idempotent verbs qualify, plus `/auth/login` (handled separately below
 * because a Render cold start manifests exactly as a socket timeout there).
 */
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);

export const API_TIMEOUT_MS = 20_000;
/** Give a waking-up Render instance room to boot before we give up. */
export const COLD_START_TIMEOUT_MS = 75_000;

/** Statuses a cold/proxy-restarted backend can legitimately return. */
export const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 8_000;

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: API_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: number;
  _authRetry?: boolean;
  _wakeNotified?: boolean;
};

/** A request is retriable when the backend is unreachable or transiently unavailable. */
function isTransientError(error: AxiosError): boolean {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
  if (!error.response) return true; // network error / DNS / socket reset
  return TRANSIENT_STATUS_CODES.has(error.response.status);
}

/** Which failure classes mean "the server is still waking up". */
export function isWakeUpFailure(error: unknown): boolean {
  const axiosError = error as AxiosError | undefined;
  if (!axiosError?.isAxiosError) return false;
  const status = axiosError.response?.status;
  if (status !== undefined && ![502, 503, 504].includes(status)) return false;
  if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') return true;
  return !axiosError.response;
}

function backoffDelay(attempt: number): number {
  // Full jitter keeps many clients from retrying in lockstep.
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.round(Math.random() * ceiling);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Module-level flag other parts of the app (the login form) can read to show
 * a "server is waking up" state instead of a raw timeout error.
 */
let serverAwake: boolean | null = null;
const listeners = new Set<(awake: boolean | null) => void>();

export function isServerAwake() {
  return serverAwake;
}

export function subscribeServerStatus(listener: (awake: boolean | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setServerStatus(awake: boolean | null) {
  if (serverAwake === awake) return;
  serverAwake = awake;
  listeners.forEach((listener) => listener(awake));
}

/**
 * Wake-up ping. Uses the public, DB-free `/health` endpoint, so it answers as
 * soon as the HTTP listener is up. Fire-and-forget: never throws.
 */
let wakeUpPromise: Promise<boolean> | null = null;

export function wakeUpServer(): Promise<boolean> {
  if (wakeUpPromise) return wakeUpPromise;

  const ping = async (): Promise<boolean> => {
    const attempt = async (remaining: number): Promise<boolean> => {
      try {
        const response = await axios.get<{ status?: string }>(
          `${env.apiBaseUrl}/health`,
          { timeout: 10_000, params: { t: Date.now() } }
        );
        if (response.status === 200) {
          setServerStatus(true);
          return true;
        }
        throw new Error(`Unexpected health status: ${response.status}`);
      } catch {
        if (remaining <= 0) {
          setServerStatus(false);
          return false;
        }
        await sleep(2_000);
        return attempt(remaining - 1);
      }
    };
    return attempt(2);
  };

  setServerStatus(null);
  wakeUpPromise = ping().finally(() => {
    wakeUpPromise = null;
  });

  return wakeUpPromise;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken ?? tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Login is allowed a much longer window because it is usually the request that
  // trips over a Render cold start.
  const url = config.url ?? '';
  if (url.includes('/auth/login')) {
    config.timeout = COLD_START_TIMEOUT_MS;
  }

  return config;
});

/** Full auth payload returned by /auth/login, /auth/refresh and /auth/register. */
type AuthSessionPayload = AuthTokens & { user: AuthUser };

let refreshPromise: Promise<AuthSessionPayload> | null = null;

async function refreshSession(): Promise<AuthSessionPayload> {
  if (!refreshPromise) {
    const { refreshToken } = useAuthStore.getState();
    refreshPromise = axios
      .post<AuthSessionPayload>(
        `${env.apiBaseUrl}/auth/refresh`,
        refreshToken ? { refreshToken } : {},
        { withCredentials: true, timeout: COLD_START_TIMEOUT_MS }
      )
      .then((response) => response.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function applySession(session: AuthSessionPayload) {
  // One call keeps tokens and the user (including its permissions) in sync.
  useAuthStore.getState().setSession(session);
}

/**
 * Replays a request through a bare axios call (not `apiClient`) so the retry
 * does not re-enter this interceptor chain.
 */
function replay(config: RetriableConfig): Promise<{ data: unknown; status: number }> {
  return axios.request({
    ...(config as AxiosRequestConfig),
    timeout: config.timeout ?? API_TIMEOUT_MS,
    validateStatus: () => true,
  }).then((response) => ({ data: response.data, status: response.status }));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestPath = originalRequest.url ?? '';
    const isLoginRequest = requestPath.includes('/auth/login');
    const isAuthRefreshRequest = requestPath.includes('/auth/refresh');
    const isRegisterRequest = requestPath.includes('/auth/register');

    // ---- 401: attempt token refresh exactly once -------------------------
    const isUnauthorized = error.response?.status === 401;
    if (isUnauthorized && !originalRequest._authRetry && !isAuthRefreshRequest) {
      originalRequest._authRetry = true;
      const { isHydrated, refreshToken, clearSession } = useAuthStore.getState();

      if (isHydrated && refreshToken) {
        try {
          const session = await refreshSession();
          applySession(session);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
          return replay(originalRequest).then((response) => {
            if (response.status >= 200 && response.status < 300) {
              return response as never;
            }
            return Promise.reject(error);
          });
        } catch {
          clearSession();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }

      if (!isLoginRequest && !isRegisterRequest) {
        clearSession();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // ---- transient failure: retry idempotent calls + login ----------------
    const retryCount = originalRequest._retry ?? 0;
    const method = (originalRequest.method ?? 'get').toLowerCase();
    const isRetriableVerb = IDEMPOTENT_METHODS.has(method) || isLoginRequest || isRegisterRequest;

    if (isRetriableVerb && retryCount < MAX_RETRIES && isTransientError(error)) {
      if (isWakeUpFailure(error) && !originalRequest._wakeNotified) {
        originalRequest._wakeNotified = true;
        setServerStatus(false);
      }

      const delay = backoffDelay(retryCount);
      originalRequest._retry = retryCount + 1;
      await sleep(delay);

      try {
        const response = await replay(originalRequest);
        if (response.status >= 200 && response.status < 300) {
          setServerStatus(true);
          return response as never;
        }
        // Server answered but rejected the replay (e.g. bad credentials) —
        // surface the freshest error rather than the original timeout.
        if (response.status >= 400 && response.status < 500) {
          return Promise.reject({
            ...error,
            response: { ...(error.response ?? {}), status: response.status, data: response.data },
            message: 'Request failed',
          });
        }
      } catch {
        // fall through to reject with the original error
      }

      if (retryCount + 1 >= MAX_RETRIES) {
        setServerStatus(false);
      }
    }

    if (error.response?.status === 429) {
      error.message = getFriendlyErrorMessage(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;