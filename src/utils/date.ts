// Date helpers. Everything is hand-formatted rather than going through
// `toLocaleDateString` — its options are silently ignored on a Hermes build
// without Intl, which would render a different string on some devices.

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** `Date` → `YYYY-MM-DD` in LOCAL time (`toISOString` would shift the day). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` → local `Date` at midnight. Invalid input → null. */
export function parseYmd(value?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** First and last day of a month as `YYYY-MM-DD`, or of the whole year. */
export function monthRange(year: number, month: number | null): { from: string; to: string } {
  if (month === null) {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return {
    from: ymd(new Date(year, month, 1)),
    to: ymd(new Date(year, month + 1, 0)),
  };
}

/** `2026-07-26` → `26 Jul 2026`. */
export function fmtDate(value?: string): string {
  const d = parseYmd(value) ?? (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** `2026-07-26` → `26 Jul`. */
export function fmtDayShort(value?: string): string {
  const d = parseYmd(value) ?? (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

/** `2026-07-26` → `Sun`. */
export function weekdayOf(value?: string): string {
  const d = parseYmd(value) ?? (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  return WEEKDAY_LABEL[d.getDay()];
}

/** `09:15 AM` from an ISO timestamp. */
export function fmtTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 200 → `3h 20m`, 45 → `45m`, 0 → `0m`. */
export function fmtDuration(minutes?: number): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

/**
 * `2026-08-16T09:12:00Z` → `2d ago`.
 *
 * A ticket's age is the thing you scan a queue for — "is anyone looking at
 * this yet" — and an absolute date makes you do the subtraction yourself.
 * Anything older than a month falls back to the date, because "47d ago" is a
 * number nobody converts back into a day they remember.
 */
export function timeAgo(value?: string): string {
  if (!value) return '';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return fmtDayShort(value.slice(0, 10));
}

/** Inclusive day count between two `YYYY-MM-DD` values. 0 when unparseable. */
export function daysBetween(from?: string, to?: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}
