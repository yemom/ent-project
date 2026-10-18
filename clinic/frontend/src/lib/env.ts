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

export const env = {
  apiBaseUrl: normaliseBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    'http://localhost:8090/api/v1'
  ),
  appUrl: normaliseBaseUrl(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3001')
} as const;
