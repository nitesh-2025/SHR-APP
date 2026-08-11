import { useMemo } from "react";

import { selectCurrentUser, useAppSelector } from "../store";
import {
  useGetMyProfileQuery,
  useGetUpcomingBirthdaysQuery,
  type UpcomingBirthday,
} from "../store/employeesApi";

/**
 * The window every birthday surface asks for.
 *
 * It used to be `days: 1` here and `days: 30` on the Birthdays screen — two
 * cache entries, two round trips, and two DIFFERENT answers: the one-day
 * response came back without the signed-in user's own row, so the home screen
 * never knew it was your birthday while the Birthdays screen was already
 * wishing you. One window means one request (RTK Query dedupes by argument) and,
 * more importantly, one set of facts.
 */
export const BIRTHDAY_WINDOW_DAYS = 30;

/** Trimmed, lower-cased, or `null` — everything compared here is an identifier. */
function key(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s || null;
}

/**
 * Who is celebrating today, split into "me" and "everyone else".
 *
 * A day's window is all this needs — the full month lives on the Birthdays
 * screen; here the question is only "is anyone celebrating right now".
 *
 * ── Why identity is matched on FOUR keys ──────────────────────────────────
 *
 * The session user and this list are two different collections. `users` carries
 * the login (its `_id` is a USER id, and its `employee_id` is whatever that
 * document happens to hold — sometimes the employee CODE, sometimes the
 * employee's `_id`, sometimes nothing at all on an admin account); the birthday
 * rows come from `employees_v2` and carry the employee `_id` plus the code.
 *
 * Matching on `employee_id` alone therefore failed on exactly the accounts
 * where it matters most: the signed-in user saw their OWN birthday listed as a
 * colleague's, complete with a "send your wishes" chevron pointing at
 * themselves — and never got the greeting. `GET /employees/me/profile` is the
 * authoritative link between the two collections, and it is already cached by
 * the profile and documents screens, so reading it here is free on any session
 * that has visited either.
 *
 * Callers are free to use this from several places at once. RTK Query dedupes
 * by argument, so the greeting and the banner asking together still costs one
 * request each.
 */
export function useTodaysBirthdays() {
  const me = useAppSelector(selectCurrentUser);
  const profile = useGetMyProfileQuery();
  const { data } = useGetUpcomingBirthdaysQuery({
    days: BIRTHDAY_WINDOW_DAYS,
  });

  const today = useMemo(() => (data ?? []).filter((b) => b.is_today), [data]);

  /** Every id this person is known by, on either collection. */
  const identity = useMemo(() => {
    const set = new Set<string>();
    for (const v of [
      profile.data?._id,
      profile.data?.employee_id,
      me?.employee_id,
      // The user id is included last and only helps when the two collections
      // share an id — harmless when they do not, since an employee `_id` from
      // another person can never equal this user's own `_id`.
      me?._id,
    ]) {
      const k = key(v);
      if (k) set.add(k);
    }
    return set;
  }, [profile.data, me]);

  const isSelf = useMemo(() => {
    return (b: UpcomingBirthday) => {
      const byId = key(b._id);
      const byCode = key(b.employee_id);
      return Boolean((byId && identity.has(byId)) || (byCode && identity.has(byCode)));
    };
  }, [identity]);

  const mine = useMemo(() => today.find(isSelf), [today, isSelf]);
  const others = useMemo(() => today.filter((b) => !isSelf(b)), [today, isSelf]);

  return { mine, others, isMine: Boolean(mine) };
}
