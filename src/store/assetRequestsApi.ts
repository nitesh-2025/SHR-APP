import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

/**
 * Employee asset requests (backend module `asset-requests`, /api/asset-requests).
 * StaffCore uses the ADMIN side: list every request + approve / reject. The
 * requester self-service side lives in the Support portal.
 */
interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { total: number; page: number; limit: number; total_pages: number };
}

export type AssetRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled";

export interface RequesterRef {
  _id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image?: string;
}

export interface AssetRequest {
  _id: string;
  requester_id?: RequesterRef | string;
  requester_name?: string;
  requester_email?: string;
  department?: string;
  item: string;
  category: string;
  quantity: number;
  urgency: "low" | "medium" | "high";
  needed_by?: string | null;
  reason: string;
  status: AssetRequestStatus;
  review_note?: string;
  createdAt: string;
}

export interface AssetRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  fulfilled: number;
}

export interface Breakdown {
  key: string;
  count: number;
}

export interface AssetRequestAnalytics {
  total: number;
  approval_rate: number;
  by_status: {
    pending: number;
    approved: number;
    rejected: number;
    fulfilled: number;
    cancelled: number;
  };
  by_urgency: { low: number; medium: number; high: number };
  by_category: Breakdown[];
  by_department: Breakdown[];
  monthly: { month: string; count: number }[];
}

export interface PagedAssetRequests {
  items: AssetRequest[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

type ListArgs = {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export const assetRequestsApi = createApi({
  reducerPath: "assetRequestsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/asset-requests`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["AssetRequest"],
  endpoints: (b) => ({
    getAssetRequests: b.query<PagedAssetRequests, ListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<AssetRequest[]>): PagedAssetRequests => ({
        items: r.data || [],
        meta:
          r.meta ?? {
            total: (r.data || []).length,
            page: 1,
            limit: (r.data || []).length,
            total_pages: 1,
          },
      }),
      providesTags: ["AssetRequest"],
    }),

    getAssetRequestStats: b.query<AssetRequestStats, void>({
      query: () => ({ url: "/stats" }),
      transformResponse: (r: Envelope<AssetRequestStats>) => r.data,
      providesTags: ["AssetRequest"],
    }),

    getAssetRequestAnalytics: b.query<AssetRequestAnalytics, void>({
      query: () => ({ url: "/analytics" }),
      transformResponse: (r: Envelope<AssetRequestAnalytics>) => r.data,
      providesTags: ["AssetRequest"],
    }),

    approveAssetRequest: b.mutation<AssetRequest, { id: string; note?: string }>({
      query: ({ id, note }) => ({
        url: `/${id}/approve`,
        method: "PATCH",
        body: note ? { note } : {},
      }),
      transformResponse: (r: Envelope<AssetRequest>) => r.data,
      invalidatesTags: ["AssetRequest"],
    }),

    rejectAssetRequest: b.mutation<AssetRequest, { id: string; note?: string }>({
      query: ({ id, note }) => ({
        url: `/${id}/reject`,
        method: "PATCH",
        body: note ? { note } : {},
      }),
      transformResponse: (r: Envelope<AssetRequest>) => r.data,
      invalidatesTags: ["AssetRequest"],
    }),
  }),
});

export const {
  useGetAssetRequestsQuery,
  useGetAssetRequestStatsQuery,
  useGetAssetRequestAnalyticsQuery,
  useApproveAssetRequestMutation,
  useRejectAssetRequestMutation,
} = assetRequestsApi;

// Helper — requester display name from the (possibly populated) ref + snapshot.
export const requesterName = (r: AssetRequest): string => {
  const ref = r.requester_id;
  if (ref && typeof ref === "object") {
    const n = [ref.first_name, ref.last_name].filter(Boolean).join(" ");
    if (n) return n;
    if (ref.email) return ref.email;
  }
  return r.requester_name || r.requester_email || "—";
};
