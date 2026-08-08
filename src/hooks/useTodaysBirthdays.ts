import { useMemo } from "react";

import { selectCurrentUser, useAppSelector } from "../store";
import { useGetUpcomingBirthdaysQuery } from "../store/employeesApi";

/**
 * Who is celebrating today, split into "me" and "everyone else".
 *
 * A day's window is all this needs — the full month lives on the Birthdays
 * screen; here the question is only "is anyone celebrating right now".
 *
 * Matched on the employee CODE, not `_id`: the session user's `_id` is a USER
 * id while this list carries EMPLOYEE ids, so comparing those two never matches
 * and the birthday silently never fires.
 *
 * Callers are free to use this from several places at once. RTK Query dedupes
 * by argument, so the greeting and the banner asking together still costs one
 * request.
 */
export function useTodaysBirthdays() {
  const me = useAppSelector(selectCurrentUser);
  const { data } = useGetUpcomingBirthdaysQuery({ days: 1 });

  const today = useMemo(() => (data ?? []).filter((b) => b.is_today), [data]);

  const mine = useMemo(
    () =>
      me?.employee_id
        ? today.find((b) => b.employee_id === me.employee_id)
        : undefined,
    [today, me],
  );

  const others = useMemo(
    () => today.filter((b) => b.employee_id !== me?.employee_id),
    [today, me],
  );

  return { mine, others, isMine: Boolean(mine) };
}
