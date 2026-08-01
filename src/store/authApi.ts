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

/* ── Password reset ────────────────────────────────────────────────────────
 *
 * ⚠ THE THREE ROUTE PATHS BELOW ARE NOT CONFIRMED AGAINST THIS BACKEND.
 *
 * They are the conventional names and are declared here, in ONE place, so a
 * correction is a three-line edit rather than a hunt through the screen. If the
 * server names them differently, change `RESET_ROUTES` and nothing else moves.
 *
 * The flow itself is the standard one: ask for a code by email, prove you got
 * it, then set a new password. The verify step is kept SEPARATE from the reset
 * step on purpose — it lets the UI reject a wrong code before asking anyone to
 * think up a password, and it is the difference between "that code is wrong"
 * and "something in this form is wrong".
 */
export const RESET_ROUTES = {
  request: "/forgot-password",
  verify: "/verify-otp",
  reset: "/reset-password",
} as const;

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

/**
 * What a successful verify hands back.
 *
 * A server that issues a short-lived reset token is the safer design, but one
 * that simply re-checks the OTP on the reset call is common too — so the token
 * is optional and the reset call sends BOTH. Whichever the backend reads, the
 * other is ignored.
 */
export interface VerifyOtpData {
  reset_token?: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp?: string;
  reset_token?: string;
  password: string;
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

    /* ── Password reset ────────────────────────────────────────────────── */

    /**
     * Step 1 — email a one-time code.
     *
     * Returns the server's own message so the UI can echo it ("Code sent to
     * n…h@company.com"). Note it deliberately does NOT reveal whether the
     * address exists: a reset form that answers "no such user" is an account
     * enumeration oracle, and the screen phrases its success line accordingly.
     */
    forgotPassword: b.mutation<{ message: string }, ForgotPasswordRequest>({
      query: (body) => ({ url: RESET_ROUTES.request, method: "POST", body }),
      transformResponse: (res: ApiEnvelope<unknown>) => ({
        message: res?.message ?? "If that email exists, a code is on its way.",
      }),
    }),

    /** Step 2 — prove the code arrived, before anyone types a new password. */
    verifyResetOtp: b.mutation<VerifyOtpData, VerifyOtpRequest>({
      query: (body) => ({ url: RESET_ROUTES.verify, method: "POST", body }),
      transformResponse: (res: ApiEnvelope<VerifyOtpData>) => res?.data ?? {},
    }),

    /** Step 3 — set it. Sends the token AND the code; the server reads one. */
    resetPassword: b.mutation<{ message: string }, ResetPasswordRequest>({
      query: (body) => ({ url: RESET_ROUTES.reset, method: "POST", body }),
      transformResponse: (res: ApiEnvelope<unknown>) => ({
        message: res?.message ?? "Password updated.",
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
} = authApi;
