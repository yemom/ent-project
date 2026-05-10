import type { AxiosError } from 'axios';

export function parseApiError(err: unknown) {
  if (!err) return { message: 'Unknown error' };
  if ((err as any).message) return { message: (err as any).message };
  return { message: JSON.stringify(err) };
}

export function getFriendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  // Prefer backend messages when they are clear, but keep the final text friendly.
  const parsed = parseApiError(err);
  const rawMessage = String(parsed.message || '').trim();

  if (!rawMessage) return fallback;

  if (/network error/i.test(rawMessage)) return 'We could not reach the server. Please check your connection and try again.';
  if (/unauthorized|forbidden/i.test(rawMessage)) return 'You do not have permission to perform this action.';
  if (/validation|invalid/i.test(rawMessage)) return 'Please review the form fields and correct any highlighted values.';
  if (/not found/i.test(rawMessage)) return 'We could not find the requested item.';

  return rawMessage;
}

export function isAxiosError(err: unknown): err is AxiosError {
  return Boolean(err && (err as any).isAxiosError);
}

export default { parseApiError, getFriendlyErrorMessage, isAxiosError };
