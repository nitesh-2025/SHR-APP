import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { shadow } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

// The first frame of the app. It is on screen for ~200ms on a warm start and a
// couple of seconds on a cold one, so it has exactly one job: look like SHR
// while storage is read, instead of like a loading state that got stuck.
//
// It reuses the attendance hero's language — the brand/700 → brand/900 diagonal
// — because that card is the visual centre of the app and this is the frame
// immediately before it. A flat brand/700 fill with a spinner in the middle was
// indistinguishable from a crash.
//
// NOTE: this also renders BEFORE the Outfit fonts have loaded (see App.tsx), so
// the wordmark is the LOGO IMAGE, not text — an <Image> cannot swap font
// mid-boot. Only the tagline and version line are type, and both are small
// enough that the fallback→Outfit swap is not noticeable.

/** Diameter of the white logo disc. Every other measurement derives from it. */
const MARK = 112;
/** How far a ring travels before it is gone. 2.2 ≈ 246px on a 112px disc. */
const RING_MAX = 2.2;
/** One ring's full life. */
const RING_MS = 2400;
const RINGS = 3;

/**
 * One expanding ring. Emerges from the disc's edge, grows, fades out.
 *
 * The loader IS this — there is no separate spinner or bar. Three rings on a
 * staggered loop read as a heartbeat coming from the mark itself, which keeps
 * the eye on the logo instead of on a progress widget parked underneath it.
 */
function PulseRing({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);

  useEffect(() => {
    // The delay wraps the REPEAT, not the timing inside it — putting it inside
    // would re-wait on every cycle and turn a continuous pulse into three
    // rings that fire together and then pause.
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [delay, p]);

  // Ease-out on the scale + linear fade: fast off the mark, slowing as it
  // dissolves — the same curve a real ripple has. Opacity hits 0 exactly when
  // the loop resets, so the jump back to scale 1 is never visible.
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.34,
    transform: [{ scale: 1 + p.value * (RING_MAX - 1) }],
  }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'none',
          position: 'absolute',
          width: MARK,
          height: MARK,
          borderRadius: MARK / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Boot / bootstrap screen. Shown while the fonts load and the saved session is
 * read from SecureStore + AsyncStorage — i.e. before we know whether to draw
 * Login or Dashboard.
 */
export function BootSplash() {
  const { brand } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  // One entrance, two beats: the mark lands, then the words catch up. Both are
  // short — anything longer than the boot itself would ADD waiting rather than
  // cover it.
  const enter = useSharedValue(0);
  const words = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    words.value = withDelay(
      140,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
    // Starts only after the entrance has landed, or the two scales fight each
    // other on the first frames and the mark looks like it wobbles in.
    breath.value = withDelay(
      520,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [enter, words, breath]);

  // Entrance lives on the cluster so the rings inherit it; the breath lives on
  // the disc alone — a ring that also breathed would read as jitter.
  const clusterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + enter.value * 0.14 }],
  }));

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 10 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: brand[700] }}>
      {/* App-wide the bar is dark; over a deep green field the icons vanish.
          Mounted last, so it wins while the splash is up and reverts on unmount. */}
      <StatusBar style="light" />

      <LinearGradient
        colors={[brand[700], brand[800], brand[900]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Two very faint discs. Depth on a large flat fill, at an opacity low
          enough that they never read as objects on the screen. */}
      <View
        style={{
          position: 'absolute',
          top: -height * 0.12,
          right: -width * 0.28,
          width: width * 0.9,
          height: width * 0.9,
          borderRadius: width * 0.45,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -height * 0.1,
          left: -width * 0.34,
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              width: MARK,
              height: MARK,
              alignItems: 'center',
              justifyContent: 'center',
            },
            clusterStyle,
          ]}
        >
          {/* Rings first so they sit BEHIND the disc — they have to look like
              they are leaving the mark, not passing over it. */}
          {Array.from({ length: RINGS }, (_, i) => (
            <PulseRing
              key={i}
              delay={(RING_MS / RINGS) * i}
              color="rgba(255,255,255,0.55)"
            />
          ))}

          {/* Circular, not a rounded square: the logo's own artwork is a ring,
              so a squircle around it put two competing shapes on top of each
              other. The white fill is unavoidable — the mark is full-colour on
              white and would otherwise need knocking out to a flat silhouette. */}
          <Animated.View
            style={[
              {
                width: MARK,
                height: MARK,
                borderRadius: MARK / 2,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                ...shadow.floating,
              },
              discStyle,
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: MARK - 38, height: MARK - 38 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="SHR"
            />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center' }, wordsStyle]}>
          {/* Clear of the widest ring (MARK × 2.2 → 123px of overshoot), so the
              pulse never crosses the type. */}
          <Text
            className={`${T.secondary} text-center`}
            style={{
              marginTop: 96,
              color: 'rgba(255,255,255,0.78)',
              letterSpacing: 0.4,
            }}
            allowFontScaling={false}
          >
            Attendance · Leave · Team
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          { alignItems: 'center', paddingBottom: insets.bottom + 20 },
          wordsStyle,
        ]}
      >
        <Text
          className={T.caption}
          style={{ color: 'rgba(255,255,255,0.45)' }}
          allowFontScaling={false}
        >
          v{version}
        </Text>
      </Animated.View>
    </View>
  );
}
