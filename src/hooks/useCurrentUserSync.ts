import { useEffect } from 'react';

import {
  selectCurrentUser,
  selectIsAuthenticated,
  useAppDispatch,
  useAppSelector,
} from '../store';
import { setCredentials } from '../store/authSlice';
import { mergeAuthUser } from '../store/normalizeUser';
import { useGetMeQuery } from '../store/usersApi';

/**
 * Keeps the stored session user in sync with `GET /api/users/me`.
 *
 * The login payload is a snapshot: a profile photo upload, a role change or a
 * department move made afterwards would otherwise only appear after a full
 * re-login. Refetching on mount / focus / reconnect keeps the drawer, header
 * and RBAC snapshot current, and the merged result is persisted so the next
 * cold start already has it.
 */
export function useCurrentUserSync() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);

  const { data, error } = useGetMeQuery(undefined, {
    skip: !isAuthenticated,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

  // Dev-only: when the avatar or a profile field looks stale, this says whether
  // /me actually answered — otherwise the failure is invisible (the UI simply
  // keeps showing the older login snapshot).
  useEffect(() => {
    if (!__DEV__) return;
    if (error) console.log('[me] failed:', JSON.stringify(error));
    else if (data)
      console.log('[me] ok — profile_image:', JSON.stringify(data.profile_image));
  }, [data, error]);

  useEffect(() => {
    if (!data) return;
    // A `/me` response can land after the user has signed out (the request was
    // already in flight). Writing it back then would re-create the session and
    // bounce the app to the Dashboard instead of Login.
    if (!isAuthenticated) return;
    const merged = mergeAuthUser(user, data);
    // Only write when something actually changed — `setCredentials` hits
    // AsyncStorage/SecureStore, and an unconditional dispatch here would loop
    // (state write → new user object → effect → write).
    if (!merged || JSON.stringify(merged) === JSON.stringify(user)) return;
    dispatch(setCredentials({ user: merged }));
  }, [data, user, isAuthenticated, dispatch]);
}
