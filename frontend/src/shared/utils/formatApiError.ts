/**
 * Normalizes unknown API/catch errors into a user-facing string.
 * Matches common patterns used across screens (message, detail).
 */
export function formatApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return fallback;

  const e = error as Record<string, unknown>;
  const message = e.message;
  const detail = e.detail;

  if (typeof message === 'string' && message.trim()) return message;
  if (typeof detail === 'string' && detail.trim()) return detail;

  return fallback;
}
