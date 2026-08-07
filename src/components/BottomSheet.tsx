import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shadow } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

const OPEN_MS = 300;
const CLOSE_MS = 210;

/** Past this fraction of its own height (or this flick speed) it dismisses. */
const DISMISS_RATIO = 0.28;
const DISMISS_VELOCITY = 950;

/**
 * Bottom sheet used by every overlay in the app, so they all open the same way.
 *
 * Why not `Modal animationType="slide"`: that animation is uninterruptible and
 * has no scrim of its own, so a drag could not follow the finger and the
 * backdrop would pop instead of fade. One shared value drives the panel offset
 * AND the scrim opacity here, which is also why they can never drift apart.
 *
 * The panel stays mounted through its exit animation (`mounted` lags `visible`)
 * — unmounting on the parent's state change would make it vanish instantly.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.86,
  avoidKeyboard = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Cap as a fraction of screen height. Content shorter than this wraps. */
  maxHeightRatio?: number;
  /**
   * Lift the panel clear of the keyboard. OPT-IN, because it is only correct
   * for a sheet that holds text inputs — a `Modal` gets no keyboard handling
   * from the OS, so a form sheet left without this has its lower fields typed
   * into blind, behind the keyboard.
   *
   * Not switched on for every sheet: the picker and confirm sheets have nothing
   * to type into, and wrapping them in a `KeyboardAvoidingView` adds a layout
   * pass that can fight the open/close transform.
   */
  avoidKeyboard?: boolean;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [mounted, setMounted] = useState(visible);
  // Panel height once laid out; the screen height is a safe first guess so the
  // very first open still starts fully off-screen.
  const [sheetHeight, setSheetHeight] = useState(height);

  // Distance below its resting position, in px. 0 = open.
  const offset = useSharedValue(height);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    if (visible) {
      offset.value = withTiming(0, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    offset.value = withTiming(
      sheetHeight,
      { duration: CLOSE_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        // Only drop the Modal once the panel is actually off-screen.
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, sheetHeight, offset]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, offset.value / Math.max(1, sheetHeight)),
  }));

  // Drag lives on the grab handle only — a pan across the whole sheet would
  // fight the list inside it for every vertical swipe.
  const drag = Gesture.Pan()
    .onChange((e) => {
      // Downward only: dragging up must not lift the sheet off its resting spot.
      offset.value = Math.max(0, offset.value + e.changeY);
    })
    .onEnd((e) => {
      const far = offset.value > sheetHeight * DISMISS_RATIO;
      const flicked = e.velocityY > DISMISS_VELOCITY;

      if (far || flicked) {
        // Hand control back to the parent; its `visible=false` runs the exit.
        runOnJS(onClose)();
        return;
      }

      // Settle back with a spring — a timing curve here reads as a snap.
      offset.value = withSpring(0, {
        damping: 20,
        stiffness: 240,
        mass: 0.6,
      });
    });

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        // `undefined` on Android: the window already resizes there, and a second
        // avoider on top of that double-counts the inset and leaves a gap.
        behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        <Animated.View
          style={[{ position: 'absolute', inset: 0, backgroundColor: c.scrim }, scrimStyle]}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            {
              maxHeight: height * maxHeightRatio,
              paddingBottom: insets.bottom + 8,
              backgroundColor: c.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              ...shadow.sheet,
            },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={drag}>
            {/* Padded so the grab area is thumb-sized, not just the 4px pill. */}
            <View className="items-center pb-1 pt-2.5" accessible={false}>
              <View
                style={{ backgroundColor: c.border }}
                className="h-1 w-10 rounded-full"
              />
            </View>
          </GestureDetector>

          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
