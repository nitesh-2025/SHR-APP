import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

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

import authReducer from './authSlice';
import presenceReducer from './presenceSlice';
import uiReducer from './uiSlice';

const apis = [
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

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [attendanceApi.reducerPath]: attendanceApi.reducer,
    [leaveApi.reducerPath]: leaveApi.reducer,
    [employeesApi.reducerPath]: employeesApi.reducer,
    [departmentsApi.reducerPath]: departmentsApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
    [ticketsApi.reducerPath]: ticketsApi.reducer,
    [rolesApi.reducerPath]: rolesApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [activityLogApi.reducerPath]: activityLogApi.reducer,
    [permissionsOverviewApi.reducerPath]: permissionsOverviewApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [assetsApi.reducerPath]: assetsApi.reducer,
    [assetRequestsApi.reducerPath]: assetRequestsApi.reducer,
    [workCalendarApi.reducerPath]: workCalendarApi.reducer,
    [salaryDeductionApi.reducerPath]: salaryDeductionApi.reducer,
    [performanceApi.reducerPath]: performanceApi.reducer,
    [recruitmentApi.reducerPath]: recruitmentApi.reducer,
    auth: authReducer,
    ui: uiReducer,
    presence: presenceReducer,
  },
  middleware: (gdm) =>
    gdm({
      serializableCheck: {
        ignoredActionPaths: [
          // File uploads dispatch FormData through mutations; the serializability
          // check would flag those (and walking large lists costs dev-mode frames).
          'meta.arg.originalArgs',
          // `fetchBaseQuery` attaches the raw Request/Response to every settled
          // query so `transformResponse` can read headers and status. They are
          // host objects and can never be serializable — RTK Query only passes
          // them through action meta, never into state, so nothing is lost by
          // skipping them. Without this the check logs an error on EVERY call.
          'meta.baseQueryMeta',
        ],
      },
    }).concat(...apis.map((a) => a.middleware)),
});

// Refetch-on-reconnect etc. RTK Query's default focus/online listeners are
// browser-based; `setupListeners` is still needed so `refetchOnReconnect`
// works once a custom RN listener is attached (see src/hooks/useRealtime).
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Auth selectors
export const selectAuth = (s: RootState) => s.auth;
export const selectCurrentUser = (s: RootState) => s.auth.user;
export const selectIsAuthenticated = (s: RootState) =>
  Boolean(s.auth.user || s.auth.accessToken);
export const selectIsBootstrapped = (s: RootState) => s.auth.bootstrapped;
