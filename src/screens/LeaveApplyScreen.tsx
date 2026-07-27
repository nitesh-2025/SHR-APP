import { useNavigation } from '@react-navigation/native';
import { AlertCircle, Check, Send } from 'lucide-react-native';
import { useState } from 'react';
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

import { DateField } from '../components/DateField';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import {
  useApplyLeaveMutation,
  useGetMyBalanceQuery,
  LEAVE_TYPES,
  type LeaveType,
} from '../store/leaveApi';
import { radius, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { daysBetween, parseYmd, ymd } from '../utils/date';

const TYPE_LABEL: Record<LeaveType, string> = {
  sl: 'Sick / Emergency',
  el: 'Earned',
  unpaid: 'Unpaid',
};

/** Field wrapper — label above, filled control below, validation underneath. */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: c.textMuted }} className="font-ui-semibold text-[13px]">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text style={{ color: c.textFaint }} className="font-ui-regular text-[11.5px]">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Leave application. A pushed screen, not a sheet — it carries a date picker
 * and a multi-line field, both of which want the whole viewport, and a picker
 * modal inside a sheet modal is the one combination Android mishandles.
 */
export default function LeaveApplyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();

  const today = ymd(new Date());
  const [type, setType] = useState<LeaveType>('sl');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const balance = useGetMyBalanceQuery();
  const [applyLeave, { isLoading }] = useApplyLeaveMutation();

  // A half day is by definition a single date, so the range collapses and the
  // end-date field goes away rather than contradicting the toggle.
  const days = halfDay ? 0.5 : daysBetween(from, to);
  const available = type === 'unpaid' ? null : (balance.data?.[type]?.available ?? 0);
  const short = available !== null && days > available;

  const onSubmit = async () => {
    setError('');

    if (!reason.trim()) {
      setError('Please write a short reason for this leave.');
      return;
    }
    if (!halfDay && parseYmd(to)! < parseYmd(from)!) {
      setError('The end date cannot be before the start date.');
      return;
    }
    if (short) {
      setError(
        `You have ${available} day(s) of ${TYPE_LABEL[type]} left, but requested ${days}.`,
      );
      return;
    }

    try {
      await applyLeave({
        type,
        from_date: from,
        to_date: halfDay ? from : to,
        half_day: halfDay,
        reason: reason.trim(),
      }).unwrap();
      toast.success('Leave applied', 'Your request is pending approval.');
      navigation.goBack();
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Apply for Leave"
        subtitle={`${days} ${days === 1 ? 'day' : 'days'} selected`}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: insets.bottom + 120,
            gap: space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View
              style={{ backgroundColor: surface.danger.bg, borderRadius: radius.card }}
              className="flex-row items-start gap-2.5 px-4 py-3"
            >
              <AlertCircle size={17} strokeWidth={2} color={surface.danger.tint} />
              <Text
                style={{ color: surface.danger.text }}
                className="flex-1 font-ui text-[13px] leading-5"
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* ── Type ─────────────────────────────────────────────────────── */}
          <Field
            label="Leave type"
            hint={available !== null ? `${available} day(s) available in this bucket.` : undefined}
          >
            <View className="flex-row" style={{ gap: space.sm }}>
              {LEAVE_TYPES.map((t) => {
                const active = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 46,
                      borderRadius: radius.input,
                      backgroundColor: active ? brand[600] : c.card,
                      borderWidth: dark || active ? 0 : 1,
                      borderColor: c.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                    className="items-center justify-center px-2"
                  >
                    <Text
                      style={{ color: active ? '#FFFFFF' : c.textMuted }}
                      className="font-ui-semibold text-[12.5px]"
                      numberOfLines={1}
                    >
                      {TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {/* ── Dates ────────────────────────────────────────────────────── */}
          <View className="flex-row" style={{ gap: space.md }}>
            <DateField
              label={halfDay ? 'Date' : 'From'}
              value={from}
              onChange={(next) => {
                setFrom(next);
                // Keep the range valid without making the user fix it by hand.
                if (parseYmd(to)! < parseYmd(next)!) setTo(next);
              }}
            />
            {halfDay ? null : (
              <DateField label="To" value={to} onChange={setTo} min={from} />
            )}
          </View>

          {/* ── Half day ─────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => setHalfDay((h) => !h)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: halfDay }}
            accessibilityLabel="Half day"
          >
            <Card style={{ padding: space.lg }}>
              <View className="flex-row items-center" style={{ gap: space.md }}>
                <View
                  style={{
                    backgroundColor: halfDay ? brand[600] : 'transparent',
                    borderColor: halfDay ? brand[600] : c.border,
                  }}
                  className="h-[22px] w-[22px] items-center justify-center rounded-md border-2"
                >
                  {halfDay ? <Check size={13} strokeWidth={3} color="#FFFFFF" /> : null}
                </View>
                <View className="flex-1">
                  <Text style={{ color: c.text }} className="font-ui-semibold text-[14px]">
                    Half day
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className="font-ui-regular text-[12px]"
                  >
                    Counts as 0.5 against your balance.
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>

          {/* ── Reason ───────────────────────────────────────────────────── */}
          <Field label="Reason">
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why do you need this leave?"
              placeholderTextColor={c.textFaint}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 110,
                backgroundColor: c.card,
                borderRadius: radius.input,
                borderWidth: dark ? 0 : 1,
                borderColor: c.border,
                color: c.text,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
              }}
              className="font-ui text-[14px]"
            />
          </Field>

          <Text
            style={{ color: c.textFaint }}
            className="font-ui-regular text-[11.5px] leading-4"
          >
            Your request goes to your reporting manager for approval. You can
            withdraw it from My Leave while it is still pending.
          </Text>
        </ScrollView>

        {/* Sticky CTA — the submit button never scrolls out of reach. */}
        <View
          style={{
            paddingHorizontal: space.screen,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            backgroundColor: c.bg,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <Button
            label={isLoading ? 'Submitting…' : 'Submit request'}
            icon={<Send size={18} strokeWidth={2} color="#FFFFFF" />}
            loading={isLoading}
            onPress={onSubmit}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
