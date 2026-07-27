import { API_BASE_URL } from '../config/env';

/**
 * Turn an RTK Query error into something worth showing a user.
 *
 * Written because the dashboard used to print "check EXPO_PUBLIC_BASE_URL" for
 * every failure — a 401 or a 403 would send someone editing a .env file that
 * was never wrong. The base-URL hint now appears ONLY when the request truly
 * never reached a server.
 *
 * RTK hands back three different shapes, none of them a plain Error:
 *   { status: number, data: unknown }            — the server answered
 *   { status: 'FETCH_ERROR' | …, error: string } — it did not
 *   { message: string }                          — a thrown/serialized error
 */
export interface ApiErrorInfo {
  title: string;
  detail: string;
  /** HTTP status when the server answered — handy in the UI for bug reports. */
  status?: number;
}

function serverMessage(data: unknown): string | null {
  if (typeof data === 'string' && data.trim()) return data.trim().slice(0, 180);
  if (data && typeof data === 'object') {
    const m = (data as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return null;
}

export function describeApiError(err: unknown): ApiErrorInfo {
  if (!err) return { title: 'Something went wrong', detail: 'Please try again.' };

  const status = (err as { status?: unknown }).status;

  // ── Never reached a server ───────────────────────────────────────────────
  if (status === 'FETCH_ERROR') {
    return {
      title: "Can't reach the server",
      detail: API_BASE_URL
        ? `No response from ${API_BASE_URL}. Check your connection — a sleeping free-tier host can also take ~30s to wake on the first request.`
        : 'EXPO_PUBLIC_BASE_URL is empty. Set it in .env and restart Metro with `npx expo start -c`.',
    };
  }
  if (status === 'TIMEOUT_ERROR') {
    return {
      title: 'Server took too long',
      detail: 'The request timed out. Pull to refresh to try again.',
    };
  }
  if (status === 'PARSING_ERROR') {
    return {
      title: 'Unexpected response',
      detail: 'The server replied with something that is not JSON.',
    };
  }

  // ── The server answered ──────────────────────────────────────────────────
  if (typeof status === 'number') {
    const msg = serverMessage((err as { data?: unknown }).data);
    if (status === 401)
      return {
        status,
        title: 'Session expired',
        detail: msg || 'Please sign in again.',
      };
    if (status === 403)
      return {
        status,
        title: 'Not available for your role',
        detail: msg || 'Your account does not have access to this data.',
      };
    if (status === 404)
      return {
        status,
        title: 'Not found on the server',
        detail: msg || 'This endpoint is missing on the backend build you are pointed at.',
      };
    if (status >= 500)
      return {
        status,
        title: 'Server error',
        detail: msg || `The backend returned ${status}.`,
      };
    return { status, title: `Request failed (${status})`, detail: msg || 'Please try again.' };
  }

  const message = (err as { message?: string }).message;
  return {
    title: 'Something went wrong',
    detail: message || 'Please try again.',
  };
}
