import type { AxiosError } from 'axios';

type BackendErrorBody = {
  message?: string;
};

export function parseApiError(err: unknown) {
  if (!err) return { message: 'Unknown error' };
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const retryAfter = getRetryAfterSeconds(err);
    const responseMessage = getBackendErrorMessage(err.response?.data);

    if (status === 429) {
      return {
        message: toRateLimitMessage(retryAfter),
        status,
        retryAfter
      };
    }

    if (responseMessage) {
      return { message: responseMessage, status };
    }
  }
  if (hasMessage(err)) return { message: err.message };
  return { message: JSON.stringify(err) };
}

export function getFriendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  // Prefer backend messages when they are clear, but keep the final text friendly.
  const parsed = parseApiError(err);
  const rawMessage = String(parsed.message || '').trim();

  if (!rawMessage) return fallback;

  if (/network error/i.test(rawMessage)) return 'We could not reach the server. Please check your connection and try again.';
  if (/too many requests|rate limit|status code 429/i.test(rawMessage)) return toRateLimitMessage(getRetryAfterSeconds(err));
  if (/unauthorized|forbidden/i.test(rawMessage)) return 'You do not have permission to perform this action.';
  if (/validation|invalid/i.test(rawMessage)) return 'Please review the form fields and correct any highlighted values.';
  if (/not found/i.test(rawMessage)) return 'We could not find the requested item.';

  return rawMessage;
}

export function isAxiosError(err: unknown): err is AxiosError {
  return Boolean(
    err
      && typeof err === 'object'
      && 'isAxiosError' in err
      && (err as { isAxiosError?: unknown }).isAxiosError
  );
}

export function getRetryAfterSeconds(err: unknown) {
  if (!isAxiosError(err)) return undefined;
  const retryAfter = err.response?.headers?.['retry-after'];
  const value = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : undefined;
}

export function toRateLimitMessage(retryAfterSeconds?: number) {
  if (!retryAfterSeconds) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (retryAfterSeconds < 60) {
    return `Too many requests. Please try again in ${retryAfterSeconds} seconds.`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many requests. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export function toUserFacingError(err: unknown, fallback?: string) {
  return new Error(getFriendlyErrorMessage(err, fallback));
}

function hasMessage(err: unknown): err is { message: string } {
  return Boolean(
    err
      && typeof err === 'object'
      && 'message' in err
      && typeof (err as { message?: unknown }).message === 'string'
  );
}

function getBackendErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') return undefined;
  const body = data as BackendErrorBody;
  return typeof body.message === 'string' ? body.message : undefined;
}

export default { parseApiError, getFriendlyErrorMessage, isAxiosError, getRetryAfterSeconds, toRateLimitMessage, toUserFacingError };
