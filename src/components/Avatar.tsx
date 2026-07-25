import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";

import type { AuthUser } from "../store/tokenStorage";
import { resolvePhotoUri } from "../utils/photo";

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
  const [failed, setFailed] = useState(false);
  const uri = useMemo(() => resolvePhotoUri(user), [user]);

  // A new URI deserves a fresh attempt — without this, one failed load would
  // keep showing initials even after the user uploads a working photo.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (__DEV__ && user && !uri) {
    console.log(
      '[Avatar] no photo field found on user. Keys:',
      Object.keys(user as object).join(', '),
    );
  }

  const showPhoto = Boolean(uri) && !failed;

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center overflow-hidden bg-brand-600 ${
        ring ? "border-2 border-white/70" : ""
      }`}
    >
      {showPhoto ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          onError={(e) => {
            if (__DEV__) {
              console.log('[Avatar] image failed:', uri, e.nativeEvent);
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
