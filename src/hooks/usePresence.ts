import { useMemo } from "react";
import { useAppSelector } from "../store";
import { selectOnlineMap } from "../store/presenceSlice";
import { useGetContactsQuery } from "../store/chatApi";

/**
 * Live online-presence helpers for avatars across the app.
 * - `isUserOnline(userId)`  — by auth user id.
 * - `isEmpOnline(empCode)`  — by employee_id (EMP-xxxx), resolved to a user.
 *
 * The contacts query is shared/cached by RTK Query, so using this hook in many
 * places triggers a single network request — no performance impact.
 */
export function usePresence() {
  const online = useAppSelector(selectOnlineMap);
  const { data: contacts = [] } = useGetContactsQuery();

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
