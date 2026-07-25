import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta } from "./attendanceApi";
import type { EmployeeRef } from "./attendanceApi";

/* ------------------------------------------------------------------ */
/*  Types — mirror the backend leave model / response envelope.        */
/* ------------------------------------------------------------------ */
// Policy leave types: SL = Sick/Emergency, EL = Earned. `unpaid` draws no balance.
export type LeaveType = "sl" | "el" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPES: LeaveType[] = ["sl", "el", "unpaid"];
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sl: "Sick / Emergency (SL)",
  el: "Earned (EL)",
  unpaid: "Unpaid",
};

export interface UserRef {
  _id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface Leave {
  _id: string;
  employee_id: EmployeeRef | string;
  user_id?: string;
  type: LeaveType;
  from_date: string; // YYYY-MM-DD
  to_date: string;
  half_day: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  is_self_applied: boolean;
  assigned_by?: UserRef | string;
  assigned_by_name?: string;
  reviewed_by?: UserRef | string;
  reviewer_name?: string;
  review_note?: string;
  reviewed_at?: string;
  createdAt?: string;
}

export interface LeaveBucket {
  allocated: number;
  used: number;
  available: number;
}
export type LeaveBalance = Record<"sl" | "el", LeaveBucket>;

export interface ApplyLeaveBody {
  type: LeaveType;
  from_date: string;
  to_date: string;
  half_day?: boolean;
  reason: string;
  employee_id?: string; // supervisor assigning on behalf
  inform_hr_id?: string; // HR-department employee to inform
  cc_manager_id?: string; // reporting manager CC'd (auto-selected)
}

// Result of the accrual / FY-lapse admin actions.
export interface AccrualResult {
  as_of: string;
  credited?: number;
  skipped?: number;
  processed?: number;
}

/* ── Balance master (HR repair desk) ──────────────────────────────────
   `computed_used` is what the employee's approved leaves add up to this
   financial year; `drift` is stored-minus-expected. Non-zero drift means the
   stored balance and the leave ledger disagree and needs a repair.          */
export interface BalanceBucketView {
  allocated: number;
  used: number;
  available: number;
  computed_used: number;
  drift: number;
}
export type BalanceView = Record<"sl" | "el", BalanceBucketView>;

export interface EmployeeBalance {
  _id: string;
  employee_id: string;
  name?: string;
  designation?: string;
  gender?: string;
  department?: string;
  date_of_joining?: string;
  leave_accrual_through?: string;
  status?: string;
  balance: BalanceView;
}

export interface SetBalanceBody {
  sl?: { allocated?: number; used?: number };
  el?: { allocated?: number; used?: number };
  leave_accrual_through?: string;
  reason: string;
}

export interface RecalcAllResult {
  scanned: number;
  repaired: number;
  employees: { employee_id?: string; name?: string; changes: Record<string, { from: number; to: number }> }[];
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

type ListArgs = { page?: number; limit?: number; status?: string; employee_id?: string; type?: string };
type ListResult = { items: Leave[]; meta?: PageMeta };
type RangeArgs = { from: string; to: string; employee_id?: string };
type BalanceListArgs = {
  page?: number;
  limit?: number;
  search?: string;
  department_id?: string;
  status?: string;
  drift_only?: boolean;
};
type BalanceListResult = { items: EmployeeBalance[]; meta?: PageMeta };

export const leaveApi = createApi({
  reducerPath: "leaveApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/leave`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Leave", "MyLeave", "Balance", "Balances"],
  endpoints: (b) => ({
    /* ── Self ────────────────────────────────────────────────────────── */
    applyLeave: b.mutation<Leave, ApplyLeaveBody>({
      query: (body) => ({ url: "/", method: "POST", body }),
      transformResponse: (r: Envelope<Leave>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance"],
    }),
    getMyLeaves: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/me", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Leave[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["MyLeave"],
    }),
    getMyBalance: b.query<LeaveBalance, void>({
      query: () => "/me/balance",
      transformResponse: (r: Envelope<LeaveBalance>) => r.data,
      providesTags: ["Balance"],
    }),
    // Caller's own approved leaves overlapping a range — personal calendar overlay.
    getMyLeaveCalendar: b.query<Leave[], RangeArgs>({
      query: ({ from, to }) => ({ url: "/me/calendar", params: { from, to } }),
      transformResponse: (r: Envelope<Leave[]>) => r.data || [],
      providesTags: ["MyLeave"],
    }),
    cancelLeave: b.mutation<Leave, string>({
      query: (id) => ({ url: `/${id}/cancel`, method: "PATCH" }),
      transformResponse: (r: Envelope<Leave>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance"],
    }),

    /* ── Supervisor ──────────────────────────────────────────────────── */
    getLeaves: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<Leave[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Leave"],
    }),
    approveLeave: b.mutation<Leave, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `/${id}/approve`, method: "PATCH", body: { note } }),
      transformResponse: (r: Envelope<Leave>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance"],
    }),
    rejectLeave: b.mutation<Leave, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `/${id}/reject`, method: "PATCH", body: { note } }),
      transformResponse: (r: Envelope<Leave>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance"],
    }),
    // Approved leaves overlapping a range (all employees) — roster overlay.
    getLeaveCalendar: b.query<Leave[], RangeArgs>({
      query: ({ from, to, employee_id }) => ({ url: "/calendar", params: { from, to, ...(employee_id ? { employee_id } : {}) } }),
      transformResponse: (r: Envelope<Leave[]>) => r.data || [],
      providesTags: ["Leave"],
    }),

    /* ── Accrual (admin) — cron does this automatically ────────────────── */
    runAccrual: b.mutation<AccrualResult, void>({
      query: () => ({ url: "/accrual/run", method: "POST" }),
      transformResponse: (r: Envelope<AccrualResult>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance", "Balances"],
    }),
    runFyLapse: b.mutation<AccrualResult, void>({
      query: () => ({ url: "/accrual/fy-lapse", method: "POST" }),
      transformResponse: (r: Envelope<AccrualResult>) => r.data,
      invalidatesTags: ["Leave", "MyLeave", "Balance", "Balances"],
    }),

    /* ── Balance master (HR) ─────────────────────────────────────────── */
    getLeaveBalances: b.query<BalanceListResult, BalanceListArgs | void>({
      query: (params) => ({ url: "/balances", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<EmployeeBalance[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Balances"],
    }),
    setLeaveBalance: b.mutation<EmployeeBalance, { employeeId: string; body: SetBalanceBody }>({
      query: ({ employeeId, body }) => ({ url: `/balances/${employeeId}`, method: "PATCH", body }),
      transformResponse: (r: Envelope<EmployeeBalance>) => r.data,
      invalidatesTags: ["Balances", "Balance"],
    }),
    recalcLeaveBalance: b.mutation<EmployeeBalance, string>({
      query: (employeeId) => ({ url: `/balances/${employeeId}/recalc`, method: "POST" }),
      transformResponse: (r: Envelope<EmployeeBalance>) => r.data,
      invalidatesTags: ["Balances", "Balance"],
    }),
    recalcAllLeaveBalances: b.mutation<RecalcAllResult, void>({
      query: () => ({ url: "/balances/recalc-all", method: "POST" }),
      transformResponse: (r: Envelope<RecalcAllResult>) => r.data,
      invalidatesTags: ["Balances", "Balance"],
    }),
  }),
});

export const {
  useApplyLeaveMutation,
  useGetMyLeavesQuery,
  useGetMyBalanceQuery,
  useGetMyLeaveCalendarQuery,
  useCancelLeaveMutation,
  useGetLeavesQuery,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useGetLeaveCalendarQuery,
  useRunAccrualMutation,
  useRunFyLapseMutation,
  useGetLeaveBalancesQuery,
  useSetLeaveBalanceMutation,
  useRecalcLeaveBalanceMutation,
  useRecalcAllLeaveBalancesMutation,
} = leaveApi;
