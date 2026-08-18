import type { AttendanceRecord } from '../store/attendanceApi';
import type { Leave } from '../store/leaveApi';
import type { WorkCalendarConfig } from '../store/workCalendarApi';
import type { HolidayDate } from './holidays';
import { parseYmd, ymd } from './date';

/**
 * The attendance month as a CALENDAR, not as a list of rows the server happens
 * to hold.
 *
 * An attendance record only exists for a day somebody punched. Rendering the
 * API response directly therefore draws a month with holes in it: the days you
 * were absent, the Sundays, the holidays and the days you were on approved
 * leave are all simply missing, and a missing day looks identical to a day that
 * never came. That is the bug behind "I cannot regularize my absent days" —
 * there was no row to tap.
 *
 * So the month is generated from the calendar and the records are joined ONTO
 * it. Every date between the range start and today gets a row, and each row
 * knows why it looks the way it does.
 */

export type DayKind =
  | 'present'
  | 'late'
  | 'half_day'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'weekoff'
  | 'future';

export interface DayRow {
  /** `YYYY-MM-DD` — the row's identity everywhere in the screen. */
  key: string;
  date: Date;
  kind: DayKind;
  /** Present only when the day was actually recorded. */
  record?: AttendanceRecord;
  /** Named holiday, when the day is one. */
  holidayName?: string;
  /** The approved leave covering this day, when there is one. */
  leave?: Leave;
  isToday: boolean;
  /**
   * A day off by policy — weekend or holiday. Absence on one of these is not
   * an absence, and it must not be counted or coloured as one.
   */
  isOff: boolean;
}

/**
 * Is this date a weekly off?
 *
 * `saturday_offs` holds WHICH Saturdays of the month are off (`[2, 4]` = the
 * 2nd and 4th), which is why the nth-Saturday arithmetic is here rather than a
 * blanket weekend test. Without the config loaded we fall back to Sunday only —
 * the conservative guess, because calling a working Saturday an "off" would
 * silently erase a real absence from the list.
 */
export function isWeeklyOff(date: Date, config?: WorkCalendarConfig): boolean {
  const day = date.getDay();
  if (day === 0) return config?.weekly_offs?.sunday ?? true;
  if (day === 6) {
    const offs = config?.weekly_offs?.saturday_offs;
    if (!offs?.length) return false;
    return offs.includes(Math.ceil(date.getDate() / 7));
  }
  return false;
}

/** `YYYY-MM-DD` → the approved leave covering it, if any. */
function leaveOn(key: string, leaves: Leave[]): Leave | undefined {
  return leaves.find(
    (l) =>
      l.status === 'approved' &&
      String(l.from_date).slice(0, 10) <= key &&
      key <= String(l.to_date).slice(0, 10),
  );
}

/**
 * Which of the day's facts wins the row's colour.
 *
 * A punched day always wins: somebody who worked a holiday worked it, and
 * showing that day as "Holiday" would hide the very thing worth regularizing.
 * Only once there is nothing recorded do the policy reasons apply, and only
 * after ALL of them is a day called absent — an unexplained absence is the last
 * resort, not the default.
 */
function kindOf(
  key: string,
  date: Date,
  record: AttendanceRecord | undefined,
  holiday: string | undefined,
  leave: Leave | undefined,
  off: boolean,
  todayKey: string,
): DayKind {
  if (key > todayKey) return 'future';

  if (record && record.status !== 'absent') {
    if (record.status === 'half_day') return 'half_day';
    if (record.is_late) return 'late';
    return 'present';
  }
  // A day with punches but an `absent` status (HR marked it after the fact)
  // still reads as a worked day for the reader — the badge says the rest.
  if (record?.clock_in?.at) return record.is_late ? 'late' : 'present';

  if (leave) return 'leave';
  if (holiday) return 'holiday';
  if (off) return 'weekoff';
  return 'absent';
}

export interface BuildDaysArgs {
  /** Inclusive `YYYY-MM-DD` bounds — normally the selected month. */
  from: string;
  to: string;
  records: Map<string, AttendanceRecord>;
  holidays: HolidayDate[];
  leaves: Leave[];
  config?: WorkCalendarConfig;
  /** Injected rather than read from the clock, so the result is testable. */
  todayKey: string;
}

/**
 * Build every day in the range, newest first.
 *
 * Future dates inside the range are dropped: this month's list would otherwise
 * open on a column of empty days nobody has lived yet, pushing today off the
 * first screen. A past month is generated whole, because all of it happened.
 */
export function buildDayRows({
  from,
  to,
  records,
  holidays,
  leaves,
  config,
  todayKey,
}: BuildDaysArgs): DayRow[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (!start || !end) return [];

  const holidayByKey = new Map(holidays.map((h) => [h.key, h.name]));
  const rows: DayRow[] = [];

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    const key = ymd(cursor);
    if (key > todayKey) break;

    const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const record = records.get(key);
    const holidayName = holidayByKey.get(key);
    const leave = leaveOn(key, leaves);
    const off = isWeeklyOff(date, config);

    rows.push({
      key,
      date,
      record,
      holidayName,
      leave,
      isToday: key === todayKey,
      isOff: Boolean(holidayName) || off,
      kind: kindOf(key, date, record, holidayName, leave, off, todayKey),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return rows.reverse();
}

/**
 * Month totals that describe the rows underneath them.
 *
 * `absent` counts only unexplained working days — the previous version counted
 * whatever the server returned with `status: absent`, which meant a month with
 * no records at all reported zero absences and read as a clean month.
 */
export function summarise(rows: DayRow[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;
  let off = 0;
  let minutes = 0;

  for (const r of rows) {
    if (r.kind === 'present') present += 1;
    else if (r.kind === 'late') {
      present += 1;
      late += 1;
    } else if (r.kind === 'half_day') present += 0.5;
    else if (r.kind === 'absent') absent += 1;
    else if (r.kind === 'leave') leave += 1;
    else if (r.kind === 'holiday' || r.kind === 'weekoff') off += 1;

    minutes += r.record?.total_work_minutes ?? 0;
  }

  return { present, late, absent, leave, off, minutes, days: rows.length };
}
