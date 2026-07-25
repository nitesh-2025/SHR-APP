import { List } from "lucide-react-native";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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
          shadowColor: "#1f6b1f",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
      className="items-center justify-center border border-brand-100 bg-white"
    >
      <List size={21} strokeWidth={2.2} color="#2f8f2c" />
    </AnimatedPressable>
  );
}
