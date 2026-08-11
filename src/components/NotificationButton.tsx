import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useGetUnreadCountQuery } from "../store/notificationApi";
import { danger, radius } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Header bell with an unread badge.
 *
 * The count comes from the notifications list meta (`GET /notifications?limit=1`)
 * and is refetched on focus/reconnect, so coming back to the app shows a current
 * badge instead of whatever was true when the screen first mounted.
 */
export function NotificationButton({
  onPress,
  onDark = false,
}: {
  onPress: () => void;
  /** Sitting on a dark/gradient header — inverts the button's own colours. */
  onDark?: boolean;
}) {
  const { c } = useTheme();
  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.07 }],
  }));
  const to = (v: number) =>
    withTiming(v, { duration: 130, easing: Easing.out(Easing.quad) });

  // Three digits would burst the pill; 99+ is the standard escape hatch.
  const badge = unread > 99 ? "99+" : String(unread);

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
      accessibilityLabel={
        unread ? `Notifications, ${unread} unread` : "Notifications"
      }
      hitSlop={10}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: radius.card,
          // No fill, no border. A boxed bell next to a round avatar read as two
          // unrelated controls; bare, the glyph sits on the canvas and the
          // avatar is the only object in the corner.
          backgroundColor: 'transparent',
        },
        style,
      ]}
      className="items-center justify-center"
    >
      <Bell size={22} strokeWidth={2} color={onDark ? '#ffffff' : c.text} />

      {unread > 0 ? (
        // The ring is the CANVAS colour, not white — on a white-smoke page a
        // white ring is a visible halo around the badge.
        <View
          className="absolute right-0.5 top-1 min-w-[18px] items-center justify-center rounded-full border-2 px-1"
          style={{ height: 18, backgroundColor: danger[500], borderColor: c.bg }}
        >
          <Text
            className="font-ui-semibold text-[9px] text-white"
            allowFontScaling={false}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
