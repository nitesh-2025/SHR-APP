import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

/* ── Geometry ─────────────────────────────────────────────────────────────── */

const HEIGHT = 48;
const RADIUS = 18;
const PAD = 4;
/** Space between segments. The pill is inset by this on either side. */
const GAP = 6;
/** Everything moves over the same duration, so nothing arrives out of step. */
const DURATION = 250;
const PRESS_DURATION = 150;

/** Track and pill fills. Not from the scheme tokens: this control is specified. */
const TRACK_LIGHT = '#F1F5F9';
const TRACK_DARK = '#1E293B';
const PILL_LIGHT = '#FFFFFF';
const PILL_DARK = '#334155';
const INK_ACTIVE_LIGHT = '#0F172A';
const INK_ACTIVE_DARK = '#F8FAFC';
const INK_MUTED = '#64748B';

export interface Segment<K extends string> {
  key: K;
  label: string;
  /** Rendered as a count pill after the label. Omit or pass 0 to hide. */
  count?: number;
}

/* ── One segment ──────────────────────────────────────────────────────────── */

interface SegmentButtonProps {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}

/**
 * A label over the pill, not a button of its own.
 *
 * The segment draws no background at all — the floating pill behind it is the
 * only fill in the control, which is what lets that pill SLIDE between options
 * instead of one background switching off as another switches on.
 */
const SegmentButton = memo(function SegmentButton({
  label,
  count,
  active,
  onPress,
}: SegmentButtonProps) {
  const { dark, brand } = useTheme();

  // Press feedback is a there-and-back dip, not a state: it plays out on its
  // own whether or not the tap changes the selection.
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const onPressIn = useCallback(() => {
    press.value = withTiming(0.96, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.quad),
    });
  }, [press]);

  const onPressOut = useCallback(() => {
    press.value = withSequence(
      withTiming(0.96, { duration: 0 }),
      withTiming(1, { duration: PRESS_DURATION, easing: Easing.out(Easing.quad) }),
    );
  }, [press]);

  const ink = active ? (dark ? INK_ACTIVE_DARK : INK_ACTIVE_LIGHT) : INK_MUTED;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
      accessibilityState={{ selected: active }}
      style={{ flex: 1, height: HEIGHT - PAD * 2 }}
      className="items-center justify-center"
    >
      <Animated.View
        style={pressStyle}
        className="flex-row items-center justify-center gap-1.5"
      >
        <Text
          style={{
            color: ink,
            fontFamily: 'Outfit_600SemiBold',
            fontSize: active ? 16 : 15,
          }}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {label}
        </Text>

        {/* A circle, not a rounded rectangle — `minWidth` lets a 3-digit count
            stretch it into a pill, but the common single digit stays round. */}
        {count ? (
          <View
            style={{
              backgroundColor: active ? brand[600] : INK_MUTED,
              borderRadius: 999,
              height: 20,
              minWidth: 20,
              paddingHorizontal: 5,
            }}
            className="items-center justify-center"
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: 'Outfit_600SemiBold',
                fontSize: 11,
              }}
              allowFontScaling={false}
            >
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

/* ── Control ──────────────────────────────────────────────────────────────── */

/**
 * Segmented control — a floating pill that slides between options.
 *
 * The pill is one absolutely-positioned view that translates, rather than each
 * segment lighting its own background up. Same pixels either way; the
 * difference is that a slide says the options are one control, and a swap says
 * they are two buttons that happen to be adjacent.
 *
 * Everything runs on the UI thread through Reanimated shared values, so the
 * movement does not stutter while the screen behind it is rendering.
 */
function SegmentedInner<K extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { dark } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    segments.findIndex((s) => s.key === value),
  );

  const count = segments.length;
  // Each segment owns an equal share; the pill is inset by half a gap either
  // side, so the space between two pill positions reads as GAP, not GAP × 2.
  const segWidth = trackWidth ? (trackWidth - PAD * 2) / count : 0;
  const pillWidth = Math.max(0, segWidth - GAP);

  const x = useSharedValue(0);
  const scale = useSharedValue(1);

  // Driven from render rather than an effect: the target is derived state, and
  // an effect would land it one frame late on the very first layout.
  const target = PAD + index * segWidth + GAP / 2;
  if (segWidth > 0) {
    x.value = withTiming(target, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: scale.value }],
  }));

  const select = useCallback(
    (key: K) => {
      // A 1.00 → 1.03 → 1.00 swell as the pill arrives. It reads as the pill
      // taking the new position rather than merely being repositioned.
      scale.value = withSequence(
        withTiming(1.03, { duration: DURATION / 2, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: DURATION / 2, easing: Easing.out(Easing.quad) }),
      );
      onChange(key);
    },
    [onChange, scale],
  );

  const items = useMemo(
    () =>
      segments.map((s) => (
        <SegmentButton
          key={s.key}
          label={s.label}
          count={s.count}
          active={s.key === value}
          onPress={() => select(s.key)}
        />
      )),
    [segments, value, select],
  );

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{
        height: HEIGHT,
        borderRadius: RADIUS,
        backgroundColor: dark ? TRACK_DARK : TRACK_LIGHT,
        padding: PAD,
        // Very soft: the track is a recess, and a recess should not look like
        // it is floating above the page it is cut into.
        shadowColor: '#0F172A',
        shadowOpacity: dark ? 0 : 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: dark ? 0 : 1,
      }}
      className="flex-row items-center"
    >
      {pillWidth > 0 ? (
        <Animated.View
          style={[
            {
              // In style, not as a prop — the `pointerEvents` prop is
              // deprecated in RN 0.76+ and warns on every render.
              pointerEvents: 'none',
              position: 'absolute',
              left: 0,
              top: PAD,
              width: pillWidth,
              height: HEIGHT - PAD * 2,
              borderRadius: RADIUS - PAD,
              backgroundColor: dark ? PILL_DARK : PILL_LIGHT,
              shadowColor: '#0F172A',
              shadowOpacity: dark ? 0.3 : 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            },
            pillStyle,
          ]}
        />
      ) : null}

      {items}
    </View>
  );
}

export const Segmented = memo(SegmentedInner) as typeof SegmentedInner;
