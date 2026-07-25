import * as Haptics from 'expo-haptics';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismiss, useToasts, type ToastItem, type ToastKind } from '../lib/toast';
import { toastPalette } from '../lib/toastTheme';

/** Fraction of screen width a swipe must cross to count as a dismiss. */
const SWIPE_RATIO = 0.26;
/** A flick past this velocity dismisses regardless of distance travelled. */
const SWIPE_VELOCITY = 650;

const ENTER_SPRING = { damping: 20, stiffness: 240, mass: 0.6 } as const;
const EXIT_MS = 170;

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

/** Distinct physical feedback per severity, so the buzz alone carries meaning. */
function tapFeedback(kind: ToastKind) {
  // Never let a missing haptic engine (simulator, some Android builds) throw
  // into the render path — the toast itself still has to appear.
  try {
    if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (kind === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.selectionAsync();
    }
  } catch {
    /* haptics unavailable — non-critical */
  }
}

function ToastRow({ item }: { item: ToastItem }) {
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const palette = useMemo(() => toastPalette(item.kind, isDark), [item.kind, isDark]);
  const Icon = ICONS[item.kind];

  // `enter` drives opacity/scale/Y together so one spring governs the whole
  // arrival rather than three animations drifting out of sync.
  const enter = useSharedValue(0);
  const translateX = useSharedValue(0);
  const leaving = useSharedValue(0);

  // Remaining fraction of the auto-dismiss window, 1 → 0. Doubles as the
  // progress bar's scale, so the bar cannot disagree with the real timer.
  const progress = useSharedValue(1);

  const remove = useCallback(() => dismiss(item.id), [item.id]);

  const close = useCallback(() => {
    cancelAnimation(progress);
    leaving.value = 1;
    enter.value = withTiming(
      0,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (done) => {
        if (done) scheduleOnRN(remove);
      },
    );
  }, [enter, leaving, progress, remove]);

  const startTimer = useCallback(
    (from: number) => {
      if (!item.duration) return; // 0 = manual dismiss only
      progress.value = withTiming(
        0,
        { duration: item.duration * from, easing: Easing.linear },
        (done) => {
          if (done && !leaving.value) scheduleOnRN(close);
        },
      );
    },
    [close, item.duration, leaving, progress],
  );

  useEffect(() => {
    tapFeedback(item.kind);
    enter.value = withSpring(1, ENTER_SPRING);
    startTimer(1);
    return () => {
      cancelAnimation(enter);
      cancelAnimation(progress);
    };
    // Runs once per toast — `item.id` is the identity, the rest is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const pause = useCallback(() => {
    cancelAnimation(progress);
  }, [progress]);

  const resume = useCallback(() => {
    if (!leaving.value) startTimer(progress.value);
  }, [leaving, progress, startTimer]);

  // Horizontal drag only: `activeOffsetX` stops the toast from stealing a
  // vertical scroll that merely began on top of it.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      scheduleOnRN(pause);
    })
    .onChange((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > width * SWIPE_RATIO;
      const flicked = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (past || flicked) {
        leaving.value = 1;
        const dir =
          e.translationX === 0 ? Math.sign(e.velocityX) : Math.sign(e.translationX);
        translateX.value = withTiming(dir * width, { duration: 160 }, (done) => {
          if (done) scheduleOnRN(remove);
        });
        enter.value = withTiming(0, { duration: 160 });
      } else {
        translateX.value = withSpring(0, ENTER_SPRING);
        scheduleOnRN(resume);
      }
    })
    .onFinalize(() => {
      scheduleOnRN(resume);
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: translateX.value },
      // -14 → 0 on the way in; the same track runs backwards on the way out.
      { translateY: (1 - enter.value) * -14 },
      { scale: 0.97 + enter.value * 0.03 },
    ],
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const a11y = `${item.kind}: ${item.message}${
    item.description ? `. ${item.description}` : ''
  }`;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ marginBottom: 8 }, cardStyle]}
        accessibilityRole="alert"
        accessibilityLiveRegion={item.kind === 'error' ? 'assertive' : 'polite'}
        accessibilityLabel={a11y}
      >
        <Pressable
          onPress={close}
          onPressIn={pause}
          onPressOut={resume}
          accessibilityRole="button"
          accessibilityHint="Tap or swipe sideways to dismiss"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: 16,
            shadowColor: palette.shadow,
            shadowOpacity: palette.shadowOpacity,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            overflow: 'hidden',
          }}
        >
          {/* Full-height accent edge. A neutral card alone was too quiet to
              register at a glance; this restores an unmistakable type signal
              for 4px of width, instead of tinting the whole surface. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: palette.accent,
            }}
          />

          {/* Bare icon — the tinted circle behind it was extra visual weight
              carrying no extra information. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingVertical: 12,
              paddingLeft: 15,
              paddingRight: 8,
            }}
          >
            <View style={{ marginTop: 1 }}>
              <Icon size={17} strokeWidth={2.2} color={palette.accent} />
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, lineHeight: 19, color: palette.title }}
                className="font-ui-semibold"
              >
                {item.message}
              </Text>
              {item.description ? (
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 12.5,
                    lineHeight: 17,
                    marginTop: 1,
                    color: palette.description,
                  }}
                  className="font-ui-regular"
                >
                  {item.description}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              android_ripple={{ color: palette.track, borderless: true, radius: 16 }}
              style={({ pressed }) => ({
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.4 : 1,
              })}
            >
              <X size={14} strokeWidth={2.3} color={palette.close} />
            </Pressable>
          </View>

          {/* Progress bar. `scaleX` with a left transform-origin animates on the
              UI thread; animating `width` would hit the layout system instead
              and drop frames. */}
          {item.duration ? (
            <View style={{ height: 2, backgroundColor: palette.track }}>
              <Animated.View
                style={[
                  {
                    height: 2,
                    width: '100%',
                    backgroundColor: palette.accent,
                    opacity: 0.85,
                    transformOrigin: 'left',
                  },
                  barStyle,
                ]}
              />
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/** Renders the live toast stack. Mount once, above the navigator. */
export function Toaster() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();

  if (!toasts.length) return null;

  return (
    <View
      // `pointerEvents="box-none"` so the area behind the stack stays tappable.
      pointerEvents="box-none"
      // Positioning stays in a plain style object, NOT utility classes: if
      // NativeWind fails to process `absolute` (stale cache, misconfigured
      // content globs) the stack silently falls back into normal flow and lands
      // at the bottom of the tree instead of floating. A style object cannot
      // regress that way.
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </View>
  );
}
