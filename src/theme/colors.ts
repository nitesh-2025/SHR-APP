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
  /** White smoke. Neutral, not slate-tinted — the cards on top are pure white,
   *  and a blue-grey canvas made them read as slightly warm by comparison. */
  bg: '#F5F5F5',
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

/**
 * One corner, everywhere: **4**.
 *
 * The ramp used to run 24 / 18 / 16, which meant a card, the button inside it
 * and the well inside that each curved differently — three radii stacked within
 * 40px, and every new surface had to guess which one it belonged to. A single
 * value removes the guess and reads as deliberate rather than soft.
 *
 * The names are kept so call sites still say what they are drawing (and so a
 * future change to one class of surface has somewhere to land), but they all
 * resolve to the same number. `pill` is the one exception — a pill is not a
 * radius, it is a shape, and 999 is how a chip, an avatar and the FAB stay
 * round.
 */
export const radius = {
  card: 4,
  button: 4,
  input: 4,
  /** Small surfaces: icon wells, inner wells, chips-with-corners. */
  well: 4,
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
  /**
   * Barely-there lift. For cards that sit in a group — a row of shortcuts, a
   * chart panel — where the full card shadow stacks into visible grey haze.
   */
  soft: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
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
    shadowOpacity: 0.14,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
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

/* ── Dark-mode tinting ───────────────────────────────────────────────────── */

/** `#22C55E` → `rgba(34,197,94,a)`. Non-hex input is returned untouched. */
export function withAlpha(hex: string, a: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Scheme-correct version of a `Surface`.
 *
 * The `surface.*` recipes above are built from the 50/200/700 steps, which only
 * work on a white canvas: `success[50]` over `#0F172A` is a near-white slab that
 * glows, and `success[700]` on top of it is the one pairing in the whole system
 * that fails contrast in dark mode. In dark we keep the SAME hue but rebuild the
 * chip from the 500 step — a low-alpha wash of the accent for the fill, the
 * accent itself for the ink. Same meaning, same family, no glare.
 */
export function toneFor(tone: Surface, dark: boolean): Surface {
  if (!dark) return tone;
  return {
    bg: withAlpha(tone.tint, 0.16),
    border: withAlpha(tone.tint, 0.32),
    tint: tone.tint,
    // 500-step colour on a 16% wash of itself over the dark canvas clears 4.5:1;
    // the 700 step (the light-mode ink) does not.
    text: tone.tint,
  };
}

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
