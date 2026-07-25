import { API_BASE_URL } from '../config/env';

// The backend's field name for a profile picture is not pinned down, and the
// web portal clearly reads a key this app was not checking. Rather than guess
// one, accept every name in common use — a wrong guess shows initials forever
// and looks like a bug, while an extra lookup costs nothing.
const PHOTO_KEYS = [
  'profile_photo',
  'profile_image',
  'profile_pic',
  'profilePhoto',
  'profileImage',
  'profilePic',
  'avatar',
  'avatar_url',
  'avatarUrl',
  'photo',
  'photo_url',
  'image',
  'image_url',
  'imageUrl',
  'picture',
] as const;

/** Nested containers some APIs wrap the file in, e.g. `{ profile: { photo } }`. */
const NESTED_KEYS = ['profile', 'employee', 'details'] as const;

function firstString(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of PHOTO_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    // Some APIs return `{ url: "..." }` for a file field.
    if (value && typeof value === 'object') {
      const url = (value as Record<string, unknown>).url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
  }
  return null;
}

/**
 * Resolve a usable image URI from a user object, or null.
 *
 * A relative path (`/uploads/x.jpg`) is joined onto the API host — `Image`
 * cannot load one on its own, which looks identical to "no photo set".
 */
export function resolvePhotoUri(user: unknown): string | null {
  let raw = firstString(user);

  if (!raw && user && typeof user === 'object') {
    const record = user as Record<string, unknown>;
    for (const key of NESTED_KEYS) {
      raw = firstString(record[key]);
      if (raw) break;
    }
  }

  if (!raw) return null;

  // Already absolute, or a data/blob URI the loader handles directly.
  if (/^(https?:|data:|file:|blob:)/i.test(raw)) return raw;

  if (!API_BASE_URL) return null;
  return `${API_BASE_URL.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
}
