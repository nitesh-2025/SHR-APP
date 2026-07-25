import { useEffect } from 'react';
import { AppState } from 'react-native';

import { selectAuth, useAppDispatch, useAppSelector } from '../store';
import { clearCredentials } from '../store/authSlice';
import { getTokenExpiryMs, isTokenExpired } from '../store/tokenStorage';
import { toast } from '../lib/toast';

/**
 * Auto-logs the user out the moment their access token expires.
 *
 * Schedules a single timer for the remaining lifetime instead of polling, and
 * re-arms whenever the token changes (login / refresh).
 *
 * Native-only concern the web build didn't have: JS timers do not fire reliably
 * while the app is backgrounded (and are frozen outright on iOS). A token that
 * expires while backgrounded would otherwise leave the app "logged in" on
 * resume until the next 401. So we also re-check expiry whenever the app comes
 * back to the foreground.
 */
export function useAutoLogout() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAppSelector(selectAuth);

  useEffect(() => {
    if (!accessToken) return;

    const expMs = getTokenExpiryMs(accessToken);
    if (expMs === null) return; // no exp claim -> nothing to schedule

    const logout = () => {
      dispatch(clearCredentials());
      toast.info('Session expired. Please log in again.');
    };

    const remaining = expMs - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }

    // setTimeout caps at ~24.8 days (2^31-1 ms); fine for typical token TTLs.
    const id = setTimeout(logout, remaining);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isTokenExpired(accessToken)) logout();
    });

    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [accessToken, dispatch]);
}
