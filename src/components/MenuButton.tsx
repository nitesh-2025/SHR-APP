import { List } from "lucide-react-native";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";


import { useTheme } from "../theme/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Header button that opens the app drawer. Uses the real Lucide glyph rather
 * than bars drawn from Views — the hand-rolled version had uneven optical
 * weight and no proper stroke caps at small sizes.
 */
export function MenuButton({
  onPress,
  accessibilityLabel = "Open menu",
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { brand, c, tint } = useTheme();
  const press = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.07 }],
  }));

  const to = (v: number) =>
    withTiming(v, { duration: 130, easing: Easing.out(Easing.quad) });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        press.value = to(1);
      }}
      onPressOut={() => {
        press.value = to(0);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tint.border,
          // `bg-white` was hardcoded here, which turned the button into a white
          // block on the dark canvas.
          backgroundColor: c.card,
        },
        style,
      ]}
      className="items-center justify-center"
    >
      <List size={21} strokeWidth={2.2} color={brand[600]} />
    </AnimatedPressable>
  );
}
