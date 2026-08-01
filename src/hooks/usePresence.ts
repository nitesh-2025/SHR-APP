import { useMemo } from "react";
import { useAppSelector } from "../store";
import { selectOnlineMap } from "../store/presenceSlice";
import { useGetContactsQuery } from "../store/chatApi";

/**
 * Live online-presence helpers for avatars across the app.
 * - `isUserOnline(userId)`  — by auth user id.
 * - `isEmpOnline(empCode)`  — by employee_id (EMP-xxxx), resolved to a user.
 *
 * `isUserOnline` needs nothing but the socket presence map, so the directory is
 * NOT fetched by default — pulling every employee just to draw a green dot on a
 * chat row is a whole-company download for one boolean. Only a caller that maps
 * employee codes (`isEmpOnline`) opts in with `{ directory: true }`; without it
 * `isEmpOnline` reports offline rather than firing a hidden request.
 */
export function usePresence(opts?: { directory?: boolean }) {
  const online = useAppSelector(selectOnlineMap);
  const { data: contacts = [] } = useGetContactsQuery(undefined, {
    skip: !opts?.directory,
  });

  const empToUser = useMemo(() => {
    const m: Record<string, string> = {};
    contacts.forEach((c) => { if (c.employee_id) m[c.employee_id] = c._id; });
    return m;
  }, [contacts]);

  const isUserOnline = (userId?: string | null) => !!userId && !!online[String(userId)];
  const isEmpOnline = (empCode?: string | null) => {
    if (!empCode) return false;
    const uid = empToUser[empCode];
    return !!uid && !!online[uid];
  };

  return { online, empToUser, isUserOnline, isEmpOnline };
}
