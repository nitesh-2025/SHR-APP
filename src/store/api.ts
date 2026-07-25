import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import * as data from "./mockData";

/**
 * RTK Query API. Data is STATIC (from mockData) — every endpoint resolves
 * through `queryFn` with a tiny delay so loading states look real. Swapping to
 * a real backend later only means changing `fakeBaseQuery` → `fetchBaseQuery`
 * and the `queryFn`s → `query` URLs.
 */
const ok = <T>(payload: T) =>
  new Promise<{ data: T }>((resolve) =>
    setTimeout(() => resolve({ data: payload }), 250)
  );

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Employee", "Leave", "Asset"],
  endpoints: (b) => ({
    getDashboard: b.query({
      queryFn: () =>
        ok({
          kpis: data.dashboardKpis,
          attendanceBreakdown: data.attendanceBreakdown,
          employeeTrend: data.employeeTrend,
          departmentHeadcount: data.departmentHeadcount,
          upcomingEvents: data.upcomingEvents,
          recentActivities: data.recentActivities,
          leaveSummary: data.leaveSummary,
          payrollSummary: data.payrollSummary,
          recruitmentSummary: data.recruitmentSummary,
        }),
    }),
    getEmployees: b.query({ queryFn: () => ok(data.employees), providesTags: ["Employee"] }),
    getJobOpenings: b.query({ queryFn: () => ok(data.jobOpenings) }),
    getCandidates: b.query({ queryFn: () => ok(data.candidates) }),
    getAttendance: b.query({ queryFn: () => ok(data.attendanceLog) }),
    getLeaveRequests: b.query({ queryFn: () => ok(data.leaveRequests), providesTags: ["Leave"] }),
    getPayrollRuns: b.query({ queryFn: () => ok(data.payrollRuns) }),
    getPayslips: b.query({ queryFn: () => ok(data.payslips) }),
    getPerformance: b.query({ queryFn: () => ok(data.performanceReviews) }),
    getLoans: b.query({ queryFn: () => ok(data.loans) }),
    getAssets: b.query({ queryFn: () => ok(data.assets), providesTags: ["Asset"] }),
    getDocuments: b.query({ queryFn: () => ok(data.documents) }),
    getGrievances: b.query({ queryFn: () => ok(data.grievances) }),
    getRoles: b.query({ queryFn: () => ok(data.roles) }),
    getAuditLog: b.query({ queryFn: () => ok(data.auditLog) }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetEmployeesQuery,
  useGetJobOpeningsQuery,
  useGetCandidatesQuery,
  useGetAttendanceQuery,
  useGetLeaveRequestsQuery,
  useGetPayrollRunsQuery,
  useGetPayslipsQuery,
  useGetPerformanceQuery,
  useGetLoansQuery,
  useGetAssetsQuery,
  useGetDocumentsQuery,
  useGetGrievancesQuery,
  useGetRolesQuery,
  useGetAuditLogQuery,
} = api;
