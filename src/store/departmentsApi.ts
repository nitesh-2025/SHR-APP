import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

/**
 * Departments + the MANAGER-role users that can head them.
 * Backend: GET/POST/PATCH/DELETE /api/departments, GET /api/users.
 *  - department.manager_id → a USER with the MANAGER role (RBAC owner).
 *  - per-employee reporting line is on the Employee record (employeesApi).
 */

// A user that can be a department head (MANAGER role).
export interface ManagerUser {
  _id: string;
  first_name: string;
  last_name?: string;
  email?: string;
}

export interface DepartmentItem {
  _id: string;
  department_name: string;
  department_code: string;
  status: "active" | "inactive";
  manager_id?: ManagerUser | string | null;
  member_count?: number;
  agent_count?: number;
}

// Org-wide KPI summary for the dashboard cards (computed on the backend).
export interface DepartmentStats {
  total: number;
  active: number;
  headed: number;
  people: number;
}

export interface CreateDepartmentBody {
  department_name: string;
  department_code: string;
  manager_id?: string;
  status?: "active" | "inactive";
}

// department_code is immutable after creation → not part of the update body.
export type UpdateDepartmentBody = {
  id: string;
  department_name?: string;
  manager_id?: string | null;
  status?: "active" | "inactive";
};

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const departmentsApi = createApi({
  reducerPath: "departmentsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Department"],
  endpoints: (b) => ({
    getDepartments: b.query<DepartmentItem[], void>({
      query: () => ({ url: "/api/departments" }),
      transformResponse: (r: Envelope<DepartmentItem[]>) => r.data || [],
      providesTags: ["Department"],
    }),

    getDepartmentStats: b.query<DepartmentStats, void>({
      query: () => ({ url: "/api/departments/stats" }),
      transformResponse: (r: Envelope<DepartmentStats>) =>
        r.data || { total: 0, active: 0, headed: 0, people: 0 },
      providesTags: ["Department"],
    }),

    getDepartment: b.query<DepartmentItem, string>({
      query: (id) => ({ url: `/api/departments/${id}` }),
      transformResponse: (r: Envelope<DepartmentItem>) => r.data,
      providesTags: ["Department"],
    }),

    // MANAGER-role users — eligible department heads (backend rejects others).
    getManagerUsers: b.query<ManagerUser[], void>({
      query: () => ({ url: "/api/users", params: { role_code: "MANAGER", limit: 100 } }),
      transformResponse: (r: Envelope<ManagerUser[]>) => r.data || [],
    }),

    createDepartment: b.mutation<DepartmentItem, CreateDepartmentBody>({
      query: (body) => ({ url: "/api/departments", method: "POST", body }),
      transformResponse: (r: Envelope<DepartmentItem>) => r.data,
      invalidatesTags: ["Department"],
    }),

    updateDepartment: b.mutation<DepartmentItem, UpdateDepartmentBody>({
      query: ({ id, ...patch }) => ({ url: `/api/departments/${id}`, method: "PATCH", body: patch }),
      transformResponse: (r: Envelope<DepartmentItem>) => r.data,
      invalidatesTags: ["Department"],
    }),

    deleteDepartment: b.mutation<void, string>({
      query: (id) => ({ url: `/api/departments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Department"],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useGetDepartmentStatsQuery,
  useGetDepartmentQuery,
  useGetManagerUsersQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} = departmentsApi;
