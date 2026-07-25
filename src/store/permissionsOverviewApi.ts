import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";

export interface PermissionUserRow {
  _id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  status?: string;
  designation?: string;
  /** Uploaded photo; when absent the Avatar falls back to the gender default. */
  profile_image?: string;
  gender?: string;
  role_code?: string;
  role_name?: string;
  department?: { _id: string; name: string; code?: string } | null;
  permissions: string[];
  permission_count: number;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type ListArgs = {
  page?: number;
  limit?: number;
  search?: string;
  role_code?: string;
};
type ListResult = { items: PermissionUserRow[]; meta?: PageMeta };

export const permissionsOverviewApi = createApi({
  reducerPath: "permissionsOverviewApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/users`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  endpoints: (b) => ({
    getPermissionsOverview: b.query<ListResult, ListArgs | void>({
      query: (params) => ({
        url: "/permissions-overview",
        params: (params || {}) as Record<string, unknown>,
      }),
      transformResponse: (r: Envelope<PermissionUserRow[]>) => ({
        items: r.data || [],
        meta: r.meta,
      }),
    }),
  }),
});

export const { useGetPermissionsOverviewQuery } = permissionsOverviewApi;
