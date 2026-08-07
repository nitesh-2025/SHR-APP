import { API_BASE_URL } from '../config/env';
import type { ToastOptions } from './toast';

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
  /**
   * The one line to lead with. When the backend explained itself, this IS the
   * backend's sentence — every call site in the app renders `.title` and
   * nothing else, so a friendly label here means the real reason never reaches
   * the screen.
   */
  title: string;
  /** Supporting line. Empty when the title already says everything. */
  detail: string;
  /** HTTP status when the server answered — handy in the UI for bug reports. */
  status?: number;
  /** The backend's own words, unwrapped. Absent when it did not send any. */
  serverMessage?: string;
}

/** Trim, collapse whitespace, and keep it to one readable line. */
const tidy = (v: string): string => v.trim().replace(/\s+/g, ' ').slice(0, 300);

/**
 * Dig the backend's message out of whatever shape it arrived in.
 *
 * The old version only accepted `{ message: string }`, which quietly missed the
 * most common failure this app sees: NestJS's `ValidationPipe` answers with
 * `{ statusCode: 400, message: string[], error: 'Bad Request' }`. An ARRAY fails
 * a `typeof === 'string'` check, so "phone must be a valid phone number" was
 * dropped and the user got "Request failed (400)" instead.
 */
function serverMessage(data: unknown): string | null {
  if (typeof data === 'string' && data.trim()) return tidy(data);
  if (!data || typeof data !== 'object') return null;

  const record = data as Record<string, unknown>;

  // Some gateways wrap the real payload one level down.
  const nested = record.data;
  if (nested && typeof nested === 'object') {
    const inner = serverMessage(nested);
    if (inner) return inner;
  }

  // `message` first, then `error`, then a validation bag. NestJS uses `message`
  // for both the human sentence and the validation array; `error` is usually
  // just the status name ("Bad Request"), so it ranks below.
  for (const key of ['message', 'error', 'errors', 'detail'] as const) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) return tidy(value);

    if (Array.isArray(value)) {
      const lines = value
        .map((v) =>
          typeof v === 'string'
            ? v
            : typeof (v as { message?: unknown })?.message === 'string'
              ? (v as { message: string }).message
              : null,
        )
        .filter((v): v is string => Boolean(v && v.trim()));
      // Joined rather than only-the-first: a validation failure usually names
      // two or three fields, and fixing one at a time is a round trip each.
      if (lines.length) return tidy(lines.join(' · '));
    }

    // `{ errors: { phone: "must be 10 digits" } }`
    if (value && typeof value === 'object') {
      const lines = Object.values(value as Record<string, unknown>)
        .map((v) => (typeof v === 'string' ? v : null))
        .filter((v): v is string => Boolean(v && v.trim()));
      if (lines.length) return tidy(lines.join(' · '));
    }
  }

  return null;
}

/**
 * Statuses where the backend's sentence is worth more than ours.
 *
 * 401 and 403 are excluded on purpose: their bodies say "Unauthorized" or
 * "Forbidden resource", which tells a user nothing they can act on. Everything
 * else — a rejected field, a duplicate, a broken rule, a crash — is where the
 * server actually explains itself, and that sentence should lead.
 */
const TRUST_SERVER = (status: number) => status !== 401 && status !== 403;

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
    const msg = serverMessage((err as { data?: unknown }).data) ?? undefined;

    // Lead with the backend's own words wherever they are worth reading. The
    // status still travels in `detail` so a screenshot is enough to file a bug.
    if (msg && TRUST_SERVER(status)) {
      return { status, serverMessage: msg, title: msg, detail: `Server returned ${status}.` };
    }

    if (status === 401)
      return {
        status,
        serverMessage: msg,
        title: 'Session expired',
        detail: msg || 'Please sign in again.',
      };
    if (status === 403)
      return {
        status,
        serverMessage: msg,
        title: 'Not available for your role',
        detail: msg || 'Your account does not have access to this data.',
      };
    if (status === 404)
      return {
        status,
        serverMessage: msg,
        title: 'Not found on the server',
        detail: 'This endpoint is missing on the backend build you are pointed at.',
      };
    if (status >= 500)
      return {
        status,
        serverMessage: msg,
        title: 'Server error',
        detail: `The backend returned ${status} and sent no message.`,
      };

    return {
      status,
      serverMessage: msg,
      title: `Request failed (${status})`,
      detail: 'The server rejected it without saying why.',
    };
  }

  const message = (err as { message?: string }).message;
  return {
    title: message ? tidy(message) : 'Something went wrong',
    detail: message ? '' : 'Please try again.',
  };
}

/**
 * The arguments a toast wants: `toast.error(...toastApiError(e))`.
 *
 * Exists because every call site was writing `toast.error(describeApiError(e).title)`
 * and throwing `detail` away — which, before the change above, threw away the
 * ONLY copy of the backend's message.
 */
export function toastApiError(err: unknown): [string, ToastOptions] {
  const { title, detail, serverMessage: msg } = describeApiError(err);
  return [
    title,
    {
      description: detail || undefined,
      // A validation failure can name three fields at once, and the default
      // four seconds is not enough to read one of those and act on it. Only
      // stretched when the backend actually said something — a plain
      // "Can't reach the server" does not need eight seconds on screen.
      duration: msg ? 8000 : undefined,
    },
  ];
}
