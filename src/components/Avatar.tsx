import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";

import type { AuthUser } from "../store/tokenStorage";
import { useTheme } from "../theme/ThemeProvider";
import { resolvePhotoUri } from "../utils/photo";

/** Users already reported on — keeps the dev warning to one line each. */
const warnedFor = new Set<string>();

/** "Nitesh Kumar" → "NK"; falls back to the email's first letter. */
export function initialsOf(user?: AuthUser | null): string {
  const first = user?.first_name?.trim()?.[0];
  const last = user?.last_name?.trim()?.[0];
  if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
  return (user?.email?.trim()?.[0] ?? "?").toUpperCase();
}

export function fullNameOf(user?: AuthUser | null): string {
  const name = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || user?.email || "Signed in";
}

/**
 * Adapt any `{ name, profile_image }` record onto the shape `Avatar` reads.
 *
 * Employees, birthday rows and chat contacts all carry ONE `name` string where
 * `AuthUser` carries two. Splitting it here means the app still has a single
 * avatar rather than a second implementation per list — same photo resolution,
 * same initials fallback, same broken-image handling.
 */
export function personUser(person: {
  _id?: string;
  name?: string | null;
  email?: string | null;
  profile_image?: string | null;
}): AuthUser {
  const parts = (person.name ?? '').trim().split(/\s+/).filter(Boolean);
  const photo = person.profile_image ?? null;
  return {
    _id: person._id ?? '',
    email: person.email ?? '',
    first_name: parts[0],
    last_name: parts.slice(1).join(' ') || undefined,
    profile_image: photo,
    profile_photo: photo,
  };
}

/**
 * Profile photo with an initials fallback. The URI is resolved across the field
 * names backends use for this (see `resolvePhotoUri`) and relative paths are
 * joined onto the API host. A URL that 404s would otherwise render as an empty
 * grey box — `onError` flips to initials so it never shows a broken image.
 */
export function Avatar({
  user,
  size = 44,
  ring = false,
}: {
  user?: AuthUser | null;
  size?: number;
  ring?: boolean;
}) {
  const { brand } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = useMemo(() => resolvePhotoUri(user), [user]);

  // A new URI deserves a fresh attempt — without this, one failed load would
  // keep showing initials even after the user uploads a working photo.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  // Dev diagnostic, once per user — the old version logged on every render and
  // buried the Metro console. Prints the values (not the key list): the
  // normalizer always writes both photo keys, so their presence proves nothing.
  useEffect(() => {
    if (!__DEV__ || !user || uri) return;
    if (warnedFor.has(user._id)) return;
    warnedFor.add(user._id);
    console.log(
      "[Avatar] no photo for",
      user.email,
      "— profile_image:",
      JSON.stringify(user.profile_image),
      "profile_photo:",
      JSON.stringify(user.profile_photo),
    );
  }, [user, uri]);

  const showPhoto = Boolean(uri) && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brand[600],
      }}
      className={`items-center justify-center overflow-hidden ${
        ring ? "border-2 border-white/70" : ""
      }`}
    >
      {showPhoto ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          onError={(e) => {
            if (__DEV__) {
              console.log("[Avatar] image failed:", uri, e.nativeEvent);
            }
            setFailed(true);
          }}
          accessibilityRole="image"
          accessibilityLabel={`${fullNameOf(user)} profile photo`}
        />
      ) : (
        <Text
          style={{ fontSize: size * 0.36 }}
          className="font-bold text-white"
          allowFontScaling={false}
        >
          {initialsOf(user)}
        </Text>
      )}
    </View>
  );
}
