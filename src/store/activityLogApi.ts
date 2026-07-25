import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";

export interface ChangeRef {
  id: string;
  label: string;
  model?: string;
}
export type ChangeValue = string | number | boolean | null | ChangeRef | Record<string, unknown>;

export interface ActivityLogItem {
  _id: string;
  actor_id?: string;
  actor_name: string;
  actor_role?: string;
  action: "create" | "update" | "delete";
  entity: string;
  entity_id?: string;
  entity_label?: string;
  changes?: Record<string, { from: ChangeValue; to: ChangeValue }>;
  snapshot?: Record<string, unknown>;
  description?: string;
  source?: string;
  ip_address?: string;
  user_agent?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type ListResult = { items: ActivityLogItem[]; meta?: PageMeta };
type ListArgs = {
  page?: number;
  limit?: number;
  source?: string;
  entity?: string;
  action?: string;
  actor_id?: string;
};

export const activityLogApi = createApi({
  reducerPath: "activityLogApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/activity-logs`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["ActivityLog"],
  endpoints: (b) => ({
    getActivityLogs: b.query<ListResult, ListArgs | void>({
      query: (params) => ({
        url: "/",
        params: (params || {}) as Record<string, unknown>,
      }),
      transformResponse: (r: Envelope<ActivityLogItem[]>) => ({
        items: r.data || [],
        meta: r.meta,
      }),
      providesTags: ["ActivityLog"],
    }),
  }),
});

export const { useGetActivityLogsQuery } = activityLogApi;
