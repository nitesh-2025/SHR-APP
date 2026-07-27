import type { Middleware } from '@reduxjs/toolkit';

import { apis } from './apis';
import { clearCredentials } from './authSlice';

/**
 * Wipes every RTK Query cache the moment the session is cleared.
 *
 * Two concrete bugs this prevents:
 *
 *  1. Self-resurrecting session. A `/me` (or any other) request already in
 *     flight when the user taps Log out still resolves afterwards and writes
 *     into its cache. `useCurrentUserSync` then sees fresh `data` and calls
 *     `setCredentials({ user })` — which re-populates `auth.user` and puts the
 *     app straight back on the Dashboard. That is the "logout ke baad wapas
 *     auto sign-in" symptom.
 *  2. Cross-account leakage. Without a reset, the previous user's cached lists
 *     render for a frame or two after the NEXT user signs in, before their own
 *     refetch lands.
 *
 * `resetApiState` also aborts in-flight requests and drops subscriptions, so
 * nothing from the old session can land after this point.
 */
export const logoutResetMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  // Run AFTER the reducer so `auth` is already cleared — a reset dispatched
  // before that would let a still-authenticated selector refetch immediately.
  if (clearCredentials.fulfilled.match(action)) {
    for (const a of apis) store.dispatch(a.util.resetApiState());
  }

  return result;
};
