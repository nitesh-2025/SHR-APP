import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, shadow, space, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

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
            {action ?? 'View all'}
          </Text>
          <ChevronRight size={15} strokeWidth={2} color={brand[600]} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
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

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: brand[600], fg: '#FFFFFF', border: 'transparent' },
    secondary: {
      bg: dark ? 'rgba(255,255,255,0.06)' : brand[50],
      fg: dark ? '#FFFFFF' : brand[700],
      border: 'transparent',
    },
    ghost: { bg: 'transparent', fg: c.textMuted, border: c.border },
    danger: { bg: dark ? 'rgba(239,68,68,0.14)' : '#FEF2F2', fg: '#EF4444', border: 'transparent' },
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
          borderWidth: p.border === 'transparent' ? 0 : 1,
          borderColor: p.border,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
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
          fontFamily: 'Outfit_600SemiBold',
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
export { Segmented, type Segment } from './Segmented';

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
  return (
    <View
      style={{ backgroundColor: tone.bg, borderRadius: radius.pill }}
      className="flex-row items-center gap-1.5 px-2.5 py-1"
    >
      {icon ?? (
        <View
          style={{ backgroundColor: tone.tint }}
          className="h-1.5 w-1.5 rounded-full"
        />
      )}
      <Text style={{ color: tone.text }} className={T.badge} numberOfLines={1}>
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
  const { brand, primary } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        backgroundColor: primary.bg,
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
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : radius.well,
        backgroundColor: tone.bg,
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
      style={{ height, backgroundColor: track ?? c.fill, borderRadius: radius.pill }}
      className="overflow-hidden"
    >
      <View
        style={{ width: `${pct * 100}%`, backgroundColor: color, borderRadius: radius.pill }}
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
        { height, width: width ?? '100%', borderRadius: r, backgroundColor: c.fill },
        animated,
        style,
      ]}
    />
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

/**
 * Never a blank screen. An illustration-sized glyph, one line of what happened,
 * one line of what to do, and the action itself when there is one.
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
  const { c, primary } = useTheme();

  return (
    <View className="items-center px-10 pt-12">
      <View
        style={{ backgroundColor: primary.bg }}
        className="h-20 w-20 items-center justify-center rounded-full"
      >
        {icon}
      </View>
      <Text style={{ color: c.text }} className={`mt-4 text-center ${T.cardTitle}`}>
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
    </View>
  );
}
