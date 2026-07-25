import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";

export type NotificationType = "ticket" | "sla" | "system" | "comment" | "attendance";

export interface NotificationItem {
  _id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  reference_id?: string;
  actor_id?: string;
  actor_name?: string;
  count: number;
  is_read: boolean;
  read_at?: string;
  createdAt?: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type ListResult = { items: NotificationItem[]; meta?: PageMeta };
type ListArgs = { page?: number; limit?: number; unread_only?: boolean };

export const notificationApi = createApi({
  reducerPath: "notificationApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/notifications`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Notifications", "Unread"],
  endpoints: (b) => ({
    getNotifications: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<NotificationItem[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Notifications"],
    }),
    // Unread count only — drives the bell badge (backend returns unread_count
    // in meta regardless of filter).
    getUnreadCount: b.query<number, void>({
      query: () => ({ url: "/", params: { limit: 1 } }),
      transformResponse: (r: Envelope<NotificationItem[]>) =>
        (r.meta as { unread_count?: number } | undefined)?.unread_count ?? 0,
      providesTags: ["Unread"],
    }),
    markNotificationRead: b.mutation<NotificationItem, string>({
      query: (id) => ({ url: `/${id}/read`, method: "PATCH" }),
      transformResponse: (r: Envelope<NotificationItem>) => r.data,
      invalidatesTags: ["Notifications", "Unread"],
    }),
    markAllNotificationsRead: b.mutation<void, void>({
      query: () => ({ url: "/read-all", method: "PATCH" }),
      invalidatesTags: ["Notifications", "Unread"],
    }),
    deleteNotification: b.mutation<void, string>({
      query: (id) => ({ url: `/${id}`, method: "DELETE" }),
      invalidatesTags: ["Notifications", "Unread"],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = notificationApi;
