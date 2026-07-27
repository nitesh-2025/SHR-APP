// Single registry of every RTK Query slice.
//
// Lives in its own module (rather than inside `store/index.ts`) so middlewares
// can iterate the same list without importing the store — `logoutResetMiddleware`
// needs it to wipe every cache on sign-out, and importing `./index` from a
// middleware that `./index` itself concats would be a require cycle.
import { activityLogApi } from './activityLogApi';
import { api } from './api';
import { assetRequestsApi } from './assetRequestsApi';
import { assetsApi } from './assetsApi';
import { attendanceApi } from './attendanceApi';
import { authApi } from './authApi';
import { chatApi } from './chatApi';
import { dashboardApi } from './dashboardApi';
import { departmentsApi } from './departmentsApi';
import { employeesApi } from './employeesApi';
import { leaveApi } from './leaveApi';
import { notificationApi } from './notificationApi';
import { performanceApi } from './performanceApi';
import { permissionsOverviewApi } from './permissionsOverviewApi';
import { recruitmentApi } from './recruitmentApi';
import { rolesApi } from './rolesApi';
import { salaryDeductionApi } from './salaryDeductionApi';
import { ticketsApi } from './ticketsApi';
import { usersApi } from './usersApi';
import { workCalendarApi } from './workCalendarApi';

export const apis = [
  api,
  authApi,
  attendanceApi,
  leaveApi,
  employeesApi,
  departmentsApi,
  chatApi,
  notificationApi,
  ticketsApi,
  rolesApi,
  usersApi,
  activityLogApi,
  permissionsOverviewApi,
  dashboardApi,
  assetsApi,
  assetRequestsApi,
  workCalendarApi,
  salaryDeductionApi,
  performanceApi,
  recruitmentApi,
] as const;
