import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, APP_SOURCE } from "../config/env";
import { AuthUser } from "./tokenStorage";
import type { RootState } from "./index";

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role_code?: string;
}

interface LoginData {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

// Backend wraps every response as { success, message, data }.
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Real-backend auth API (separate from the mock `api`, which uses fakeBaseQuery).
 * Attaches the bearer token automatically for any future authed endpoints.
 */
export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/auth`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-App-Source", APP_SOURCE);
      return headers;
    },
  }),
  endpoints: (b) => ({
    login: b.mutation<LoginData, LoginRequest>({
      query: (body) => ({ url: "/login", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<LoginData>) => res.data,
    }),
    register: b.mutation<LoginData, RegisterRequest>({
      // Default new sign-ups to the USER role unless caller overrides it.
      query: (body) => ({
        url: "/register",
        method: "POST",
        body: { role_code: "USER", ...body },
      }),
      transformResponse: (res: ApiEnvelope<LoginData>) => res.data,
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
