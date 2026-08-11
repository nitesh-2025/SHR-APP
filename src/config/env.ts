// API base URL — resolved from Expo env, never hardcoded per environment.
// Expo inlines any `EXPO_PUBLIC_*` var at build time (.env), so this mirrors
// StaffCore's `VITE_BASE_URL` contract on the native side.
//
// ── Reaching a dev backend from a device ────────────────────────────────────
// `localhost` inside the app is the DEVICE's own loopback, not your dev
// machine. Rather than rewriting the host (10.0.2.2 works only on the Android
// emulator, never on a physical phone), forward the port over adb — one command
// that is correct for BOTH emulator and USB-connected device:
//
//     adb reverse tcp:5000 tcp:5000
//
// Then `http://localhost:5000` resolves to your machine on either target.
// For a device on Wi-Fi with no cable, put your LAN IP in .env instead.

const RAW_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? '';

export const API_BASE_URL = RAW_BASE_URL;

// Identifies this portal to the backend audit trail (X-App-Source header).
export const APP_SOURCE = process.env.EXPO_PUBLIC_APP_SOURCE || 'STAFFCORE';

export const LONG_BREAK_MIN = Number(
  process.env.EXPO_PUBLIC_LONG_BREAK_MIN ?? 50,
);

// Terms & Conditions page opened from the login screen. Left empty rather than
// pointed at a guessed URL — the link tells the user it is unconfigured instead
// of silently opening a 404.
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? '';

/**
 * Public careers page, if the company has one. Empty = not configured.
 *
 * Two things depend on it and both degrade honestly without it: the shared
 * job post appends the link only when there is one, and the LinkedIn button
 * falls back to the system share sheet — `share-offsite` takes a URL and
 * nothing else, so with no URL there is nothing to hand it.
 *
 * Never guessed. A careers URL is the one line in a shared post a candidate
 * actually taps, and a 404 on it costs the REFERRER their credibility.
 */
export const CAREERS_URL = process.env.EXPO_PUBLIC_CAREERS_URL ?? '';

/**
 * Referral bonus paid on a successful hire, in rupees. `0` = not configured.
 *
 * Config rather than an API call because no recruitment endpoint knows this
 * number today — `/jobs` has `salary_range` for the CANDIDATE, nothing for the
 * referrer. Same contract as `TERMS_URL` above: unset means the UI says nothing
 * rather than showing a figure nobody can honour. Printing an invented amount
 * next to a real pipeline is the fastest way to lose the screen's credibility,
 * and it is the one number an employee would quote back at HR.
 *
 * When the backend grows a real field, this becomes the fallback: read the API
 * first, fall back to this, and the UI below needs no change.
 */
export const REFERRAL_REWARD = Number(
  process.env.EXPO_PUBLIC_REFERRAL_REWARD ?? 0,
);

if (__DEV__ && !RAW_BASE_URL) {
  console.warn(
    '[env] EXPO_PUBLIC_BASE_URL is not set — every API call will fail. ' +
      'Add it to .env and restart Metro with `npx expo start -c`.',
  );
}
