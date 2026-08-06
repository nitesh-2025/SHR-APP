import type { ToastKind } from './toast';

export interface ToastPalette {
  /** Card fill — neutral, NOT tinted by type. */
  surface: string;
  border: string;
  /** The only type-coloured element besides the progress bar. */
  accent: string;
  title: string;
  description: string;
  close: string;
  /** Progress bar track. */
  track: string;
  shadow: string;
  shadowOpacity: number;
}

// A tinted card per severity (green card / red card / amber card) is what made
// the old toast feel heavy: four large blocks of colour competing with the app
// behind them. Here the surface stays neutral and the TYPE is carried by the
// icon and the progress bar alone — the same approach Linear, Vercel and iOS
// system banners use. It reads as lighter without losing any signal.
const NEUTRAL_LIGHT = {
  surface: 'rgba(255,255,255,0.97)',
  border: '#E9EDF2',
  title: '#0F172A',
  description: '#64748B',
  close: '#94A3B8',
  track: 'rgba(15,23,42,0.06)',
  shadow: '#0F172A',
  shadowOpacity: 0.1,
};

const NEUTRAL_DARK = {
  surface: 'rgba(28,30,34,0.97)',
  border: '#33373E',
  title: '#F8FAFC',
  description: '#9BA3AF',
  close: '#7C848F',
  track: 'rgba(255,255,255,0.09)',
  shadow: '#000000',
  shadowOpacity: 0.45,
};

const ACCENT_LIGHT: Record<ToastKind, string> = {
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// Lifted so they still clear contrast against a near-black surface.
const ACCENT_DARK: Record<ToastKind, string> = {
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
};

/**
 * The glyph sits in a solid disc of the accent colour, white icon on top —
 * `badgeInk` is that white, kept as a token because on the lifted dark accents
 * (`#FBBF24` amber in particular) white is not the readable choice: a near-black
 * glyph is. One place decides it, so the amber toast is never the one that
 * quietly fails contrast.
 */
export function toastBadgeInk(kind: ToastKind, isDark: boolean): string {
  if (isDark && (kind === 'warning' || kind === 'success' || kind === 'info')) {
    return '#0B1120';
  }
  return '#FFFFFF';
}

export function toastPalette(kind: ToastKind, isDark: boolean): ToastPalette {
  const base = isDark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  return { ...base, accent: (isDark ? ACCENT_DARK : ACCENT_LIGHT)[kind] };
}
