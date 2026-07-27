import type { Surface } from './colors';

/**
 * The primary accent. One colour carries the whole app — status meaning comes
 * from the semantic set (`success` / `warning` / `danger`), never from a second
 * decorative brand hue.
 *
 * Blue is the default; the rest are opt-in from the drawer for teams that want
 * their own tint.
 */
export type ThemeName = 'blue' | 'green' | 'purple' | 'amber' | 'red';

export type Ramp = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

export const THEME_ORDER: ThemeName[] = ['green', 'blue', 'purple', 'amber', 'red'];

export const DEFAULT_THEME: ThemeName = 'green';

const blue: Ramp = {
  50: '#EFF5FF',
  100: '#DBE8FE',
  200: '#BFD7FE',
  300: '#93B8FD',
  400: '#6096FA',
  500: '#3B7BF6',
  600: '#2563EB',
  700: '#1D4FD8',
  800: '#1E44AF',
  900: '#1E3A8A',
};

const green: Ramp = {
  50: '#F0FDF4',
  100: '#DCFCE7',
  200: '#BBF7D0',
  300: '#86EFAC',
  400: '#4ADE80',
  500: '#22C55E',
  600: '#16A34A',
  700: '#15803D',
  800: '#166534',
  900: '#14532D',
};

const purple: Ramp = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#C084FC',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7E22CE',
  800: '#6B21A8',
  900: '#581C87',
};

const amber: Ramp = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
};

const red: Ramp = {
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  300: '#FCA5A5',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
  700: '#B91C1C',
  800: '#991B1B',
  900: '#7F1D1D',
};

export const THEMES: Record<ThemeName, { label: string; ramp: Ramp }> = {
  blue: { label: 'Blue', ramp: blue },
  green: { label: 'Green', ramp: green },
  purple: { label: 'Purple', ramp: purple },
  amber: { label: 'Amber', ramp: amber },
  red: { label: 'Red', ramp: red },
};

/** The tinted-surface recipe for a ramp — same shape as `surface.*`. */
export function surfaceOf(ramp: Ramp): Surface {
  return { bg: ramp[50], border: ramp[200], tint: ramp[600], text: ramp[700] };
}
