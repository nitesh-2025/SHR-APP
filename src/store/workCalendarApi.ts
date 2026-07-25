import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import type { RootState } from "./index";

/**
 * Work-calendar policy: day-of-week shifts, weekly-offs, half-day/late
 * thresholds, month-closing deduction knobs, and the holiday master.
 * Backend: /api/work-calendar (config, holidays, day-info, leave-preview).
 */

export interface ShiftRule {
  start_time: string; // "09:00"
  end_time: string; // "18:30"
  grace_minutes: number; // 10
  late_until: string; // "09:30"
  half_day_from?: string | null; // "09:31" | null
}

export interface WorkCalendarConfig {
  _id?: string;
  key: string;
  weekday_shift: ShiftRule;
  saturday_shift: ShiftRule;
  weekly_offs: { sunday: boolean; saturday_offs: number[] };
  present_min_minutes: number;
  half_day_min_minutes: number;
  month_close_from_day: number;
  month_close_to_day: number;
  deduction_multiplier: { acquisition: number; tl_and_above: number };
  per_day_divisor: number;
}

export interface Holiday {
  _id: string;
  name: string;
  recurring: boolean;
  date?: string; // one-off "YYYY-MM-DD"
  month?: number; // recurring
  day?: number; // recurring
  active: boolean;
}

export interface HolidayBody {
  name: string;
  recurring?: boolean;
  date?: string;
  month?: number;
  day?: number;
  active?: boolean;
}

export interface DayInfo {
  date: string;
  weekly_off: boolean;
  holiday: boolean;
  working_day: boolean;
  shift: ShiftRule | null;
}

export interface LeavePreview {
  days: number;
  working_days: number;
  sandwich_days: number;
  off_days_excluded: number;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const workCalendarApi = createApi({
  reducerPath: "workCalendarApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/work-calendar`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  tagTypes: ["Config", "Holiday"],
  endpoints: (b) => ({
    getWorkCalendarConfig: b.query<WorkCalendarConfig, void>({
      query: () => "/config",
      transformResponse: (r: Envelope<WorkCalendarConfig>) => r.data,
      providesTags: ["Config"],
    }),
    updateWorkCalendarConfig: b.mutation<WorkCalendarConfig, Partial<WorkCalendarConfig>>({
      query: (body) => ({ url: "/config", method: "PATCH", body }),
      transformResponse: (r: Envelope<WorkCalendarConfig>) => r.data,
      invalidatesTags: ["Config"],
    }),

    getHolidays: b.query<Holiday[], void>({
      query: () => "/holidays",
      transformResponse: (r: Envelope<Holiday[]>) => r.data || [],
      providesTags: ["Holiday"],
    }),
    createHoliday: b.mutation<Holiday, HolidayBody>({
      query: (body) => ({ url: "/holidays", method: "POST", body }),
      transformResponse: (r: Envelope<Holiday>) => r.data,
      invalidatesTags: ["Holiday"],
    }),
    updateHoliday: b.mutation<Holiday, { id: string } & HolidayBody>({
      query: ({ id, ...body }) => ({ url: `/holidays/${id}`, method: "PATCH", body }),
      transformResponse: (r: Envelope<Holiday>) => r.data,
      invalidatesTags: ["Holiday"],
    }),
    deleteHoliday: b.mutation<void, string>({
      query: (id) => ({ url: `/holidays/${id}`, method: "DELETE" }),
      invalidatesTags: ["Holiday"],
    }),

    getDayInfo: b.query<DayInfo, string>({
      query: (date) => ({ url: "/day-info", params: { date } }),
      transformResponse: (r: Envelope<DayInfo>) => r.data,
    }),
    getLeavePreview: b.query<LeavePreview, { from: string; to: string }>({
      query: (params) => ({ url: "/leave-preview", params }),
      transformResponse: (r: Envelope<LeavePreview>) => r.data,
    }),
  }),
});

export const {
  useGetWorkCalendarConfigQuery,
  useUpdateWorkCalendarConfigMutation,
  useGetHolidaysQuery,
  useCreateHolidayMutation,
  useUpdateHolidayMutation,
  useDeleteHolidayMutation,
  useGetDayInfoQuery,
  useGetLeavePreviewQuery,
} = workCalendarApi;
