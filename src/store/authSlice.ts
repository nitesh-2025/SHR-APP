import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import {
  clearSession,
  isTokenExpired,
  readSession,
  saveSession,
  type AuthUser,
  type Session,
} from './tokenStorage';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true once we've attempted to restore a session from storage */
  bootstrapped: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  bootstrapped: false,
};

export interface Credentials {
  user?: AuthUser | null;
  access_token?: string | null;
  refresh_token?: string | null;
}

// ── Thunks ──────────────────────────────────────────────────────────────────
// Native storage is async (unlike the web build's localStorage), so writes
// cannot happen inside a reducer. Each thunk persists first, then commits to
// state — the exported names match the web portal so ported screens are
// drop-in: `dispatch(setCredentials(data))`, `dispatch(clearCredentials())`.

/** Restore a saved session on app start. Expired tokens are discarded. */
export const hydrateFromSession = createAsyncThunk(
  'auth/hydrateFromSession',
  async (): Promise<Session> => {
    const session = await readSession();
    // Don't restore an already-expired session — bounce straight to Login.
    if (isTokenExpired(session.accessToken)) {
      await clearSession();
      return { accessToken: null, refreshToken: null, user: null };
    }
    return session;
  },
);

export const setCredentials = createAsyncThunk(
  'auth/setCredentials',
  async (creds: Credentials, { getState }) => {
    const prev = (getState() as { auth: AuthState }).auth;
    const next = {
      user: creds.user ?? prev.user,
      access_token: creds.access_token ?? prev.accessToken,
      refresh_token: creds.refresh_token ?? prev.refreshToken,
    };
    await saveSession(next);
    return next;
  },
);

export const clearCredentials = createAsyncThunk(
  'auth/clearCredentials',
  async () => {
    await clearSession();
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Synchronous local update — does NOT persist. Use when the server has
     *  already been told (e.g. profile edits echoed back into the session). */
    patchUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
  },
  extraReducers: (b) => {
    b.addCase(hydrateFromSession.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.bootstrapped = true;
    })
      // Storage failures must not trap the app on a splash screen — mark the
      // bootstrap done and let the user log in again.
      .addCase(hydrateFromSession.rejected, (state) => {
        state.bootstrapped = true;
      })
      .addCase(setCredentials.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.bootstrapped = true;
      })
      .addCase(clearCredentials.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.bootstrapped = true;
      });
  },
});

export const { patchUser } = authSlice.actions;
export default authSlice.reducer;
