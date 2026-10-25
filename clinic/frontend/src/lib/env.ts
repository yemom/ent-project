/**
 * Public runtime configuration.
 *
 * <p>The base URL is trimmed and stripped of a trailing slash. That is not
 * cosmetic: a stray trailing space in the environment variable is enough to make
 * every request hit a URL-encoded path that 401s, and the UI then reports
 * "server is waking up" forever with no other clue. Normalising here turns that
 * class of misconfiguration into a working app.
 */
function normaliseBaseUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  return raw.replace(/\/+$/, '');
}

/**
 * Compose build args are embedded in the browser bundle. When that bundle was
 * built with localhost but opened from another device, localhost points back to
 * the visitor's device. Keep the configured API port/path and substitute the
 * host serving this page at runtime.
 */
function browserAwareApiUrl(value: string | undefined): string {
  const browserFallback =
    typeof window === 'undefined'
      ? 'http://localhost:8090/api/v1'
      : `${window.location.protocol}//${window.location.hostname}:8090/api/v1`;
  const configured = normaliseBaseUrl(value, browserFallback);
  if (typeof window === 'undefined') return configured;

  try {
    const url = new URL(configured, window.location.origin);
    if (
      ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname) &&
      !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}

function browserAwareAppUrl(value: string | undefined): string {
  const configured = normaliseBaseUrl(value, 'http://localhost:3000');
  if (typeof window === 'undefined') return configured;

  try {
    const url = new URL(configured, window.location.origin);
    if (
      ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname) &&
      !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ) {
      return window.location.origin;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return window.location.origin;
  }
}

export const env = {
  apiBaseUrl: browserAwareApiUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
  appUrl: browserAwareAppUrl(process.env.NEXT_PUBLIC_APP_URL)
} as const;
