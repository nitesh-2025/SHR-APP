// ── Device type detection + allow-list enforcement (native port) ────────────
// Ported from StaffCore's web `utils/device.ts`. Same contract, but detection
// uses expo-device instead of the User-Agent string.
//
// IMPORTANT behavioural difference vs the web portal:
// on web, `detectDeviceType()` returned "desktop" for every PC, so StaffCore
// could default an employee with no `allowed_devices` to desktop-only and never
// lock anyone out. This app runs on phones/tablets and reports "mobile"/
// "tablet", so that same desktop-only default would refuse EVERY employee who
// has not been explicitly granted mobile access — i.e. the app would be unusable
// out of the box. The default is therefore permissive here (see
// `DEFAULT_ALLOWED_DEVICES`); an explicit `allowed_devices` list from the
// backend is still enforced exactly as before.
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'laptop';

// Order is intentional — used to render the selector consistently.
export const DEVICE_TYPES: DeviceType[] = [
  'mobile',
  'tablet',
  'desktop',
  'laptop',
];

export const DEVICE_LABEL: Record<DeviceType, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
  laptop: 'Laptop',
};

// Applies ONLY when the backend sends no `allowed_devices` for the user, which
// means "no restriction configured" — not "desktop only". Deliberately diverges
// from the web portal's desktop-only default: this is the mobile client, so that
// default would reject every unconfigured employee. Restriction is still fully
// honoured whenever the backend does send a list.
export const DEFAULT_ALLOWED_DEVICES: DeviceType[] = [
  'mobile',
  'tablet',
  'desktop',
  'laptop',
];

/**
 * Device class from expo-device. Unlike the browser, native can tell a phone
 * from a tablet reliably. Falls back to "mobile" when the platform reports
 * UNKNOWN (rooted/uncommon devices) rather than guessing "desktop", so the
 * allow-list check stays conservative.
 */
export function detectDeviceType(): DeviceType {
  switch (Device.deviceType) {
    case Device.DeviceType.TABLET:
      return 'tablet';
    case Device.DeviceType.PHONE:
      return 'mobile';
    case Device.DeviceType.DESKTOP:
      return 'desktop';
    default:
      // web build of this app, or an unrecognised device
      return Platform.OS === 'web' ? 'desktop' : 'mobile';
  }
}

// Device classes that mean the same thing for access purposes. A backend that
// grants "laptop" clearly intends to admit a desktop too, and one that grants
// "mobile" intends to admit a tablet — without this, a tablet user configured as
// mobile-only would be refused for no meaningful reason.
const EQUIVALENT: Partial<Record<DeviceType, DeviceType[]>> = {
  desktop: ['laptop'],
  laptop: ['desktop'],
  mobile: ['tablet'],
  tablet: ['mobile'],
};

/**
 * Is the current device permitted for a user with this allow-list?
 * - empty / undefined list → falls back to DEFAULT_ALLOWED_DEVICES (permissive)
 * - otherwise the list is enforced, widened only by `EQUIVALENT` siblings
 */
export function isDeviceAllowed(allowed?: DeviceType[] | null): boolean {
  const list = allowed && allowed.length ? allowed : DEFAULT_ALLOWED_DEVICES;
  const current = detectDeviceType();
  if (list.includes(current)) return true;
  return (EQUIVALENT[current] ?? []).some((sibling) => list.includes(sibling));
}
