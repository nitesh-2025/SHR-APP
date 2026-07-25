import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";
import type { PageMeta, EmployeeRef } from "./attendanceApi";

/**
 * Month-closing (21–31) salary deductions for unauthorised leave/absence.
 * Backend: /api/salary-deduction (compute, list, /me, finalize, waive).
 */
export type DeductionStatus = "draft" | "finalized" | "waived";
export type EmployeeLevel = "acquisition" | "tl_and_above";

export interface SalaryDeduction {
  _id: string;
  employee_id: EmployeeRef | string;
  employee_code?: string;
  employee_name?: string;
  month: string; // "YYYY-MM"
  window_from: string;
  window_to: string;
  level: EmployeeLevel;
  level_source: "field" | "designation";
  multiplier: number;
  per_day: number;
  unauthorized_days: number;
  amount: number;
  unauthorized_dates: string[];
  reason: string;
  status: DeductionStatus;
  computed_at: string;
  createdAt?: string;
}

export interface ComputeResult {
  month: string;
  window: { from: string; to: string };
  penalised_employees: number;
  deductions: SalaryDeduction[];
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
  month?: string;
  status?: DeductionStatus | "";
  employee_id?: string;
};
type ListResult = { items: SalaryDeduction[]; meta?: PageMeta };

export const salaryDeductionApi = createApi({
  reducerPath: "salaryDeductionApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/salary-deduction`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Deduction"],
  endpoints: (b) => ({
    getDeductions: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<SalaryDeduction[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Deduction"],
    }),
    getMyDeductions: b.query<ListResult, ListArgs | void>({
      query: (params) => ({ url: "/me", params: (params || {}) as Record<string, unknown> }),
      transformResponse: (r: Envelope<SalaryDeduction[]>) => ({ items: r.data || [], meta: r.meta }),
      providesTags: ["Deduction"],
    }),
    computeDeductions: b.mutation<ComputeResult, { month: string }>({
      query: (body) => ({ url: "/compute", method: "POST", body }),
      transformResponse: (r: Envelope<ComputeResult>) => r.data,
      invalidatesTags: ["Deduction"],
    }),
    finalizeDeduction: b.mutation<SalaryDeduction, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `/${id}/finalize`, method: "PATCH", body: { note } }),
      transformResponse: (r: Envelope<SalaryDeduction>) => r.data,
      invalidatesTags: ["Deduction"],
    }),
    waiveDeduction: b.mutation<SalaryDeduction, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `/${id}/waive`, method: "PATCH", body: { note } }),
      transformResponse: (r: Envelope<SalaryDeduction>) => r.data,
      invalidatesTags: ["Deduction"],
    }),
  }),
});

export const {
  useGetDeductionsQuery,
  useGetMyDeductionsQuery,
  useComputeDeductionsMutation,
  useFinalizeDeductionMutation,
  useWaiveDeductionMutation,
} = salaryDeductionApi;
