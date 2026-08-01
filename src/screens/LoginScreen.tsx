import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoginBackdrop } from "../components/LoginBackdrop";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { API_BASE_URL, TERMS_URL } from "../config/env";
import { toast } from "../lib/toast";
import { useAppDispatch } from "../store";
import { useLoginMutation } from "../store/authApi";
import { setCredentials } from "../store/authSlice";
import { normalizeAuthUser } from "../store/normalizeUser";
import {
  clearRememberedEmail,
  readRememberedEmail,
  saveRememberedEmail,
} from "../store/tokenStorage";
import { neutral } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import {
  DEVICE_LABEL,
  detectDeviceType,
  isDeviceAllowed,
} from "../utils/device";

/** Width of the travelling highlight, as a fraction of the button width. */
const WAVE_WIDTH = 0.45;

/**
 * Turn an RTK Query rejection into a message that says what actually broke.
 * Previously every failure collapsed to "Invalid email or password", which hid
 * unreachable-server and bad-response cases behind a credentials error.
 */
function describeLoginError(err: unknown): string {
  const e = err as {
    status?: number | string;
    error?: string;
    data?: { message?: string };
  };

  // Server answered — prefer its own message (e.g. 401 "Invalid email or password").
  if (e?.data?.message) return e.data.message;

  switch (e?.status) {
    case "FETCH_ERROR":
      return `Server se connect nahi ho paya (${API_BASE_URL || "BASE_URL set nahi hai"}). Internet aur EXPO_PUBLIC_BASE_URL check karein.`;
    case "TIMEOUT_ERROR":
      return "Server ne time par jawab nahi diya. Dobara try karein.";
    case "PARSING_ERROR":
      return "Server ne unexpected response bheja (JSON nahi). URL galat ho sakta hai.";
    default:
      break;
  }

  if (typeof e?.status === "number") {
    return `Login fail hua — server ne ${e.status} bheja.`;
  }
  return "Login fail hua. Dobara try karein.";
}

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { brand } = useTheme();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [error, setError] = useState("");

  // Pre-fill from the last "remember me" sign-in. A stored address also implies
  // the box was ticked, so the toggle restores itself in the same pass.
  useEffect(() => {
    let alive = true;
    readRememberedEmail().then((saved) => {
      if (!alive || !saved) return;
      setEmail(saved);
      setRemember(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // No manual navigation on success: the root navigator swaps stacks off the
  // `isAuthenticated` selector, exactly like <ProtectedRoute> did on web.
  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    const trimmed = email.trim();
    try {
      const data = await login({ email: trimmed, password }).unwrap();

      // The login payload carries the populated document (role / department as
      // objects) exactly like /users/me — flatten it before it reaches state,
      // otherwise `user.role` is an object and every RBAC check misses.
      const user = normalizeAuthUser(data.user);

      // Device allow-list gate — block sign-in from a device class this user
      // isn't permitted to use. No token is stored, so they stay logged out.
      if (!isDeviceAllowed(user?.allowed_devices)) {
        setError(
          `Is device (${DEVICE_LABEL[detectDeviceType()]}) se login allowed nahi hai. Apne admin se sampark karein.`,
        );
        return;
      }

      // Persist the choice only after the credentials are known good, so a
      // typo'd address never gets remembered.
      await (remember ? saveRememberedEmail(trimmed) : clearRememberedEmail());

      await dispatch(
        setCredentials({
          user,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }),
      ).unwrap();
      toast.success("Welcome back!");
    } catch (err: unknown) {
      // Inline only — the message belongs next to the form it describes, and a
      // toast saying the same thing at the same moment just doubles the noise.
      setError(describeLoginError(err));
    }
  };

  // ── Idle wave on the Sign in button ──────────────────────────────────────
  // A soft highlight sweeps left → right on a loop as soon as the screen opens.
  // `false` (not reversed) on withRepeat keeps it travelling one way, so it
  // reads as a wave rather than a ball bouncing between the edges.
  const wave = useSharedValue(0);
  const [buttonWidth, setButtonWidth] = useState(0);

  useEffect(() => {
    // Nothing to travel across until the button has been measured, and the
    // sweep is hidden during loading so the spinner is the only motion.
    if (!buttonWidth || isLoading) {
      cancelAnimation(wave);
      wave.value = 0;
      return;
    }
    wave.value = 0;
    wave.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
    return () => cancelAnimation(wave);
  }, [buttonWidth, isLoading, wave]);

  const waveStyle = useAnimatedStyle(() => {
    const band = buttonWidth * WAVE_WIDTH;
    return {
      // Starts fully off the left edge, ends fully off the right edge.
      transform: [
        { translateX: interpolate(wave.value, [0, 1], [-band, buttonWidth]) },
      ],
    };
  });

  // Focus is shown with a green border + tinted ring. Standard, and it survives
  // on any screen — unlike shadow-only affordances, which vanish in sunlight.
  const fieldClass = "h-14 flex-row items-center rounded-2xl border bg-white px-4";
  const fieldBorder = (which: "email" | "password") => ({
    borderColor: focused === which ? brand[500] : neutral[200],
  });

  const openTerms = async () => {
    if (!TERMS_URL) {
      toast.info("Terms & Conditions link abhi configure nahi hua hai.");
      return;
    }
    // `openURL` rejects when no app can handle the scheme — surface that rather
    // than letting the tap look like it did nothing.
    try {
      await Linking.openURL(TERMS_URL);
    } catch {
      toast.error("Terms page open nahi ho paya.");
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Behind everything, and non-interactive — taps pass through to the form. */}
      <LoginBackdrop />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ─────────────────────────────────────────────────────── */}
          <View className="items-center pb-10">
            <Image
              source={require("../../assets/logo.png")}
              style={{ width: 200, height: 180 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="SHR"
            />
          </View>

          {/* ── Heading ──────────────────────────────────────────────────── */}
          <Text className="font-display text-center text-[26px] leading-8 text-slate-900">
            Welcome back
          </Text>
          <Text className="mt-1.5 text-center font-ui-regular text-sm leading-5 text-slate-500">
            Sign in to your account to continue.
          </Text>

          {error ? (
            // Errors use the orange accent, not a fourth red — the palette is
            // three hues and this is still "attention", not a new category.
            <View className="mt-5 flex-row rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3.5">
              <View className="mr-3 mt-0.5 h-4 w-4 items-center justify-center rounded-full bg-accent-500">
                <Text
                  className="font-display text-[10px] leading-[13px] text-white"
                  allowFontScaling={false}
                >
                  !
                </Text>
              </View>
              <Text className="flex-1 font-ui text-[13px] leading-5 text-accent-700">
                {error}
              </Text>
            </View>
          ) : null}

          {/* ── Email ────────────────────────────────────────────────────── */}
          <Text className="mb-2 mt-7 font-ui-semibold text-[13px] text-slate-700">
            Email
          </Text>
          <View className={fieldClass} style={fieldBorder("email")}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              placeholder="Enter your email"
              placeholderTextColor={neutral[400]}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              className="h-full flex-1 font-ui text-[15px] text-slate-900"
            />
          </View>

          {/* ── Password ─────────────────────────────────────────────────── */}
          <Text className="mb-2 mt-5 font-ui-semibold text-[13px] text-slate-700">
            Password
          </Text>
          <View className={fieldClass} style={fieldBorder("password")}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              placeholder="Enter your password"
              placeholderTextColor={neutral[400]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              className="h-full flex-1 font-ui text-[15px] text-slate-900"
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
            >
              <Text
                style={{ color: brand[600] }}
                className="font-ui-semibold text-[12px]"
              >
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>

          {/* ── Remember me ──────────────────────────────────────────────── */}
          {/* The whole row is the target, not just the 22px box — a checkbox
              alone is well under the 44px minimum touch size. */}
          <Pressable
            onPress={() => setRemember((r) => !r)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel="Remember my email"
            hitSlop={6}
            className="mt-5 flex-row items-center self-start py-1.5 pr-3"
          >
            <View
              style={{
                backgroundColor: remember ? brand[600] : "#ffffff",
                borderColor: remember ? brand[600] : neutral[300],
              }}
              className="h-[22px] w-[22px] items-center justify-center rounded-md border-2"
            >
              {remember ? (
                <Text
                  className="font-display text-[12px] leading-[15px] text-white"
                  allowFontScaling={false}
                >
                  ✓
                </Text>
              ) : null}
            </View>
            <Text className="ml-2.5 font-ui text-[13px] text-slate-600">
              Remember me
            </Text>
          </Pressable>

          {/* ── Forgot password ──────────────────────────────────────────
              Right under the field it is about, and it carries the email
              already typed — nobody should have to retype an address to prove
              they cannot remember its password. */}
          <Pressable
            onPress={() =>
              navigation.navigate("ForgotPassword", { email: email.trim() || undefined })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Forgot your password"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="mt-3 self-start py-1"
          >
            <Text
              style={{ color: brand[600] }}
              className="font-ui-semibold text-[13px]"
            >
              Forgot password?
            </Text>
          </Pressable>

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            onLayout={(e) => setButtonWidth(e.nativeEvent.layout.width)}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
            style={{ height: 54, backgroundColor: brand[600] }}
            className={`mt-7 flex-row items-center justify-center gap-2 rounded-2xl ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            {/* Clip layer for the wave. `overflow-hidden` lives here rather than
                on the Pressable so it can't clip the Android elevation shadow.
                Not tappable, so it never steals the press. */}
            <View
              style={{ pointerEvents: "none" }}
              className="absolute inset-0 overflow-hidden rounded-2xl"
            >
              <Animated.View
                style={[
                  { width: buttonWidth * WAVE_WIDTH, height: "100%" },
                  waveStyle,
                ]}
              >
                {/* Transparent → light → transparent, so the highlight has soft
                    edges instead of a hard moving rectangle. */}
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0)",
                    "rgba(255,255,255,0.28)",
                    "rgba(255,255,255,0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </View>

            {isLoading ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text className="font-ui-semibold text-[15px] text-white">
              {isLoading ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>

          <Text className="mt-6 text-center font-ui-regular text-xs leading-4 text-slate-400">
            Trouble signing in? Please contact your HR admin.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
