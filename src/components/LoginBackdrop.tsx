import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

// Built from plain Views + expo-linear-gradient rather than SVG, so no extra
// native module is needed — a JS reload is enough to see changes.
//
// A wave crest here is a very wide, shallow box with an enormous top corner
// radius. Because the box is far wider than it is tall, the radius resolves to
// an ELLIPTICAL curve rather than a semicircle — that difference is what makes
// it read as a wave instead of a bubble. Each layer is filled with a gradient
// (clipped by `overflow: hidden`) so it has depth instead of looking like flat
// poster paint.

interface WaveProps {
  /** How much wider than the screen the box is (2.4 = 240%). */
  spread: number;
  /** Horizontal nudge as a fraction of screen width — moves the crest. */
  shift: number;
  /** Distance from the bottom of the screen, in px (negative = sunk). */
  bottom: number;
  /** Crest height. Keep well under the width or it turns into a dome. */
  height: number;
  /** Gradient stops, light end first. */
  colors: readonly [string, string];
  /** Slight tilt so the crest is asymmetric, like a real swell. */
  rotate: number;
  delay: number;
  travel: number;
}

function Wave({
  spread,
  shift,
  bottom,
  height,
  colors,
  rotate,
  delay,
  travel,
}: WaveProps) {
  const { width } = useWindowDimensions();
  const boxWidth = width * spread;

  // Starts below its resting position and eases up. Layers are staggered so
  // they arrive one after another instead of as a single moving block.
  const offset = useSharedValue(1);

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withTiming(0, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, offset]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - offset.value,
    transform: [
      { translateY: offset.value * travel },
      { rotateZ: `${rotate}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom,
          left: -(boxWidth - width) / 2 + width * shift,
          width: boxWidth,
          height,
          // Radius bigger than the box clamps to the widest curve that fits —
          // with a wide, short box that is a long elliptical arc.
          borderTopLeftRadius: boxWidth,
          borderTopRightRadius: boxWidth,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** Soft out-of-focus dot. Adds depth without competing with the waves. */
function Bubble({
  size,
  left,
  bottom,
  color,
  delay,
}: {
  size: number;
  left: number;
  bottom: number;
  color: string;
  delay: number;
}) {
  const rise = useSharedValue(1);

  useEffect(() => {
    rise.value = withDelay(
      delay,
      withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, rise]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - rise.value) * 0.5,
    transform: [{ translateY: rise.value * 40 }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          bottom,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Decorative wave field anchored to the bottom of the login screen. Purely
 * ornamental — `pointerEvents="none"` on the wrapper keeps every tap going
 * through to the form underneath.
 */
export function LoginBackdrop() {
  const { brand } = useTheme();
  const { width, height } = useWindowDimensions();
  const fieldHeight = Math.min(height * 0.4, 340);

  const wash = useSharedValue(0);
  useEffect(() => {
    wash.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) });
  }, [wash]);

  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));

  return (
    <View
      style={{
        // In style, not as a prop — the `pointerEvents` prop is deprecated in
        // RN 0.76+ and warns on every render.
        pointerEvents: 'none',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: fieldHeight,
        // Clipped so the over-wide, rotated crests never widen the page.
        overflow: 'hidden',
      }}
    >
      {/* Vertical wash so the field fades into the white page rather than
          starting at a hard line. */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, height: fieldHeight },
          washStyle,
        ]}
      >
        <LinearGradient
          colors={['rgba(57,169,53,0)', 'rgba(57,169,53,0.07)', 'rgba(57,169,53,0.14)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Bubble size={14} left={width * 0.16} bottom={fieldHeight * 0.62} color={brand[400]} delay={500} />
      <Bubble size={8} left={width * 0.78} bottom={fieldHeight * 0.7} color={brand[500]} delay={620} />
      <Bubble size={20} left={width * 0.86} bottom={fieldHeight * 0.5} color={brand[200]} delay={560} />

      {/* Back → front: palest and tallest first, most saturated last. Opposite
          `shift` and `rotate` values keep the crests from stacking into one
          thick dome. */}
      <Wave
        spread={2.6}
        shift={-0.2}
        bottom={-24}
        height={132}
        colors={[brand[100], brand[200]]}
        rotate={-3}
        delay={0}
        travel={95}
      />
      <Wave
        spread={2.3}
        shift={0.24}
        bottom={-44}
        height={116}
        colors={[brand[300], brand[400]]}
        rotate={2.5}
        delay={120}
        travel={85}
      />
      <Wave
        spread={2.9}
        shift={-0.06}
        bottom={-66}
        height={104}
        colors={[brand[500], brand[700]]}
        rotate={-1.5}
        delay={240}
        travel={75}
      />
    </View>
  );
}
