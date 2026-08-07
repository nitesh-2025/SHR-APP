import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { radius, shadow, space, toneFor, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/* ── Card ─────────────────────────────────────────────────────────────────── */

/**
 * The one container in the app. Elevation, not a border, separates it from the
 * canvas — in dark mode the hairline is nearly transparent and the lift does
 * all the work.
 */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const { c, dark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: c.border,
          padding: padded ? space.lg + 2 : 0,
          ...(dark ? shadow.none : shadow.card),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */

export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { c, brand } = useTheme();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingHorizontal: space.screen, marginBottom: space.md }}
    >
      <Text style={{ color: c.text }} className={T.section}>
        {title}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={action ?? `View all ${title}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          className="flex-row items-center gap-0.5"
        >
          <Text style={{ color: brand[600] }} className={T.label}>
            {action ?? "View all"}
          </Text>
          <ChevronRight size={15} strokeWidth={2} color={brand[600]} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  loading = false,
  disabled = false,
  full = true,
  style,
}: {
  label: string;
  onPress: () => void;
  /** Rendered left of the label, at 20px. */
  icon?: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}) {
  const { brand, c, dark } = useTheme();
  const off = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border: string }
  > = {
    primary: { bg: brand[600], fg: "#FFFFFF", border: "transparent" },
    secondary: {
      bg: dark ? "rgba(255,255,255,0.06)" : brand[50],
      fg: dark ? "#FFFFFF" : brand[700],
      border: "transparent",
    },
    ghost: { bg: "transparent", fg: c.textMuted, border: c.border },
    danger: {
      bg: dark ? "rgba(239,68,68,0.14)" : "#FEF2F2",
      fg: "#EF4444",
      border: "transparent",
    },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      // NO `className` here, and none on the label either.
      //
      // A FUNCTION `style` prop plus a `className` on the same Pressable is the
      // one combination NativeWind cannot merge reliably — it injects its own
      // style and the function's object loses, taking `backgroundColor` with
      // it. That is how a primary button ended up transparent: white on a white
      // sheet, present and pressable but invisible, which read as "there is no
      // submit button". Layout, fill and type all live in plain styles now, so
      // there is nothing left to merge.
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: radius.button,
          backgroundColor: p.bg,
          borderWidth: p.border === "transparent" ? 0 : 1,
          borderColor: p.border,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "flex-start",
          paddingHorizontal: space.xl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon}
      {/* One line, always. A wrapped button label is the loudest possible way
          to say the layout was never checked. */}
      <Text
        style={{
          color: p.fg,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 15,
        }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */

// Lives in its own file — it is the one control here with real motion in it.
// Re-exported so every existing `import { Segmented } from '../components/ui'`
// keeps working untouched.
export { Segmented, type Segment } from "./Segmented";

/* ── Badge ────────────────────────────────────────────────────────────────── */

export function Badge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: Surface;
  icon?: ReactNode;
}) {
  // Re-mixed for the active scheme — the raw recipe is white-canvas only.
  const { dark } = useTheme();
  const t = toneFor(tone, dark);

  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: 4,
      }}
      className="flex-row items-center gap-1.5 px-2.5 py-1"
    >
      <Text style={{ color: t.text }} className={T.badge} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ── Range chip ───────────────────────────────────────────────────────────── */

/**
 * The dropdown trigger that sits in a screen header — month, year, any short
 * filter whose options open in a sheet.
 *
 * Tinted rather than outlined: it shares its row with a title, and a bordered
 * control there reads as an input the header does not have. Attendance and
 * Leave both use it, so "tap the chip, pick from a sheet" is learned once.
 */
export function RangeChip({
  label,
  a11y,
  onPress,
}: {
  label: string;
  /** Spoken label — include the current value AND the verb ("Change month"). */
  a11y: string;
  onPress: () => void;
}) {
  const { brand, tint } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        backgroundColor: tint.bg,
        borderRadius: radius.pill,
        opacity: pressed ? 0.75 : 1,
      })}
      className="h-9 flex-row items-center gap-1 px-3"
    >
      <Text
        style={{ color: brand[700] }}
        className={T.badge}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
      <ChevronDown size={14} strokeWidth={2.6} color={brand[700]} />
    </Pressable>
  );
}

/* ── Icon well ────────────────────────────────────────────────────────────── */

/** Circular/rounded tinted background behind an icon. */
export function IconWell({
  children,
  tone,
  size = 44,
  round = false,
}: {
  children: ReactNode;
  tone: Surface;
  size?: number;
  round?: boolean;
}) {
  const { dark } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : radius.well,
        backgroundColor: toneFor(tone, dark).bg,
      }}
      className="items-center justify-center"
    >
      {children}
    </View>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  color,
  height = 8,
  track,
}: {
  /** 0–1. Anything outside is clamped. */
  value: number;
  color: string;
  height?: number;
  /** Override the track colour — needed on filled/accent cards. */
  track?: string;
}) {
  const { c } = useTheme();
  const pct = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={{
        height,
        backgroundColor: track ?? c.fill,
        borderRadius: radius.pill,
      }}
      className="overflow-hidden"
    >
      <View
        style={{
          width: `${pct * 100}%`,
          backgroundColor: color,
          borderRadius: radius.pill,
        }}
        className="h-full"
      />
    </View>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

/**
 * Loading placeholder. A pulsing block beats a spinner because it shows the
 * SHAPE of what is coming — the screen doesn't jump when data lands.
 */
export function Skeleton({
  height = 16,
  width,
  radius: r = 10,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        {
          height,
          width: width ?? "100%",
          borderRadius: r,
          backgroundColor: c.fill,
        },
        animated,
        style,
      ]}
    />
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

/**
 * Square so the ring family stays centred on the glyph whatever the copy under
 * it does. 152 rather than the old 80 because the ornament, not the glyph, is
 * now the object — the glyph is what sits at the middle of it.
 */
const EMPTY_FIELD = 152;

/**
 * Ring radii, and how far each one has faded by the time you reach it. The gaps
 * WIDEN outward (16 then 20), which is what makes the family read as something
 * radiating away rather than as a target with a bullseye in it.
 */
const EMPTY_RINGS = [27, 43, 63] as const;
const EMPTY_RING_FADE = [1, 0.66, 0.38] as const;

/**
 * `url(#id)` references are resolved per document on Android, not per `<Svg>`,
 * so two of these mounted at once would share one gradient. A counter is enough
 * — `useId()` emits `:r0:`, and a colon is not legal inside a url() reference.
 */
let emptyFieldSeq = 0;

/**
 * Never a blank screen. One line of what happened, one line of what to do, and
 * the action itself when there is one.
 *
 * The glyph used to sit in an 80px disc filled with `primary.bg`, and that disc
 * was wrong twice over. It is the empty state every framework ships with, which
 * meant the screen a demo account spends most of its life on was the least
 * considered screen in the product. And `primary.bg` is the 50 step of the
 * accent ramp — the exact pairing §2.6 of the design doc warns about — so in
 * dark mode it was an 80px slab of near-white punched into the `#0F172A`
 * canvas, the brightest object on a screen whose entire message is that there
 * is nothing to look at.
 *
 * What replaces it is the ornament the app already owns. The gradient heroes on
 * Leave and Payslip carry a family of concentric arcs anchored off the card's
 * bottom-right corner and cropped by the card edge, so what you see there is a
 * slice of a much larger figure. Here — the one composition in the app that is
 * centred by rule — the same figure is drawn whole and centred on the glyph,
 * with the hero's horizon curve passing underneath it. Everywhere else you get
 * the edge of these rings; the empty state is where you see where they come
 * from. Extending the existing ornament matters more than the ornament itself:
 * a second decorative language would have cancelled out the first.
 *
 * Nothing here has a hard edge. The fill behind the glyph is a radial wash of
 * the accent that reaches zero alpha before the outer ring, and the horizon is
 * stroked with a gradient that fades at both ends instead of stopping dead at
 * the field boundary the way the hero's does behind its clip. The rings are
 * drawn in `toneFor(primary, dark).border`, so dark mode re-mixes them from the
 * accent itself rather than glowing a light-mode tint at the user.
 *
 * The entrance is one timing value driving both the block's lift and the
 * ornament's settle, 260ms ease-out. Two separately-timed animations would have
 * spent more of the user's attention on the absence of data than the data ever
 * gets when it arrives.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { c, dark, primary } = useTheme();
  const tone = toneFor(primary, dark);
  const uid = useRef(`es${(emptyFieldSeq += 1)}`).current;

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [enter]);

  const block = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }],
  }));
  // Same value, later in its own travel: the ornament is still settling as the
  // text finishes arriving, which is what keeps it reading as one movement.
  const ornament = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + enter.value * 0.06 }],
  }));

  const half = EMPTY_FIELD / 2;

  return (
    <Animated.View className="items-center px-10 pt-8" style={block}>
      <Animated.View
        style={[{ width: EMPTY_FIELD, height: EMPTY_FIELD }, ornament]}
        className="items-center justify-center"
      >
        <Svg
          width={EMPTY_FIELD}
          height={EMPTY_FIELD}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <Defs>
            <RadialGradient id={`${uid}wash`} cx="50%" cy="50%" r="50%">
              <Stop
                offset="0"
                stopColor={primary.tint}
                stopOpacity={dark ? 0.2 : 0.12}
              />
              <Stop
                offset="0.45"
                stopColor={primary.tint}
                stopOpacity={dark ? 0.07 : 0.05}
              />
              <Stop offset="1" stopColor={primary.tint} stopOpacity={0} />
            </RadialGradient>
            <SvgLinearGradient id={`${uid}horizon`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={primary.tint} stopOpacity={0} />
              <Stop
                offset="0.5"
                stopColor={primary.tint}
                stopOpacity={dark ? 0.28 : 0.18}
              />
              <Stop offset="1" stopColor={primary.tint} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          <Circle cx={half} cy={half} r={half} fill={`url(#${uid}wash)`} />

          {EMPTY_RINGS.map((r, i) => (
            <Circle
              key={r}
              cx={half}
              cy={half}
              r={r}
              fill="none"
              stroke={tone.border}
              strokeWidth={1.2}
              strokeOpacity={EMPTY_RING_FADE[i]}
            />
          ))}

          {/* The hero's horizon, same curve, same 1.4 stroke. */}
          <Path
            d={`M0 ${EMPTY_FIELD * 0.72} Q ${EMPTY_FIELD * 0.3} ${EMPTY_FIELD * 0.58} ${
              EMPTY_FIELD * 0.62
            } ${EMPTY_FIELD * 0.76} T ${EMPTY_FIELD} ${EMPTY_FIELD * 0.68}`}
            fill="none"
            stroke={`url(#${uid}horizon)`}
            strokeWidth={1.4}
          />
        </Svg>

        {icon}
      </Animated.View>

      <Text
        style={{ color: c.text }}
        className={`mt-2 text-center ${T.cardTitle}`}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-1.5 text-center leading-5 ${T.secondary}`}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          full={false}
          style={{ marginTop: space.xl }}
        />
      ) : null}
    </Animated.View>
  );
}
