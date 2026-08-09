import * as Haptics from "expo-haptics";
import { Moon, Sun, SunMoon, type LucideIcon } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme, type ThemeMode } from "../theme/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Light / dark / follow-system, as ONE header glyph.
 *
 * It began as a three-segment control in the drawer footer, then as a full-width
 * `Segmented` on the profile page. Both were the same mistake in different
 * sizes: a control wide enough to name all three states, spending a row of the
 * page on a setting almost nobody opens twice.
 *
 * A single glyph can carry three states because it SHOWS the current one and
 * the tap cycles — sun → moon → auto → sun. The icon is the readout and the
 * button at once, which is why it fits in a header next to the gear.
 */
const NEXT: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const ICON: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

const LABEL: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "Auto",
};

export function ThemeToggle({
  /** Sitting on a dark/gradient header — inverts the glyph. */
  onDark = false,
  size = 21,
}: {
  onDark?: boolean;
  size?: number;
}) {
  const { mode, setMode, c } = useTheme();
  const Icon = ICON[mode];
  const next = NEXT[mode];

  const press = useSharedValue(0);
  const swap = useSharedValue(1);

  // Replays on every change. The glyph itself swaps instantly at render, so
  // without this the only feedback for a tap would be the whole app changing
  // colour — which is a lot of movement to attribute to one 21px icon.
  useEffect(() => {
    swap.value = 0;
    swap.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, swap]);

  const to = (v: number) =>
    withTiming(v, { duration: 130, easing: Easing.out(Easing.quad) });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.07 }],
  }));

  const swapStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ rotate: `${(1 - swap.value) * -90}deg` }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        // The change is silent and global — a tick of feedback under the thumb
        // is what tells you the tap landed on THIS control.
        Haptics.selectionAsync().catch(() => {});
        setMode(next);
      }}
      onPressIn={() => {
        press.value = to(1);
      }}
      onPressOut={() => {
        press.value = to(0);
      }}
      hitSlop={10}
      accessibilityRole="button"
      // Names the state AND the verb: a bare "Appearance" would leave a screen
      // reader user guessing what the tap does and what is on now.
      accessibilityLabel={`Appearance: ${LABEL[mode]}. Switch to ${LABEL[next]}`}
      style={[{ width: 44, height: 44 }, pressStyle]}
      className="items-center justify-center"
    >
      <Animated.View style={swapStyle}>
        <Icon
          size={size}
          strokeWidth={2}
          color={onDark ? "#FFFFFF" : c.textMuted}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}
