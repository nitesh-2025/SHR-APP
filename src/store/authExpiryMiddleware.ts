import { isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';

import { clearCredentials } from './authSlice';
import { toast } from '../lib/toast';

/**
 * Signs the user out the moment ANY request comes back 401.
 *
 * `useAutoLogout` already handles the token's own `exp`, but that only knows
 * what the client can read from the JWT. A token revoked server-side, a signing
 * key rotated on a redeploy, or a backend that simply restarted all produce a
 * live-looking session whose every request fails — the app would sit there
 * showing empty cards forever. One middleware covers every API slice, so no
 * endpoint can be forgotten.
 *
 * A failed LOGIN also returns 401; the authenticated check below keeps that
 * from being treated as an expiry (there is no session to end).
 */

/** Concurrent screens can 401 together — one sign-out, one toast. */
const DEBOUNCE_MS = 3000;
let lastHandledAt = 0;

export const authExpiryMiddleware: Middleware = (store) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const status = (action.payload as { status?: unknown } | undefined)?.status;
    const { auth } = store.getState() as {
      auth: { accessToken: string | null; user: unknown };
    };
    // Token-only, matching `selectIsAuthenticated`: a leftover user object with
    // no token is not a session, and treating it as one would turn a failed
    // LOGIN 401 into a bogus "Session expired" toast.
    const authenticated = Boolean(auth?.accessToken);

    if (status === 401 && authenticated && Date.now() - lastHandledAt > DEBOUNCE_MS) {
      lastHandledAt = Date.now();
      // Clearing the session flips `selectIsAuthenticated`, and RootNavigator
      // swaps the stack — no imperative navigation needed from here.
      store.dispatch(clearCredentials() as never);
      toast.error('Session expired', 'Please sign in again.');
    }
  }

  return next(action);
};
