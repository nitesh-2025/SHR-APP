import { useAppSelector, selectCurrentUser } from "../store";
import { useGetMyPermissionsQuery } from "../store/rolesApi";

const SUPER = "SUPER_ADMIN";
const ADMIN = "ADMIN";

/**
 * Central frontend access gate. Mirrors the backend RBAC:
 *   - SUPER_ADMIN  → everything (god mode).
 *   - others       → must hold the required permission key(s) in their role,
 *                    OR be ADMIN when `adminBypass` is set (admin-managed areas).
 *
 * Usage:
 *   const { allowed, isSuperAdmin } = useAccess({
 *     anyOf: ["staff.admin.role.view"], adminBypass: true,
 *   });
 */
export function useAccess(opts?: {
  anyOf?: string[]; // user needs at least ONE of these keys
  allOf?: string[]; // user needs ALL of these keys
  adminBypass?: boolean; // ADMIN role passes regardless of keys
}) {
  const user = useAppSelector(selectCurrentUser);
  const role = user?.role;

  // LIVE permissions from the server (re-fetched on mount/focus/reconnect), so a
  // role-permission change applies to already-logged-in users without re-login.
  // Falls back to the login snapshot until the first fetch resolves.
  const { data: livePerms } = useGetMyPermissionsQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });
  const perms = livePerms ?? user?.permissions ?? [];

  const isSuperAdmin = role === SUPER;
  const isAdmin = role === ADMIN;

  const has = (k: string) => perms.includes(k);

  let allowed = isSuperAdmin;
  if (!allowed && opts?.adminBypass && isAdmin) allowed = true;
  if (!allowed && opts?.anyOf?.length) allowed = opts.anyOf.some(has);
  if (!allowed && opts?.allOf?.length) allowed = opts.allOf.every(has);
  // No requirement supplied → any authenticated user passes.
  if (!opts?.anyOf?.length && !opts?.allOf?.length && !opts?.adminBypass)
    allowed = !!user;

  return { allowed, isSuperAdmin, isAdmin, role, has };
}

/** Quick boolean check for a single permission key (SUPER_ADMIN always true). */
export function useHasPermission(key: string) {
  const { isSuperAdmin, has } = useAccess();
  return isSuperAdmin || has(key);
}
