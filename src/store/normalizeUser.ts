// Server → client shape for the signed-in user.
//
// `GET /api/users/me` (and the login payload) return the raw Mongo document with
// refs populated:
//
//   role:          { role_code: "ADMIN", role_name: "Admin", permissions: [...] }
//   department_id: { _id, department_name, ... }
//   profile_image: "https://.../file.png"
//
// The app's `AuthUser` is flat on purpose — `useAccess` compares `role` against
// a role CODE and reads a top-level `permissions[]`, and every screen expects
// `department_id` to be an id string. Normalising once here keeps that contract
// in a single place instead of teaching each consumer about the wire format.
import type { AuthUser } from './tokenStorage';

type Populated = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** `"64ab…"` or `{ _id: "64ab…" }` → `"64ab…"`. */
function refId(v: unknown): string | undefined {
  if (typeof v === 'string') return str(v);
  if (v && typeof v === 'object') return str((v as Populated)._id);
  return undefined;
}

/** Reads a key off a ref only when it was populated into an object. */
function refField(v: unknown, key: string): string | undefined {
  if (v && typeof v === 'object') return str((v as Populated)[key]);
  return undefined;
}

/** Drops `undefined` values so a merge never blanks an existing field. */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Map a raw server user onto `AuthUser`.
 *
 * `role` / `role_id` are both accepted — the backend sends `role_id` populated
 * plus a `role` virtual mirroring it, but only one is guaranteed on every route.
 * Permissions come from whichever of those is populated; the live list still
 * comes from `GET /roles/permissions/me` at read time (see `useAccess`), this is
 * just the snapshot used until that resolves.
 */
export function normalizeAuthUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Populated;

  const roleRef = u.role_id ?? u.role;
  const deptRef = u.department_id ?? u.department;

  const permissions = ((): string[] | undefined => {
    const fromRole =
      roleRef && typeof roleRef === 'object'
        ? (roleRef as Populated).permissions
        : undefined;
    const list = Array.isArray(u.permissions) ? u.permissions : fromRole;
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : undefined;
  })();

  const photo = str(u.profile_image) ?? str(u.profile_photo);

  return {
    _id: String(u._id ?? u.id ?? ''),
    email: str(u.email) ?? '',
    employee_id: str(u.employee_id),
    first_name: str(u.first_name),
    last_name: str(u.last_name),

    // Flattened role: `role` is the CODE (what the RBAC checks compare), with
    // the human label kept alongside for display.
    role: refField(roleRef, 'role_code') ?? str(u.role_code) ?? (typeof u.role === 'string' ? u.role : undefined),
    role_name: refField(roleRef, 'role_name'),
    permissions,

    department_id: refId(deptRef),
    department_name: refField(deptRef, 'department_name') ?? refField(deptRef, 'name'),

    designation: str(u.designation),
    status: str(u.status) as AuthUser['status'],
    phone: str(u.phone),
    location: str(u.location),
    last_login_at: str(u.last_login_at),

    // Both keys are populated: `profile_image` is what the API sends, and the
    // rest of the app (Avatar → resolvePhotoUri) already scans either name.
    profile_image: photo,
    profile_photo: photo,

    allowed_devices: Array.isArray(u.allowed_devices)
      ? (u.allowed_devices as AuthUser['allowed_devices'])
      : undefined,
  };
}

/**
 * Merge a fresh `/me` payload onto the stored session user.
 *
 * `/me` does not echo every field the login response carries (`allowed_devices`
 * is the one that matters — losing it would silently disable the device gate),
 * so absent keys keep their previous value rather than being overwritten with
 * `undefined`.
 */
export function mergeAuthUser(
  prev: AuthUser | null,
  next: AuthUser | null,
): AuthUser | null {
  if (!next) return prev;
  if (!prev) return next;
  return { ...prev, ...defined(next) };
}
