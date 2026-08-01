import { useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEventName } from "react-native";

/**
 * Height of the on-screen keyboard in dp (0 when closed) plus the duration the
 * system is animating it for.
 *
 * Why not `KeyboardAvoidingView` with `behavior={undefined}`: since Expo SDK 53
 * Android draws edge-to-edge, and edge-to-edge turns
 * `android:windowSoftInputMode="adjustResize"` into a no-op — the window no
 * longer shrinks when the IME opens, so a composer pinned to the bottom is
 * simply covered by the keyboard. Nothing moves it unless we move it.
 *
 * The height reported here is measured from the bottom of the SCREEN, so it
 * already contains the navigation-bar / home-indicator inset. A caller that
 * also pads for `insets.bottom` must subtract it, or the composer floats a
 * nav-bar's worth of empty space above the keys.
 */
export function useKeyboardHeight(): { height: number; duration: number } {
  const [height, setHeight] = useState(0);
  const [duration, setDuration] = useState(220);

  useEffect(() => {
    // iOS fires `will*` BEFORE the keyboard animates, so the UI can travel with
    // it rather than snapping into place afterwards. Android only has `did*`.
    const showEvent: KeyboardEventName =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent: KeyboardEventName =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) => {
      if (e.duration) setDuration(e.duration);
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, (e) => {
      if (e?.duration) setDuration(e.duration);
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { height, duration };
}
