import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

// Backend wraps every response as { success, message, data }.
interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Role {
  _id: string;
  role_name: string;
  role_code: string;
  permissions: string[];
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
}

// A single permission leaf in the catalog tree.
export interface PermissionLeaf {
  key: string;
  label: string;
  type: "view" | "button" | "api" | "action";
}

export interface PermissionModule {
  module: string;
  permissions: PermissionLeaf[];
}

export interface PermissionPortal {
  portal: string;
  modules: PermissionModule[];
}

export interface CreateRoleBody {
  role_name: string;
  role_code: string;
  permissions: string[];
  status?: "active" | "inactive";
}

export interface UpdateRoleBody {
  id: string;
  role_name?: string;
  permissions?: string[];
  status?: "active" | "inactive";
}

/**
 * Roles + permission-catalog API (real backend). Drives Settings → Security.
 * Access is enforced server-side (roleGuard): read/create/edit = ADMIN +
 * SUPER_ADMIN, delete = SUPER_ADMIN only. The UI mirrors the same gating.
 */
export const rolesApi = createApi({
  reducerPath: "rolesApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Role", "MyPermissions"],
  endpoints: (b) => ({
    getRoles: b.query<Role[], void>({
      query: () => ({ url: "/roles" }),
      transformResponse: (r: Envelope<Role[]>) => r.data || [],
      providesTags: ["Role"],
    }),

    // LIVE permission keys for the signed-in user (resolved from their role on
    // the server). Use this for UI gating instead of the login snapshot so a
    // role-permission change reflects on already-logged-in users without a
    // re-login (on next refetch — mount/focus/reconnect).
    getMyPermissions: b.query<string[], void>({
      query: () => ({ url: "/permissions/me" }),
      transformResponse: (r: Envelope<{ permissions: string[] }>) =>
        r.data?.permissions || [],
      providesTags: ["MyPermissions"],
    }),

    // Catalog grouped portal → modules → permissions (checkbox tree source).
    getPermissionCategories: b.query<PermissionPortal[], string | void>({
      query: (portal) => ({
        url: "/permissions/categories",
        params: portal ? { portal } : undefined,
      }),
      transformResponse: (r: Envelope<PermissionPortal[]>) => r.data || [],
    }),

    createRole: b.mutation<Role, CreateRoleBody>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      transformResponse: (r: Envelope<Role>) => r.data,
      invalidatesTags: ["Role"],
    }),

    updateRole: b.mutation<Role, UpdateRoleBody>({
      query: ({ id, ...body }) => ({ url: `/roles/${id}`, method: "PATCH", body }),
      transformResponse: (r: Envelope<Role>) => r.data,
      invalidatesTags: ["Role"],
    }),

    deleteRole: b.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      transformResponse: (_r, _m, id) => ({ id }),
      invalidatesTags: ["Role"],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetMyPermissionsQuery,
  useGetPermissionCategoriesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = rolesApi;
