import { LinearGradient } from 'expo-linear-gradient';
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
 * The birthday ring.
 *
 * No green in it, deliberately — green already means "on duty" everywhere in
 * this app, and on THIS button most of all: the presence dot sits on the same
 * 44px circle. A green arc behind it would read as a second, louder duty
 * indicator rather than as a celebration.
 *
 * Three stops rather than two so the ring changes hue as it goes round instead
 * of fading one colour into another, which at 3px just looks like a smudge.
 */
const RING = ['#F472B6', '#FBBF24', '#F43F5E'] as const;

/** Ring thickness. The avatar keeps its 36px — the button grows the ring. */
const RING_WIDTH = 3;

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
  celebrating = false,
}: {
  user?: AuthUser | null;
  onPress: () => void;
  /** Clocked in right now — shows the green presence dot. */
  onDuty?: boolean;
  /** It is this user's birthday — swaps the hairline for the festive ring. */
  celebrating?: boolean;
}) {
  const { c, tint } = useTheme();

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
          // The ring replaces the hairline rather than sitting inside it — a
          // 1px tint border around a 3px gradient reads as a rendering seam.
          ...(celebrating
            ? null
            : { borderWidth: 1, borderColor: tint.border }),
          backgroundColor: c.card,
        },
        style,
      ]}
      className="items-center justify-center"
    >
      {/* A gradient FILL under an inset disc, not a gradient border — React
          Native has no gradient `borderColor`, and the card-coloured disc on
          top is what turns the fill back into a ring. */}
      {celebrating ? (
        <>
          <LinearGradient
            colors={RING}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', inset: 0, borderRadius: 22 }}
          />
          <View
            style={{
              position: 'absolute',
              inset: RING_WIDTH,
              borderRadius: 22 - RING_WIDTH,
              backgroundColor: c.card,
            }}
          />
        </>
      ) : null}

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
