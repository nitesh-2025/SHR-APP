import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta, EmployeeRef } from "./attendanceApi";

export type ReviewStatus = "draft" | "submitted" | "reviewed" | "finalized";
export const REVIEW_STATUSES: ReviewStatus[] = ["draft", "submitted", "reviewed", "finalized"];

export type PeriodType = "monthly" | "quarterly" | "half_yearly" | "yearly";
export const PERIOD_TYPES: PeriodType[] = ["monthly", "quarterly", "half_yearly", "yearly"];

export type RatingLabel =
  | "outstanding"
  | "exceeds"
  | "meets"
  | "needs_improvement"
  | "unsatisfactory";

// KPI ka naam/target/weight sab review ke andar hi rehta hai — koi fixed KPI
// master nahi, har cycle apne KPIs le kar aa sakta hai.
export interface Kpi {
  name: string;
  description?: string;
  weight: number; // %
  target?: string;
  achieved?: string;
  score: number; // 0–5
  remarks?: string;
}

export interface DepartmentRefLite {
  _id: string;
  department_name?: string;
  department_code?: string;
}

export interface PerformanceReview {
  _id: string;
  employee_id: EmployeeRef | string;
  department_id?: DepartmentRefLite | string | null;
  period_type: PeriodType;
  period: string;
  cycle_start?: string;
  cycle_end?: string;
  kpis: Kpi[];
  overall_score: number; // 0–5, server-derived
  rating: RatingLabel;   // server-derived
  status: ReviewStatus;
  reviewer_name?: string;
  reviewed_at?: string;
  strengths?: string;
  improvements?: string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PerformanceStats {
  total: number;
  avg_score: number;
  finalized: number;
  pending: number;
  top_performers: number;
  needs_attention: number;
  by_rating: { rating: RatingLabel; count: number }[];
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

export type ReviewListArgs = {
  page?: number;
  limit?: number;
  period?: string;
  status?: ReviewStatus | "";
  employee_id?: string;
  department_id?: string;
  rating?: RatingLabel | "";
  search?: string;
};
type ListResult = { items: PerformanceReview[]; meta?: PageMeta };

// Create/update dono ka body — server score/rating khud derive karta hai, isliye
// wo yahan bheje hi nahi jaate.
export type ReviewBody = {
  employee_id: string;
  period: string;
  period_type?: PeriodType;
  status?: ReviewStatus;
  cycle_start?: string;
  cycle_end?: string;
  kpis: Kpi[];
  strengths?: string;
  improvements?: string;
  comments?: string;
};

export const performanceApi = createApi({
  reducerPath: "performanceApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/performance`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Review"],
  endpoints: (b) => ({
    getReviews: b.query<ListResult, ReviewListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<PerformanceReview[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Review"],
    }),
    getMyReviews: b.query<ListResult, ReviewListArgs | void>({
      query: (params) => ({ url: "/me", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<PerformanceReview[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Review"],
    }),
    getReviewStats: b.query<PerformanceStats, { period?: string; department_id?: string } | void>({
      query: (params) => ({ url: "/stats", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<PerformanceStats>) => r.data,
      providesTags: ["Review"],
    }),
    // Cycle dropdown server se bharta hai — hardcoded "H1 2025" jaisa kuch nahi.
    getReviewPeriods: b.query<string[], void>({
      query: () => ({ url: "/periods" }),
      transformResponse: (r: Envelope<string[]>) => r.data || [],
      providesTags: ["Review"],
    }),
    createReview: b.mutation<PerformanceReview, ReviewBody>({
      query: (body) => ({ url: "/", method: "POST", body }),
      transformResponse: (r: Envelope<PerformanceReview>) => r.data,
      invalidatesTags: ["Review"],
    }),
    updateReview: b.mutation<PerformanceReview, { id: string } & Partial<ReviewBody>>({
      query: ({ id, ...body }) => ({ url: `/${id}`, method: "PATCH", body }),
      transformResponse: (r: Envelope<PerformanceReview>) => r.data,
      invalidatesTags: ["Review"],
    }),
    setReviewStatus: b.mutation<PerformanceReview, { id: string; status: ReviewStatus }>({
      query: ({ id, status }) => ({ url: `/${id}/status`, method: "PATCH", body: { status } }),
      transformResponse: (r: Envelope<PerformanceReview>) => r.data,
      invalidatesTags: ["Review"],
    }),
    deleteReview: b.mutation<void, string>({
      query: (id) => ({ url: `/${id}`, method: "DELETE" }),
      invalidatesTags: ["Review"],
    }),
  }),
});

export const {
  useGetReviewsQuery,
  useGetMyReviewsQuery,
  useGetReviewStatsQuery,
  useGetReviewPeriodsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useSetReviewStatusMutation,
  useDeleteReviewMutation,
} = performanceApi;

// ─── Display helpers (UI + PDF/export dono yahi use karein) ───────────────
export const RATING_LABEL: Record<RatingLabel, string> = {
  outstanding: "Outstanding",
  exceeds: "Exceeds Expectations",
  meets: "Meets Expectations",
  needs_improvement: "Needs Improvement",
  unsatisfactory: "Unsatisfactory",
};

export const RATING_TONE: Record<RatingLabel, string> = {
  outstanding: "emerald",
  exceeds: "sky",
  meets: "violet",
  needs_improvement: "amber",
  unsatisfactory: "rose",
};

export const STATUS_TONE: Record<ReviewStatus, string> = {
  draft: "slate",
  submitted: "amber",
  reviewed: "sky",
  finalized: "emerald",
};

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  yearly: "Yearly",
};

/** Weighted score — form me live preview isse banta hai (server bhi yahi karta). */
export const scoreOf = (kpis: Kpi[]): number => {
  if (!kpis.length) return 0;
  const w = kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0);
  if (w <= 0) {
    const avg = kpis.reduce((s, k) => s + (Number(k.score) || 0), 0) / kpis.length;
    return Math.round(avg * 100) / 100;
  }
  const weighted = kpis.reduce((s, k) => s + (Number(k.score) || 0) * (Number(k.weight) || 0), 0);
  return Math.round((weighted / w) * 100) / 100;
};

export const ratingOf = (score: number): RatingLabel =>
  score >= 4.5
    ? "outstanding"
    : score >= 3.5
      ? "exceeds"
      : score >= 2.5
        ? "meets"
        : score >= 1.5
          ? "needs_improvement"
          : "unsatisfactory";
