/**
 * Design tokens.
 *
 * One primary accent, three semantic colours, one neutral ramp. Depth comes
 * from soft elevation, never from heavy borders — a 1px hairline is only used
 * where two surfaces of the same colour meet.
 *
 * The primary ramp is swappable at runtime (see `ThemeProvider`); everything
 * here is the fixed part of the system.
 */

/** Slate. The only grey family in the app. */
export const neutral = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const;

/** Status colours. Meaning only — never decoration. */
export const success = {
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  500: '#10B981',
  600: '#059669',
  700: '#047857',
} as const;

export const warning = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
} as const;

export const danger = {
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  500: '#EF4444',
  600: '#DC2626',
  700: '#B91C1C',
} as const;

/** Holidays and other neutral-informational marks. */
export const info = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
} as const;

export const purple = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7E22CE',
} as const;

/* ── Light / dark surfaces ───────────────────────────────────────────────── */

export interface Scheme {
  bg: string;
  /** Raised surface (cards, sheets, bars). */
  card: string;
  /** Slightly recessed fill — inputs, tracks, skeletons. */
  fill: string;
  /** Hairline. Nearly invisible in dark, where elevation does the work. */
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Scrim behind modals. */
  scrim: string;
}

export const lightScheme: Scheme = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  fill: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  scrim: 'rgba(15,23,42,0.45)',
};

export const darkScheme: Scheme = {
  bg: '#0F172A',
  card: '#1E293B',
  fill: '#243044',
  border: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  textMuted: '#94A3B8',
  textFaint: '#64748B',
  scrim: 'rgba(2,6,23,0.62)',
};

/* ── Geometry ────────────────────────────────────────────────────────────── */

export const radius = {
  card: 20,
  button: 16,
  input: 16,
  well: 16,
  pill: 999,
} as const;

/** 8px system. Use these, not raw numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  /** Screen side padding. */
  screen: 20,
} as const;

/* ── Elevation ───────────────────────────────────────────────────────────── */

/**
 * Soft and low-contrast. A card should look lifted, never outlined in shadow.
 * `elevation` is the Android counterpart — it cannot take a colour or opacity,
 * so it is kept deliberately low to match the softness of the iOS values.
 */
export const shadow = {
  none: {},
  /** Default card. y8 / blur24 / 8%. */
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /** Floating elements — bottom bar, FAB. */
  floating: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  /** Modal sheet rising over content. */
  sheet: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
} as const;

/**
 * A tinted-surface recipe: fill + hairline + icon/text ink. Every badge, well
 * and chip is built from one of these, which is what keeps them a family.
 */
export interface Surface {
  bg: string;
  border: string;
  tint: string;
  text: string;
}

export const surface = {
  success: { bg: success[50], border: success[200], tint: success[500], text: success[700] },
  warning: { bg: warning[50], border: warning[200], tint: warning[500], text: warning[700] },
  danger: { bg: danger[50], border: danger[200], tint: danger[500], text: danger[700] },
  purple: { bg: purple[50], border: purple[200], tint: purple[500], text: purple[700] },
  info: { bg: info[50], border: info[200], tint: info[500], text: info[700] },
  neutral: { bg: neutral[100], border: neutral[200], tint: neutral[400], text: neutral[500] },
  muted: { bg: neutral[50], border: neutral[200], tint: neutral[300], text: neutral[400] },
} satisfies Record<string, Surface>;

/* ── Type scale ──────────────────────────────────────────────────────────── */

/**
 * Sizes only — the family comes from `font-display` / `font-ui*` classes,
 * because in React Native weight lives in the font FILE, not `font-weight`.
 */
export const type = {
  title: 28,
  section: 18,
  cardTitle: 16,
  body: 14,
  caption: 12,
} as const;
