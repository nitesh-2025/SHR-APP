import type { Holiday } from '../store/workCalendarApi';
import { parseYmd, ymd } from './date';

export interface HolidayDate {
  id: string;
  name: string;
  recurring: boolean;
  date: Date;
  /** `YYYY-MM-DD` — sortable and directly comparable against today. */
  key: string;
}

/**
 * The holiday master → one year's calendar.
 *
 * A recurring holiday is stored as month + day with no year, so it only becomes
 * a DATE once you say which year you are looking at. A one-off carries its own
 * date and is dropped unless it falls in that year — otherwise stepping to 2025
 * would still list a 2026-only holiday.
 *
 * Shared by the Leave screen's Holidays tab and the Work Calendar screen: the
 * recurring/one-off rule is policy, and two copies of policy drift.
 */
export function resolveHolidays(
  list: Holiday[] | undefined,
  year: number,
): HolidayDate[] {
  const out: HolidayDate[] = [];

  for (const h of list ?? []) {
    // `active: false` is how HR retires a holiday without deleting the history.
    if (h.active === false) continue;

    let date: Date | null = null;

    if (h.recurring && h.month != null && h.day != null) {
      // `month` is 1-based on the wire. Guarding the 0 case rather than
      // subtracting blindly: one record stored 0-based would otherwise shift
      // every holiday a month backwards, silently.
      date = new Date(year, Math.max(0, h.month - 1), h.day);
    } else if (h.date) {
      const parsed = parseYmd(h.date);
      if (parsed && parsed.getFullYear() === year) date = parsed;
    }

    if (!date || Number.isNaN(date.getTime())) continue;
    out.push({
      id: h._id,
      name: h.name,
      recurring: h.recurring,
      date,
      key: ymd(date),
    });
  }

  return out.sort((a, b) => a.key.localeCompare(b.key));
}
