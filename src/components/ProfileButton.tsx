import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Avatar, fullNameOf } from './Avatar';
import type { AuthUser } from '../store/tokenStorage';
import { success } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Header avatar button — the way into the profile screen.
 *
 * Circular, unlike the rounded-square bell beside it: an avatar reads as a
 * person, and a photo cropped into a squircle next to an icon button reads as
 * another icon. The press feedback is the same 0.93 scale the bell uses, so the
 * pair still behaves as one control group.
 *
 * The duty dot repeats what the attendance card already says, but at the top of
 * the screen where it is visible before any scrolling.
 */
export function ProfileButton({
  user,
  onPress,
  onDuty = false,
}: {
  user?: AuthUser | null;
  onPress: () => void;
  /** Clocked in right now — shows the green presence dot. */
  onDuty?: boolean;
}) {
  const { c, primary } = useTheme();

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
      accessibilityLabel={`Profile, ${fullNameOf(user)}`}
      hitSlop={8}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: primary.border,
          backgroundColor: c.card,
        },
        style,
      ]}
      className="items-center justify-center"
    >
      <Avatar user={user} size={36} />

      {onDuty ? (
        // Bordered in the canvas colour so the dot stays legible wherever the
        // header sits — on the backdrop glow it would otherwise merge.
        <View
          style={{ backgroundColor: success[500], borderColor: c.bg }}
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
        />
      ) : null}
    </AnimatedPressable>
  );
}
