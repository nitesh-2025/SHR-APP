// Session persistence (native port of StaffCore's localStorage version).
//
// Two stores on purpose:
//  • tokens  → expo-secure-store (Keychain / EncryptedSharedPreferences). These
//    are bearer credentials, so they must not sit in plaintext app storage.
//  • user    → AsyncStorage. SecureStore warns (and on some Android builds
//    fails) above ~2KB per value, and the user object carries a `permissions[]`
//    array that easily exceeds that. It is not a secret — the same data is
//    inside the JWT — so plain storage is the right trade-off.
//
// Every function is async here; the web version was synchronous. That is why
// `hydrateFromSession` is a thunk rather than a plain reducer (see authSlice).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { DeviceType } from '../utils/device';

const ACCESS_TOKEN_KEY = 'hrms_access_token';
const REFRESH_TOKEN_KEY = 'hrms_refresh_token';
const USER_KEY = 'hrms:user';
const REMEMBER_KEY = 'hrms:remembered_email';

/**
 * Flat view of the signed-in user. The server sends a populated Mongo document
 * (`role` / `department_id` as objects) — `normalizeAuthUser` flattens it onto
 * this shape before anything stores or reads it.
 */
export interface AuthUser {
  _id: string;
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  /** Role CODE (e.g. `ADMIN`) — what the RBAC checks compare against. */
  role?: string;
  /** Human label for the role (e.g. `Admin`), display only. */
  role_name?: string;
  /** Profile photo URL. Absent for most users — the UI falls back to initials. */
  profile_photo?: string | null;
  /** Same URL under the key the API actually sends. Kept in sync by the normalizer. */
  profile_image?: string | null;
  /** Live permission keys for the user's role (from login response). */
  permissions?: string[];
  department_id?: string;
  department_name?: string;
  designation?: string;
  status?: 'active' | 'inactive' | 'suspended';
  phone?: string;
  location?: string;
  last_login_at?: string;
  /** Device classes this user may sign in from. Empty/absent = no restriction. */
  allowed_devices?: DeviceType[];
}

export interface Session {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

export async function saveSession({
  access_token,
  refresh_token,
  user,
}: {
  access_token?: string | null;
  refresh_token?: string | null;
  user?: AuthUser | null;
}): Promise<void> {
  try {
    await Promise.all([
      access_token
        ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token)
        : null,
      refresh_token
        ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token)
        : null,
      user ? AsyncStorage.setItem(USER_KEY, JSON.stringify(user)) : null,
    ]);
  } catch {
    /* storage unavailable — ignore, session just won't survive a restart */
  }
}

export async function readSession(): Promise<Session> {
  try {
    const [accessToken, refreshToken, userRaw] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    return {
      accessToken,
      refreshToken,
      user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

// ── "Remember me" ───────────────────────────────────────────────────────────
// Only the EMAIL is kept, never the password — a stored password would be a
// credential at rest for zero real benefit, since the session tokens already
// keep the user signed in. This is AsyncStorage rather than SecureStore for the
// same reason: an email address is not a secret.
//
// Note this is independent of staying logged in. Tokens are always persisted;
// this flag only controls whether the email field is pre-filled after a logout.

export async function saveRememberedEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REMEMBER_KEY, email);
  } catch {
    /* storage unavailable — the field just won't pre-fill next time */
  }
}

export async function readRememberedEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

export async function clearRememberedEmail(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

export async function clearSession(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  } catch {
    /* ignore */
  }
}

// ── JWT expiry helpers ──────────────────────────────────────────────────────
// The web version used `atob`, which is not guaranteed on Hermes. This decodes
// base64url → UTF-8 by hand so it works on every RN engine with no polyfill.

const B64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = B64_ALPHABET.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Minimal UTF-8 decoder — avoids depending on TextDecoder being present. */
function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      out += String.fromCharCode(b1);
    } else if (b1 < 0xe0) {
      out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b1 < 0xf0) {
      out += String.fromCharCode(
        ((b1 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      const cp =
        ((b1 & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const off = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
    }
  }
  return out;
}

/**
 * Reads the `exp` claim (seconds since epoch) from a JWT WITHOUT verifying the
 * signature — we only need it to know when to auto-logout on the client.
 * Returns the expiry in ms, or null if missing/malformed.
 */
export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const { exp } = JSON.parse(utf8Decode(base64UrlToBytes(payload))) as {
      exp?: number;
    };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True if the JWT has an `exp` claim that is already in the past. */
export function isTokenExpired(token: string | null | undefined): boolean {
  const expMs = getTokenExpiryMs(token);
  return expMs !== null && expMs <= Date.now();
}
