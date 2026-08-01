/**
 * The type scale. One place, one system.
 *
 * These are NativeWind class strings rather than numbers because every text
 * node in the app already styles itself with `className`, and a token that has
 * to be spread into `style` would just create a second way of doing the same
 * thing. The literals live here in source, so NativeWind still compiles them.
 *
 * Family names are ROLES, not weights — in React Native the weight comes from
 * the font FILE, so `font-bold` (which only emits `font-weight`) does nothing
 * to a custom family:
 *
 *   font-display      Outfit Bold       700
 *   font-ui-semibold  Outfit SemiBold   600
 *   font-ui           Outfit Medium     500
 *   font-ui-regular   Outfit Regular    400
 *
 * Hierarchy comes from SIZE and whitespace. Bold is for headings and numbers
 * only — reaching for it everywhere is what makes an app look shouty rather
 * than premium.
 */
export const T = {
  /** Wordmark / app-level title. */
  appTitle: 'font-display text-[30px] leading-9',
  /** The one big heading on a screen: "Nitesh 👋", "My Attendance". */
  screenTitle: 'font-display text-[28px] leading-[34px]',
  /** Section headers: "Quick Actions", "Today's Overview". */
  section: 'font-ui-semibold text-[18px]',
  /** Card and list-row titles. */
  cardTitle: 'font-ui-semibold text-[16px]',
  /** A title inside a small/dense card, where 16 would crowd. */
  cardTitleSm: 'font-ui-semibold text-[14px]',

  /** Hero numbers — the stopwatch, a balance, a total. */
  kpiHero: 'font-display text-[38px] leading-[46px]',
  /** Standard KPI figure. */
  kpi: 'font-display text-[26px] leading-8',
  /** KPI in a compact tile. */
  kpiSm: 'font-display text-[20px] leading-7',

  button: 'font-ui-semibold text-[15px]',
  /** Button inside a card / chip-sized control. */
  buttonSm: 'font-ui-semibold text-[13.5px]',

  /** Normal reading text. */
  body: 'font-ui text-[14px]',
  /** Supporting text next to a value — muted colour. */
  secondary: 'font-ui-regular text-[13px]',
  /** Timestamps, hints, legends — faint colour. */
  caption: 'font-ui-regular text-[12px]',
  /** The smallest label the system allows. Use sparingly. */
  micro: 'font-ui-regular text-[11px]',
  /**
   * Below the scale on purpose. The only sanctioned use is the hint line inside
   * a four-across shortcut card, where a ~78px card cannot hold 11px without
   * truncating. Do not reach for this anywhere else.
   */
  nano: 'font-ui-regular text-[10px]',

  /** Field labels above an input. */
  label: 'font-ui-semibold text-[13px]',
  /** Status chips and badges. */
  badge: 'font-ui-semibold text-[12px]',
  /** The number inside a count pill. Sits in a 20px circle, so it cannot grow. */
  count: 'font-ui-semibold text-[11px]',

  /**
   * Bottom navigation. Never bold — a nav label is not a heading, and the
   * active state is already carried by colour and a filled glyph.
   */
  navActive: 'font-ui text-[11.5px]',
  navInactive: 'font-ui-regular text-[11.5px]',
} as const;
