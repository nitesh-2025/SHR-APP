import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

export interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  tone?: string;
  icon: string; // key into the frontend KPI_ICON map
  to?: string;  // route to open when the card is clicked
}

export interface DashboardData {
  scope: "org" | "team";
  kpis: KpiCard[];
  attendanceBreakdown: { label: string; value: number; pct: number; color: string }[];
  attendanceTotal: number;
  employeeTrend: { month: string; value: number }[];
  departmentHeadcount: { dept: string; code?: string; value: number; active?: number; inactive?: number }[];
  upcomingEvents: {
    title: string;
    who: string;
    /** Employee code — row click par Employees list me isi ko kholte hain. */
    employee_code?: string;
    date: string;
    icon: string;
    /** True only when the event falls on the reference day — drives the wish. */
    is_today?: boolean;
    /** Days from today (0 = today). Window is 30 days, nearest first. */
    days_until?: number;
    /** Photo of the person celebrating; "" when they have no image on file. */
    avatar?: string;
    gender?: string;
  }[];
  recentActivities: { text: string; time: string; tone: string }[];
  leaveSummary: { total: number; approved: number; pending: number; rejected: number };
  payrollSummary: { status: string; totalEmployees: number; totalCost: number };
  recruitmentSummary: { openings: number; activeCandidates: number; interviews: number; offers: number };
}

// Consolidated payload for the /reports page.
export interface ReportsData {
  stats: {
    headcountGrowthPct: number;
    attritionPct: number;
    avgTenureYears: number;
    monthlyPayroll: number;
  };
  employeeTrend: { month: string; value: number }[];
  attendanceBreakdown: { label: string; value: number; color: string }[];
  attendanceTotal: number;
  departmentHeadcount: { dept: string; code?: string; value: number; active?: number; inactive?: number }[];
}

// Authoritative payroll aggregation — GET /api/hr/payroll. Sirf active +
// ctc>0 employees par banta hai; monthly_payroll = total_ctc / 12.
export interface PayrollAgg {
  headcount_with_salary: number;
  total_ctc: number;
  avg_ctc: number;
  min_ctc: number;
  max_ctc: number;
  monthly_payroll: number;
  by_department: {
    department: string | null;
    headcount: number;
    total_ctc: number;
    avg_ctc: number;
  }[];
  salary_bands: { _id: number | string; count: number; total_ctc: number }[];
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/hr`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Dashboard"],
  endpoints: (b) => ({
    // Optional `date` (YYYY-MM-DD) → dashboard as-of that day; omit for today.
    getDashboard: b.query<DashboardData, { date?: string } | void>({
      query: (args) => ({
        url: "/dashboard",
        params: args?.date ? { date: args.date } : undefined,
      }),
      transformResponse: (r: Envelope<DashboardData>) => r.data,
      providesTags: ["Dashboard"],
    }),

    getReports: b.query<ReportsData, void>({
      query: () => ({ url: "/reports" }),
      transformResponse: (r: Envelope<ReportsData>) => r.data,
      providesTags: ["Dashboard"],
    }),

    // Authoritative monthly payroll / CTC aggregation (sensitive — HR only).
    getPayroll: b.query<PayrollAgg, void>({
      query: () => ({ url: "/payroll" }),
      transformResponse: (r: Envelope<PayrollAgg>) => r.data,
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardQuery, useGetReportsQuery, useGetPayrollQuery } =
  dashboardApi;
