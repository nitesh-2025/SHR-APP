import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  CalendarRange,
  Check,
  HeartPulse,
  Send,
  Sparkles,
  TreePalm,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { DateField } from '../components/DateField';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import {
  useApplyLeaveMutation,
  useGetMyBalanceQuery,
  LEAVE_TYPES,
  type LeaveType,
} from '../store/leaveApi';
import { radius, shadow, space, surface, toneFor } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { daysBetween, fmtDayShort, parseYmd, ymd } from '../utils/date';

/* ── Leave types ──────────────────────────────────────────────────────────── */

/**
 * The three buckets, as rows rather than as a segmented strip.
 *
 * "Sick / Emergency" is 16 characters; three of those across a 360 dp screen
 * left each pill ~104 px wide and every label truncated to "Sick / Emer…". A
 * row has the width to say what the bucket IS, and — more usefully — what is
 * left in it, which is the number that decides which one you pick.
 */
const TYPES: {
  key: LeaveType;
  label: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  {
    key: 'sl',
    label: 'Sick / Emergency',
    blurb: 'Unwell, or something urgent came up',
    icon: HeartPulse,
  },
  {
    key: 'el',
    label: 'Earned',
    blurb: 'Planned time off from your accrued days',
    icon: TreePalm,
  },
  {
    key: 'unpaid',
    label: 'Unpaid',
    blurb: 'Beyond your balance — deducted from salary',
    icon: Wallet,
  },
];

/** Openers, not answers — a tap fills the box and the cursor carries on. */
const PROMPTS: Record<LeaveType, string[]> = {
  sl: ['Not well — fever', 'Doctor appointment', 'Family emergency'],
  el: ['Personal work', 'Family function', 'Travelling'],
  unpaid: ['Personal work', 'Extended travel', 'Family commitment'],
};

const REASON_MAX = 300;

/* ── Hero ─────────────────────────────────────────────────────────────────── */

/**
 * Concentric arcs sweeping out of the card's corner — the same ornament the
 * profile identity card carries, so the two filled cards in the app read as one
 * family. Drawn in white at low opacity: on a deep green fill it registers as
 * texture, never as a second object competing with the number.
 */
function HeroArt({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <Svg width={width} height={height}>
        {[0.42, 0.6, 0.8].map((r, i) => (
          <Circle
            key={r}
            cx={width * 0.92}
            cy={height * 0.9}
            r={width * r}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.2}
            strokeOpacity={0.2 - i * 0.05}
          />
        ))}
        {/* A single horizon curve across the lower third. It is what stops the
            card from reading as a plain gradient rectangle. */}
        <Path
          d={`M0 ${height * 0.74} Q ${width * 0.3} ${height * 0.6} ${width * 0.62} ${height * 0.78} T ${width} ${height * 0.7}`}
          stroke="#FFFFFF"
          strokeOpacity={0.16}
          strokeWidth={1.4}
          fill="none"
        />
      </Svg>
    </View>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <View className="flex-row items-baseline justify-between">
        <Text style={{ color: c.text }} className={T.cardTitle}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ color: c.textMuted }} className={T.caption} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Leave application. A pushed screen, not a sheet — it carries a date picker
 * and a multi-line field, both of which want the whole viewport, and a picker
 * modal inside a sheet modal is the one combination Android mishandles.
 */
export default function LeaveApplyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark, primary } = useTheme();
  const { width } = useWindowDimensions();

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

  const heroWidth = width - space.screen * 2;
  const heroHeight = 148;

  const spanLabel = useMemo(() => {
    if (halfDay) return `${fmtDayShort(from)} · half day`;
    if (from === to) return fmtDayShort(from);
    return `${fmtDayShort(from)} → ${fmtDayShort(to)}`;
  }, [from, to, halfDay]);

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
      const label = TYPES.find((t) => t.key === type)?.label ?? type;
      setError(`You have ${available} day(s) of ${label} left, but requested ${days}.`);
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

  const danger = toneFor(surface.danger, dark);
  const warn = toneFor(surface.warning, dark);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Apply for Leave" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: insets.bottom + 130,
            gap: space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ───────────────────────────────────────────────────────
              The one filled surface on the form. It answers, at a glance, the
              only question the whole screen is asking: how many days, on which
              dates, and is that within what you have. */}
          <LinearGradient
            colors={[brand[600], brand[800]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: heroHeight,
              borderRadius: radius.card,
              paddingHorizontal: space.xl,
              justifyContent: 'center',
              overflow: 'hidden',
              ...shadow.card,
            }}
          >
            <HeroArt width={heroWidth} height={heroHeight} />

            <View className="flex-row items-center">
              <View className="flex-1 pr-3">
                <Text
                  className={`text-white/85 ${T.badge}`}
                  style={{ letterSpacing: 0.6 }}
                  allowFontScaling={false}
                >
                  YOU&apos;RE REQUESTING
                </Text>

                <View className="mt-1.5 flex-row items-baseline gap-2">
                  <Text
                    className={`text-white ${T.kpiHero}`}
                    allowFontScaling={false}
                  >
                    {days}
                  </Text>
                  <Text className={`text-white/85 ${T.cardTitle}`}>
                    {days === 1 ? 'day' : 'days'}
                  </Text>
                </View>

                <Text className={`mt-1 text-white/80 ${T.secondary}`} numberOfLines={1}>
                  {spanLabel}
                </Text>
              </View>

              {/* Balance side. `unpaid` has no bucket to draw down, and showing
                  a zero there would read as "you have none left" rather than
                  "this one is not counted". */}
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderRadius: radius.well,
                  minWidth: 92,
                }}
                className="items-center px-3 py-2.5"
              >
                {available === null ? (
                  <>
                    <Wallet size={18} strokeWidth={2} color="#FFFFFF" />
                    <Text className={`mt-1 text-center text-white/85 ${T.nano}`}>
                      Not counted{'\n'}against balance
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      className={`text-white ${T.kpiSm}`}
                      allowFontScaling={false}
                    >
                      {available}
                    </Text>
                    <Text className={`text-white/85 ${T.nano}`}>days left</Text>
                  </>
                )}
              </View>
            </View>
          </LinearGradient>

          {/* ── Errors and warnings ────────────────────────────────────────
              The shortfall warns BEFORE submit — finding out you are two days
              over only after tapping Send is a wasted round trip. */}
          {error ? (
            <View
              style={{
                backgroundColor: danger.bg,
                borderRadius: radius.well,
                borderWidth: 1,
                borderColor: danger.border,
              }}
              className="flex-row items-start gap-2.5 px-4 py-3"
            >
              <AlertCircle size={17} strokeWidth={2} color={danger.tint} />
              <Text style={{ color: danger.text }} className={`flex-1 leading-5 ${T.body}`}>
                {error}
              </Text>
            </View>
          ) : short ? (
            <View
              style={{
                backgroundColor: warn.bg,
                borderRadius: radius.well,
                borderWidth: 1,
                borderColor: warn.border,
              }}
              className="flex-row items-start gap-2.5 px-4 py-3"
            >
              <AlertCircle size={17} strokeWidth={2} color={warn.tint} />
              <Text style={{ color: warn.text }} className={`flex-1 leading-5 ${T.body}`}>
                {days} days requested but only {available} left in this bucket. Shorten
                the range, or apply as Unpaid.
              </Text>
            </View>
          ) : null}

          {/* ── Type ───────────────────────────────────────────────────────── */}
          <Field label="Leave type">
            <View style={{ gap: space.md }}>
              {LEAVE_TYPES.map((key) => {
                const spec = TYPES.find((t) => t.key === key)!;
                const Icon = spec.icon;
                const active = key === type;
                const left = key === 'unpaid' ? null : balance.data?.[key]?.available;

                return (
                  <Pressable
                    key={key}
                    onPress={() => setType(key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${spec.label}. ${
                      left == null ? 'Not counted against balance' : `${left} days left`
                    }`}
                    style={({ pressed }) => ({
                      backgroundColor: active ? primary.bg : c.card,
                      borderRadius: radius.card - 4,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? brand[600] : c.border,
                      padding: space.lg,
                      opacity: pressed ? 0.85 : 1,
                      ...(dark || active ? shadow.none : shadow.soft),
                    })}
                    className="flex-row items-center gap-3"
                  >
                    <View
                      style={{
                        backgroundColor: active ? brand[600] : c.fill,
                        borderRadius: radius.well - 2,
                      }}
                      className="h-11 w-11 items-center justify-center"
                    >
                      <Icon
                        size={20}
                        strokeWidth={2.1}
                        color={active ? '#FFFFFF' : c.textMuted}
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        style={{ color: active && !dark ? brand[700] : c.text }}
                        className={T.cardTitleSm}
                        numberOfLines={1}
                      >
                        {spec.label}
                      </Text>
                      <Text
                        style={{ color: c.textMuted }}
                        className={`mt-0.5 ${T.micro}`}
                        numberOfLines={1}
                      >
                        {left == null ? spec.blurb : `${left} day(s) available`}
                      </Text>
                    </View>

                    {/* A radio, not a checkbox — one bucket at a time. */}
                    <View
                      style={{
                        borderColor: active ? brand[600] : c.border,
                        backgroundColor: active ? brand[600] : 'transparent',
                      }}
                      className="h-[22px] w-[22px] items-center justify-center rounded-full border-2"
                    >
                      {active ? <Check size={13} strokeWidth={3} color="#FFFFFF" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {/* ── Duration ────────────────────────────────────────────────────
              A two-way switch instead of the old "Half day" checkbox: the
              choice is between two named things, and a lone checkbox made
              "full day" the unlabelled absence of the other one. */}
          <Field label="Duration">
            <View
              style={{ backgroundColor: c.fill, borderRadius: radius.input, padding: 4 }}
              className="flex-row"
              accessibilityRole="radiogroup"
            >
              {[
                { key: false, label: 'Full day', hint: 'One or more whole days' },
                { key: true, label: 'Half day', hint: 'Counts as 0.5' },
              ].map((opt) => {
                const active = halfDay === opt.key;
                return (
                  <Pressable
                    key={String(opt.key)}
                    onPress={() => setHalfDay(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label}. ${opt.hint}`}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: radius.input - 4,
                      // A white chip on a dark track is a hole punched in the
                      // surface; dark mode fills the thumb with the accent.
                      backgroundColor: active ? (dark ? brand[600] : c.card) : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                      paddingVertical: space.md,
                      ...(active && !dark ? shadow.soft : shadow.none),
                    })}
                    className="items-center"
                  >
                    <Text
                      style={{
                        color: active ? (dark ? '#FFFFFF' : c.text) : c.textMuted,
                      }}
                      className={T.cardTitleSm}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        color: active && dark ? 'rgba(255,255,255,0.8)' : c.textFaint,
                      }}
                      className={`mt-0.5 ${T.nano}`}
                    >
                      {opt.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {/* ── Dates ──────────────────────────────────────────────────────── */}
          <Field
            label={halfDay ? 'Date' : 'Dates'}
            hint={halfDay ? undefined : `${days} ${days === 1 ? 'day' : 'days'}`}
          >
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: radius.card - 4,
                borderWidth: 1,
                borderColor: c.border,
                padding: space.lg,
                ...(dark ? shadow.none : shadow.soft),
              }}
            >
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

              {halfDay ? null : (
                <View className="mt-3 flex-row items-center gap-2">
                  <CalendarRange size={13} strokeWidth={2} color={c.textFaint} />
                  <Text style={{ color: c.textFaint }} className={T.micro}>
                    Weekly offs and holidays inside the range still count as applied
                    days.
                  </Text>
                </View>
              )}
            </View>
          </Field>

          {/* ── Reason ─────────────────────────────────────────────────────── */}
          <Field
            label="Reason"
            hint={`${reason.length}/${REASON_MAX}`}
          >
            <TextInput
              value={reason}
              onChangeText={(v) => setReason(v.slice(0, REASON_MAX))}
              placeholder="A line is enough — your manager reads this first."
              placeholderTextColor={c.textFaint}
              multiline
              textAlignVertical="top"
              maxLength={REASON_MAX}
              style={{
                minHeight: 110,
                backgroundColor: c.card,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: c.border,
                color: c.text,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
              }}
              className="font-ui text-[14px]"
            />

            {/* Starters, per bucket. Typing the same three sentences every
                month is the actual friction in this form. */}
            <View className="flex-row flex-wrap" style={{ gap: space.sm }}>
              {PROMPTS[type].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setReason(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use reason: ${p}`}
                  style={({ pressed }) => ({
                    backgroundColor: c.fill,
                    borderRadius: radius.pill,
                    opacity: pressed ? 0.7 : 1,
                  })}
                  className="flex-row items-center gap-1.5 px-3 py-1.5"
                >
                  <Sparkles size={11} strokeWidth={2.4} color={c.textFaint} />
                  <Text style={{ color: c.textMuted }} className={T.badge}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Text style={{ color: c.textFaint }} className={`leading-4 ${T.micro}`}>
            Your request goes to your reporting manager for approval. You can withdraw
            it from My Leave while it is still pending.
          </Text>
        </ScrollView>

        {/* Sticky CTA — the submit button never scrolls out of reach, and it
            restates the commitment so the last thing read before tapping is
            what is actually being asked for. */}
        <View
          style={{
            paddingHorizontal: space.screen,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            backgroundColor: c.card,
            borderTopWidth: 1,
            borderTopColor: c.border,
            ...(dark ? shadow.none : shadow.floating),
          }}
        >
          <Button
            label={isLoading ? 'Submitting…' : `Submit · ${days} ${days === 1 ? 'day' : 'days'}`}
            icon={<Send size={18} strokeWidth={2} color="#FFFFFF" />}
            loading={isLoading}
            onPress={onSubmit}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
