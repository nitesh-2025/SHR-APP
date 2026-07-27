import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import { normalizeAuthUser } from "./normalizeUser";
import type { AuthUser } from "./tokenStorage";

/**
 * Users (RBAC accounts) — separate from the Employee HR record.
 *  - Employee ↔ User are linked by the shared `employee_id` code (e.g. EMP-1001).
 *  - A user's `role_id` (populated) carries the assignable role (role_code).
 * Used by Departments → member Role assignment and the Users module (CRUD +
 * activate/deactivate). Backend enforces that only ADMIN / SUPER_ADMIN may
 * create / edit / change status (POST /api/users, PATCH /api/users/:id).
 */

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UserRoleRef {
  _id: string;
  role_code: string;
  role_name: string;
}

export interface UserDeptRef {
  _id: string;
  department_name?: string;
  name?: string;
}

export interface PortalUser {
  _id: string;
  employee_id: string; // EMP code — links to the Employee record
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: "active" | "inactive" | "suspended";
  // `role_id` is populated server-side; the `role` virtual mirrors it.
  role_id?: UserRoleRef | string;
  role?: UserRoleRef | string;
  role_name?: string;
  // Department + reporting manager (populated server-side when available).
  department_id?: UserDeptRef | string;
  department?: UserDeptRef;
  department_name?: string;
  manager_id?: { _id: string; first_name?: string; last_name?: string } | string;
  // Profile photo (Supabase URL) + gender (drives the default avatar tint).
  profile_image?: string;
  gender?: "male" | "female" | "other" | string;
}

type UserListArgs = {
  department_id?: string;
  role_code?: string;
  status?: string;
  limit?: number;
  page?: number;
  search?: string;
};

// Server pagination meta returned alongside the rows.
export interface UserListMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Paginated result — rows + meta, for the Users table (server-side paging).
export interface PagedUsers {
  items: PortalUser[];
  meta: UserListMeta;
}

// Aggregate counts for the analytics tiles (whole scoped set, not one page).
export interface UserStats {
  total: number;
  active: number;
  inactive: number;
}

// Create — admin assigns role, department & reporting manager.
export interface CreateUserBody {
  first_name: string;
  last_name?: string;
  email: string;
  password: string;
  role_code: string;
  employee_id?: string;
  department_id?: string;
  manager_id?: string;
  profile_image?: string;
  gender?: string;
}

// Update — same as create minus the password (email is immutable on edit).
export type UpdateUserBody = {
  id: string;
  first_name?: string;
  last_name?: string;
  role_code?: string;
  employee_id?: string;
  department_id?: string;
  manager_id?: string;
  profile_image?: string;
  gender?: string;
};

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/users`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["User", "Me"],
  endpoints: (b) => ({
    // The signed-in user, straight from the token — GET /api/users/me.
    // Returns the populated document (role + department as objects), so it is
    // normalised here and every consumer gets the flat `AuthUser`.
    getMe: b.query<AuthUser | null, void>({
      query: () => ({ url: "/me" }),
      transformResponse: (r: Envelope<unknown>) => normalizeAuthUser(r.data),
      providesTags: ["Me"],
    }),

    getUsers: b.query<PortalUser[], UserListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<PortalUser[]>) => r.data || [],
      providesTags: ["User"],
    }),

    // Paginated variant — keeps the server meta (total / total_pages) so the
    // Users table can page server-side instead of slicing a capped 20-row set.
    getUsersPage: b.query<PagedUsers, UserListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (
        r: Envelope<PortalUser[]> & { meta?: UserListMeta },
      ): PagedUsers => {
        const items = r.data || [];
        return {
          items,
          meta:
            r.meta ?? {
              total: items.length,
              page: 1,
              limit: items.length,
              total_pages: 1,
            },
        };
      },
      providesTags: ["User"],
    }),

    // Analytics tiles — accurate total / active / inactive across the whole
    // (role-scoped) user set. Backed by GET /api/users/stats.
    getUserStats: b.query<UserStats, void>({
      query: () => ({ url: "/stats" }),
      transformResponse: (r: Envelope<UserStats>) => r.data,
      providesTags: ["User"],
    }),

    createUser: b.mutation<PortalUser, CreateUserBody>({
      query: (body) => ({ url: "/", method: "POST", body }),
      transformResponse: (r: Envelope<PortalUser>) => r.data,
      invalidatesTags: ["User"],
    }),

    updateUser: b.mutation<PortalUser, UpdateUserBody>({
      query: ({ id, ...body }) => ({ url: `/${id}`, method: "PATCH", body }),
      transformResponse: (r: Envelope<PortalUser>) => r.data,
      invalidatesTags: ["User"],
    }),

    // Activate / deactivate — PATCH the status only.
    setUserStatus: b.mutation<PortalUser, { id: string; status: "active" | "inactive" }>({
      query: ({ id, status }) => ({ url: `/${id}`, method: "PATCH", body: { status } }),
      transformResponse: (r: Envelope<PortalUser>) => r.data,
      invalidatesTags: ["User"],
    }),

    // Admin patch — change a user's role (role_code → role_id resolved server-side).
    updateUserRole: b.mutation<PortalUser, { id: string; role_code: string }>({
      query: ({ id, role_code }) => ({ url: `/${id}`, method: "PATCH", body: { role_code } }),
      transformResponse: (r: Envelope<PortalUser>) => r.data,
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetUsersQuery,
  useGetUsersPageQuery,
  useGetUserStatsQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserStatusMutation,
  useUpdateUserRoleMutation,
} = usersApi;

// Helper — read the role_code off a (possibly unpopulated) user.
export const roleCodeOf = (u?: PortalUser): string => {
  const r = u?.role_id ?? u?.role;
  return r && typeof r === "object" ? r.role_code || "" : "";
};

// Helper — display name from first/last (falls back to email).
export const userFullName = (u?: PortalUser): string =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "—";

// Helper — department id string off a (possibly populated) user.
export const userDeptId = (u?: PortalUser): string => {
  const d = u?.department_id ?? u?.department;
  if (!d) return "";
  return String(typeof d === "object" ? d._id : d);
};

// Helper — readable department name off a user.
export const userDeptName = (u?: PortalUser): string =>
  u?.department?.department_name ||
  u?.department?.name ||
  u?.department_name ||
  (u?.department_id && typeof u.department_id === "object"
    ? u.department_id.department_name || u.department_id.name || ""
    : "") ||
  "";
