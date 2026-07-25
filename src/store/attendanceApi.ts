import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

/* ------------------------------------------------------------------ */
/*  Types — mirror the backend attendance model / response envelope.   */
/* ------------------------------------------------------------------ */
export interface Punch {
  at: string;
  ip_address?: string;
  application?: string;
  location?: { lat?: number; lng?: number; address?: string };
  device_info?: string;
}

export interface BreakEntry {
  break_out?: Punch;
  break_in?: Punch;
  minutes?: number;
}

export type AttendanceState = "clocked_in" | "on_break" | "clocked_out";
export type AttendanceStatus = "in_progress" | "present" | "half_day" | "absent";

export interface EmployeeRef {
  _id: string;
  employee_id?: string;
  name?: string;
  designation?: string;
  profile_image?: string | null;
}

export interface AttendanceRecord {
  _id: string;
  employee_id: EmployeeRef | string;
  user_id?: string;
  date: string; // "YYYY-MM-DD"
  clock_in?: Punch;
  clock_out?: Punch;
  breaks: BreakEntry[];
  shift_start?: string;
  shift_end?: string;
  grace_minutes?: number;
  is_late: boolean;
  late_by_minutes: number;
  total_work_minutes: number;
  total_break_minutes: number;
  state: AttendanceState;
  status: AttendanceStatus;
  // Set when HR/admin marked this day by hand instead of it coming from punches.
  is_manual?: boolean;
  marked_by_name?: string;
  marked_at?: string;
  mark_reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type MarkStatus = "present" | "absent" | "half_day";

export interface MarkAttendanceBody {
  employee_ids: string[];
  date: string; // YYYY-MM-DD
  status: MarkStatus;
  reason: string;
}

export interface MarkAttendanceResult {
  date: string;
  status: MarkStatus;
  marked: number;
  total: number;
  failed: { employee_id: string; error: string }[];
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type RegularizationType =
  | "missing_clock_in"
  | "missing_clock_out"
  | "late_waiver"
  | "wrong_time"
  | "on_duty"
  | "work_from_home";
export type RegularizationStatus = "pending" | "approved" | "rejected";

export interface Regularization {
  _id: string;
  employee_id: EmployeeRef | string;
  date: string;
  type: RegularizationType;
  reason: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  status: RegularizationStatus;
  reviewer_name?: string;
  review_note?: string;
  reviewed_at?: string;
  createdAt?: string;
}

export interface CreateRegularizationBody {
  date: string;
  type: RegularizationType;
  reason: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
}

export interface AttendanceSummary {
  total_days: number;
  present: number;
  half_day: number;
  in_progress: number;
  late_count: number;
  on_time_count: number;
  total_work_minutes: number;
  total_break_minutes: number;
  total_late_minutes: number;
  avg_work_minutes: number;
  avg_late_minutes: number;
}

// Per-employee rollup from /analytics/by-employee — Payroll uses the day counts
// (full vs half) for the selected month. `employee_id` is the employee's _id.
export interface EmployeeAttendanceStat {
  employee_id: string;
  employee_code?: string;
  name?: string;
  designation?: string;
  days: number;
  present_days: number;
  half_days: number;
  late_days: number;
  total_work_minutes: number;
  avg_work_minutes: number;
}

// Day-by-day aggregate from /analytics/trends — used for the calendar overlay.
export interface TrendDay {
  date: string; // YYYY-MM-DD
  total: number;
  present: number;
  half_day: number;
  late_count: number;
  avg_work_minutes: number;
}

// The client only ever sends `application` + optional `location`; the server
// stamps time / IP / device itself.
export type PunchBody =
  | { application?: string; location?: { lat?: number; lng?: number; address?: string } }
  | undefined;

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type ListResult = { items: AttendanceRecord[]; meta?: PageMeta };
type ListArgs = { page?: number; limit?: number; from?: string; to?: string; employee_id?: string; status?: string };
type AnalyticsArgs = { from?: string; to?: string; employee_id?: string; department_id?: string };

/* ── Day roster (server-side join of employees + that day's attendance) ── */
export interface RosterEntry {
  _id: string;
  employee_id: string;
  name?: string;
  designation?: string;
  department_id?: { _id: string; department_name?: string } | string | null;
  profile_image?: string | null;
  status?: "active" | "inactive";
  came: boolean;
  attendance?: AttendanceRecord | null;
}
export interface RosterMeta extends PageMeta {
  counts?: { total: number; present: number; absent: number };
}
export type RosterStatus = "all" | "present" | "absent" | "late";
type RosterResult = { items: RosterEntry[]; meta?: RosterMeta };
type RosterArgs = {
  date: string;
  search?: string;
  department_id?: string;
  status?: RosterStatus;
  page?: number;
  limit?: number;
};

const APP = "web-portal";

export const attendanceApi = createApi({
  reducerPath: "attendanceApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/attendance`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["MyToday", "Attendance", "Analytics", "Regularizations"],
  endpoints: (b) => ({
    /* ── Punches (self) ─────────────────────────────────────────────── */
    clockIn: b.mutation<AttendanceRecord, PunchBody>({
      query: (body) => ({ url: "/clock-in", method: "POST", body: { application: APP, ...(body || {}) } }),
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
      invalidatesTags: ["MyToday", "Attendance", "Analytics"],
    }),
    clockOut: b.mutation<AttendanceRecord, PunchBody>({
      query: (body) => ({ url: "/clock-out", method: "POST", body: { application: APP, ...(body || {}) } }),
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
      invalidatesTags: ["MyToday", "Attendance", "Analytics"],
    }),
    breakOut: b.mutation<AttendanceRecord, PunchBody>({
      query: (body) => ({ url: "/break-out", method: "POST", body: { application: APP, ...(body || {}) } }),
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
      invalidatesTags: ["MyToday"],
    }),
    breakIn: b.mutation<AttendanceRecord, PunchBody>({
      query: (body) => ({ url: "/break-in", method: "POST", body: { application: APP, ...(body || {}) } }),
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
      invalidatesTags: ["MyToday"],
    }),

    // Background location attach — fired AFTER a punch succeeds, once the
    // browser has resolved the GPS fix. Keeps the punch itself instant.
    updatePunchLocation: b.mutation<
      AttendanceRecord,
      { punch: "clock_in" | "clock_out" | "break_out" | "break_in"; location: { lat: number; lng: number; address?: string } }
    >({
      query: (body) => ({ url: "/me/punch-location", method: "PATCH", body }),
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
      invalidatesTags: ["MyToday"],
    }),

    /* ── Self reads ─────────────────────────────────────────────────── */
    getMyToday: b.query<AttendanceRecord | null, void>({
      query: () => "/me/today",
      transformResponse: (r: Envelope<AttendanceRecord | null>) => r.data,
      providesTags: ["MyToday"],
    }),
    getMyHistory: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/me", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<AttendanceRecord[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Attendance"],
    }),

    /* ── Supervisor reads (ADMIN / SUPER_ADMIN / MANAGER) ───────────── */
    listAttendance: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<AttendanceRecord[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Attendance"],
    }),
    getAttendanceById: b.query<AttendanceRecord, string>({
      query: (id) => `/${id}`,
      transformResponse: (r: Envelope<AttendanceRecord>) => r.data,
    }),

    // Day roster — present + absent employees with their attendance, all
    // search/filter/pagination handled server-side (status: all|present|absent|late).
    getRoster: b.query<RosterResult, RosterArgs>({
      query: (params) => ({ url: "/roster", params: params as Record<string, unknown> }),
      transformResponse: (r: Envelope<RosterEntry[]> & { meta?: RosterMeta }) => ({
        items: r.data || [],
        meta: r.meta,
      }),
      providesTags: ["Attendance"],
    }),

    // Manual mark (HR/admin) — overrides punch-derived status for a whole day.
    // Invalidates MyToday too: the marked employee may be the caller themselves.
    markAttendance: b.mutation<MarkAttendanceResult, MarkAttendanceBody>({
      query: (body) => ({ url: "/mark", method: "POST", body }),
      transformResponse: (r: Envelope<MarkAttendanceResult>) => r.data,
      invalidatesTags: ["Attendance", "Analytics", "MyToday"],
    }),

    /* ── Analytics (supervisors) ────────────────────────────────────── */
    attendanceSummary: b.query<AttendanceSummary, AnalyticsArgs | void>({
      query: (params) => ({ url: "/analytics/summary", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<AttendanceSummary>) => r.data,
      providesTags: ["Analytics"],
    }),
    attendanceByEmployee: b.query<EmployeeAttendanceStat[], AnalyticsArgs | void>({
      query: (params) => ({ url: "/analytics/by-employee", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<EmployeeAttendanceStat[]>) => r.data || [],
      providesTags: ["Analytics"],
    }),
    attendanceTrends: b.query<unknown[], AnalyticsArgs | void>({
      query: (params) => ({ url: "/analytics/trends", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<unknown[]>) => r.data || [],
      providesTags: ["Analytics"],
    }),
    // Typed day-by-day trend for the calendar overlay (present / late per day).
    getDailyTrends: b.query<TrendDay[], AnalyticsArgs | void>({
      query: (params) => ({ url: "/analytics/trends", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<TrendDay[]>) => r.data || [],
      providesTags: ["Analytics"],
    }),

    /* ── Regularizations (self) ─────────────────────────────────────── */
    createRegularization: b.mutation<Regularization, CreateRegularizationBody>({
      query: (body) => ({ url: "/regularizations", method: "POST", body }),
      transformResponse: (r: Envelope<Regularization>) => r.data,
      invalidatesTags: ["Regularizations", "MyToday", "Attendance"],
    }),
    getMyRegularizations: b.query<{ items: Regularization[]; meta?: PageMeta }, ListArgs | void>({
      query: (params) => ({ url: "/regularizations/me", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Regularization[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Regularizations"],
    }),
    // Supervisor list — all employees' regularizations, date/status filterable.
    listRegularizations: b.query<{ items: Regularization[]; meta?: PageMeta }, ListArgs | void>({
      query: (params) => ({ url: "/regularizations", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Regularization[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Regularizations"],
    }),
    // Supervisor review — approve/reject. The backend exposes separate
    // /approve and /reject routes; on approve it marks the target day a full
    // day, so we invalidate Attendance too.
    reviewRegularization: b.mutation<Regularization, { id: string; status: "approved" | "rejected"; note?: string }>({
      query: ({ id, status, note }) => ({
        url: `/regularizations/${id}/${status === "approved" ? "approve" : "reject"}`,
        method: "PATCH",
        body: note ? { note } : {},
      }),
      transformResponse: (r: Envelope<Regularization>) => r.data,
      invalidatesTags: ["Regularizations", "Attendance", "Analytics", "MyToday"],
    }),
  }),
});

export const {
  useClockInMutation,
  useClockOutMutation,
  useBreakOutMutation,
  useBreakInMutation,
  useUpdatePunchLocationMutation,
  useGetMyTodayQuery,
  useGetMyHistoryQuery,
  useListAttendanceQuery,
  useGetRosterQuery,
  useMarkAttendanceMutation,
  useGetAttendanceByIdQuery,
  useAttendanceSummaryQuery,
  useAttendanceByEmployeeQuery,
  useAttendanceTrendsQuery,
  useGetDailyTrendsQuery,
  useCreateRegularizationMutation,
  useGetMyRegularizationsQuery,
  useListRegularizationsQuery,
  useReviewRegularizationMutation,
} = attendanceApi;
