import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CheckCircle2, ChevronLeft, KeyRound, MailCheck, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconWell } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyResetOtpMutation,
} from '../store/authApi';
import { radius, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

/** Digits in the emailed code. */
const OTP_LENGTH = 6;

/** Seconds before "Resend code" wakes up. */
const RESEND_AFTER = 45;

type Step = 'email' | 'code' | 'password';

const STEPS: { key: Step; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'code', label: 'Code' },
  { key: 'password', label: 'New password' },
];

/** Mask for display: `nitesh@company.com` → `n•••••h@company.com`. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0]}•@${domain}`;
  return `${name[0]}${'•'.repeat(Math.min(5, name.length - 2))}${name[name.length - 1]}@${domain}`;
}

/**
 * Password rules, as a checklist rather than a paragraph.
 *
 * Shown live while typing: a rule you can watch turn green is a rule you can
 * satisfy on the first try, where "Password must contain…" after a failed
 * submit is a rule you satisfy on the third.
 */
const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
];

/* ── Step rail ────────────────────────────────────────────────────────────── */

function StepRail({ step }: { step: Step }) {
  const { c, brand } = useTheme();
  const index = STEPS.findIndex((s) => s.key === step);

  return (
    <View className="flex-row" style={{ gap: space.sm }}>
      {STEPS.map((s, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <View key={s.key} className="flex-1">
            <View
              style={{
                height: 4,
                borderRadius: 999,
                backgroundColor: done || active ? brand[600] : c.fill,
              }}
            />
            <Text
              style={{ color: active ? brand[600] : c.textFaint }}
              className={`mt-1.5 ${T.nano}`}
              allowFontScaling={false}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ── OTP boxes ────────────────────────────────────────────────────────────── */

/**
 * Six boxes over ONE hidden input.
 *
 * Six real inputs with focus-hopping is the usual approach and it is the one
 * that breaks: paste fills only the first box, backspace at an empty box goes
 * nowhere, and autofill from the SMS/email suggestion bar has nothing to
 * target. A single field with the boxes drawn over it gets paste, autofill and
 * backspace for free.
 */
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const { c, brand } = useTheme();
  const ref = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel="Enter the verification code"
    >
      <View className="flex-row" style={{ gap: space.sm }}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const char = value[i] ?? '';
          const isCursor = i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 56,
                backgroundColor: c.fill,
                borderRadius: radius.well,
                borderWidth: 1.5,
                borderColor: char || isCursor ? brand[600] : 'transparent',
                opacity: disabled ? 0.6 : 1,
              }}
              className="items-center justify-center"
            >
              <Text style={{ color: c.text }} className={T.kpiSm} allowFontScaling={false}>
                {char}
              </Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        editable={!disabled}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        // Off-screen rather than opacity:0 — a zero-opacity input still shows a
        // caret on some Android skins, right in the middle of the boxes.
        style={{ position: 'absolute', opacity: 0, height: 56, width: '100%' }}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Forgot password — email a code, prove it, set a new one.
 *
 * Three steps in ONE screen rather than three routes: the flow is linear, the
 * back button has to mean "previous step" rather than "abandon", and every step
 * needs the email the first one collected.
 *
 * ⚠ The three endpoints this calls are declared in `authApi.ts` as
 * `RESET_ROUTES` and their paths are NOT yet confirmed against this backend.
 * A 404 surfaces as a plain message here rather than as a silent dead end.
 */
export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();

  const [step, setStep] = useState<Step>('email');
  // Prefilled from the login form — retyping an address you just typed is the
  // most avoidable friction in this entire flow.
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [requestCode, { isLoading: requesting }] = useForgotPasswordMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyResetOtpMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();

  /* Resend cooldown. One interval, cleared on unmount. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const rulesPassed = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const passwordOk = rulesPassed.every(Boolean);
  const match = password.length > 0 && password === confirm;

  const send = async () => {
    setError(null);
    if (!emailValid) {
      setError('Enter the email you sign in with.');
      return;
    }
    try {
      const res = await requestCode({ email: email.trim().toLowerCase() }).unwrap();
      setCooldown(RESEND_AFTER);
      setStep('code');
      toast.success(res.message);
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  const verify = async () => {
    setError(null);
    if (otp.length !== OTP_LENGTH) {
      setError(`The code is ${OTP_LENGTH} digits.`);
      return;
    }
    try {
      const res = await verifyOtp({ email: email.trim().toLowerCase(), otp }).unwrap();
      setResetToken(res?.reset_token);
      setStep('password');
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  const submit = async () => {
    setError(null);
    if (!passwordOk) {
      setError('Your new password does not meet the rules below.');
      return;
    }
    if (!match) {
      setError('The two passwords do not match.');
      return;
    }
    try {
      // Both credentials go up; whichever the server reads, the other is
      // ignored — see `ResetPasswordRequest`.
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp,
        reset_token: resetToken,
        password,
      }).unwrap();
      toast.success('Password updated. Sign in with the new one.');
      navigation.goBack();
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  const back = () => {
    setError(null);
    if (step === 'password') setStep('code');
    else if (step === 'code') setStep('email');
    else navigation.goBack();
  };

  const busy = requesting || verifying || resetting;

  const fieldStyle = {
    backgroundColor: c.fill,
    borderRadius: radius.input,
    height: 52,
    paddingHorizontal: space.lg,
  } as const;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.lg,
        }}
        className="flex-row items-center gap-3"
      >
        <Pressable
          onPress={back}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={step === 'email' ? 'Back to sign in' : 'Previous step'}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} strokeWidth={2.2} color={c.text} />
        </Pressable>

        <Text style={{ color: c.text }} className={`flex-1 ${T.section}`} numberOfLines={1}>
          Reset password
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: insets.bottom + space.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepRail step={step} />

          <View style={{ marginTop: space.xxl }} className="items-center">
            <IconWell tone={step === 'password' ? surface.success : surface.info} size={60} round>
              {step === 'email' ? (
                <MailCheck size={26} strokeWidth={2} color={surface.info.tint} />
              ) : step === 'code' ? (
                <ShieldCheck size={26} strokeWidth={2} color={surface.info.tint} />
              ) : (
                <KeyRound size={26} strokeWidth={2} color={surface.success.tint} />
              )}
            </IconWell>

            <Text style={{ color: c.text }} className={`mt-4 text-center ${T.cardTitle}`}>
              {step === 'email'
                ? 'What email do you sign in with?'
                : step === 'code'
                  ? 'Enter the code we sent'
                  : 'Set a new password'}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-1.5 text-center leading-5 ${T.secondary}`}
            >
              {step === 'email'
                ? "We'll email you a 6-digit code. It works for a few minutes only."
                : step === 'code'
                  ? `Sent to ${maskEmail(email.trim())}. Check spam if it is not in the inbox.`
                  : 'Choose something you have not used here before.'}
            </Text>
          </View>

          {/* ── Step body ────────────────────────────────────────────────── */}
          <View style={{ marginTop: space.xxl, gap: space.lg }}>
            {step === 'email' ? (
              <View>
                <Text style={{ color: c.textMuted }} className={T.label}>
                  Work email
                </Text>
                <View style={{ ...fieldStyle, marginTop: 6 }} className="justify-center">
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    editable={!busy}
                    placeholder="you@company.com"
                    placeholderTextColor={c.textFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    onSubmitEditing={send}
                    returnKeyType="send"
                    style={{ color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14.5 }}
                    accessibilityLabel="Work email"
                  />
                </View>
              </View>
            ) : null}

            {step === 'code' ? (
              <>
                <OtpInput value={otp} onChange={setOtp} disabled={busy} />

                <Pressable
                  onPress={cooldown > 0 || busy ? undefined : send}
                  disabled={cooldown > 0 || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Resend the code"
                  accessibilityState={{ disabled: cooldown > 0 || busy }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  className="self-center py-1"
                >
                  <Text
                    style={{ color: cooldown > 0 ? c.textFaint : brand[600] }}
                    className={T.buttonSm}
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <View>
                  <Text style={{ color: c.textMuted }} className={T.label}>
                    New password
                  </Text>
                  <View
                    style={{ ...fieldStyle, marginTop: 6 }}
                    className="flex-row items-center gap-2"
                  >
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      editable={!busy}
                      placeholder="New password"
                      placeholderTextColor={c.textFaint}
                      secureTextEntry={!show}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      style={{
                        flex: 1,
                        color: c.text,
                        fontFamily: 'Outfit_500Medium',
                        fontSize: 14.5,
                      }}
                      accessibilityLabel="New password"
                    />
                    <Pressable
                      onPress={() => setShow((s) => !s)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={show ? 'Hide password' : 'Show password'}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={{ color: brand[600] }} className={T.badge}>
                        {show ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View>
                  <Text style={{ color: c.textMuted }} className={T.label}>
                    Confirm password
                  </Text>
                  <View
                    style={{
                      ...fieldStyle,
                      marginTop: 6,
                      borderWidth: 1,
                      borderColor:
                        confirm.length > 0 && !match ? surface.danger.tint : 'transparent',
                    }}
                    className="justify-center"
                  >
                    <TextInput
                      value={confirm}
                      onChangeText={setConfirm}
                      editable={!busy}
                      placeholder="Type it again"
                      placeholderTextColor={c.textFaint}
                      secureTextEntry={!show}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      onSubmitEditing={submit}
                      returnKeyType="go"
                      style={{ color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14.5 }}
                      accessibilityLabel="Confirm password"
                    />
                  </View>
                </View>

                {/* Live checklist — green as you go, not red after you fail. */}
                <View
                  style={{
                    backgroundColor: dark ? c.card : c.fill,
                    borderRadius: radius.well,
                    padding: space.md,
                    gap: 6,
                  }}
                >
                  {RULES.map((r, i) => {
                    const ok = rulesPassed[i];
                    return (
                      <View key={r.label} className="flex-row items-center gap-2">
                        <CheckCircle2
                          size={14}
                          strokeWidth={2.2}
                          color={ok ? surface.success.tint : c.textFaint}
                        />
                        <Text
                          style={{ color: ok ? c.text : c.textMuted }}
                          className={T.micro}
                        >
                          {r.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Errors sit where the tap happened, not in a toast that flies by
                while the user is still reading the form. */}
            {error ? (
              <View
                style={{
                  backgroundColor: dark ? 'rgba(239,68,68,0.14)' : surface.danger.bg,
                  borderRadius: radius.well,
                  padding: space.md,
                }}
              >
                <Text style={{ color: surface.danger.text }} className={T.secondary}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              label={
                step === 'email'
                  ? 'Send code'
                  : step === 'code'
                    ? 'Verify code'
                    : 'Update password'
              }
              loading={busy}
              disabled={
                step === 'email'
                  ? !emailValid
                  : step === 'code'
                    ? otp.length !== OTP_LENGTH
                    : !passwordOk || !match
              }
              onPress={step === 'email' ? send : step === 'code' ? verify : submit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
