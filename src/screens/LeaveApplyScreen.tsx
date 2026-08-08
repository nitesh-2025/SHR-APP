import { StackActions, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  CalendarRange,
  Check,
  Clock3,
  EllipsisVertical,
  HeartPulse,
  ListChecks,
  PenLine,
  Send,
  Sparkles,
  Sun,
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
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { BottomSheet } from '../components/BottomSheet';
import { DateField } from '../components/DateField';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, Button, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import {
  useApplyLeaveMutation,
  useGetMyBalanceQuery,
  useGetMyLeavesQuery,
  LEAVE_TYPES,
  type LeaveType,
} from '../store/leaveApi';
import {
  useGetLeavePreviewQuery,
  type LeavePreview,
} from '../store/workCalendarApi';
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

/**
 * Applying, and reading back what you applied for.
 *
 * These were a segmented strip across the top of the form: "Request |
 * Requested" — two words a pixel apart, differing by two letters, one of which
 * was always the page you were already on. Behind the overflow each one gets
 * the sentence that makes it obvious, and costs no vertical band when closed.
 *
 * "My requests" is a real pushed screen, not a hidden pane: "did my leave go
 * through" is asked on a different day, and an answer you can only reach by
 * first opening a blank application form is an answer nobody finds.
 */
const VIEWS: {
  key: 'apply' | 'requests';
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    key: 'apply',
    label: 'Apply for leave',
    hint: 'Fill in a new request',
    icon: PenLine,
  },
  {
    key: 'requests',
    label: 'My requests',
    hint: 'What you sent, and where it got to',
    icon: ListChecks,
  },
];

/**
 * Full day or half day, as menu rows behind the overflow.
 *
 * This was a two-up segmented strip in the form body, each half carrying a
 * label AND a hint. On a 360 dp screen the hints ("One or more whole days" /
 * "Counts as 0.5") were wider than their halves, overflowed the track and ran
 * into each other — the strip read as one broken line of text. A menu row has
 * the width for the hint, and the choice is a once-per-application one that
 * does not deserve a permanent 60px band on the form.
 */
const DURATIONS: {
  key: boolean;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { key: false, label: 'Full day', hint: 'One or more whole days', icon: Sun },
  { key: true, label: 'Half day', hint: 'A single date, counts as 0.5', icon: Clock3 },
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

/* ── Range breakdown ──────────────────────────────────────────────────────── */

/**
 * How many days a range is actually CHARGED for.
 *
 * `working_days` are the working days inside the range; `sandwich_days` are the
 * off days that fall between two leave days and are counted anyway. Their sum is
 * what leaves the balance. The other two fields are context, not the charge:
 * `days` is the whole calendar span and `off_days_excluded` is the part that was
 * let off — which is why `days - off_days_excluded` reaches the same number by
 * the other route.
 *
 * Derived from what the field NAMES mean rather than picking one figure and
 * hoping. `null` when there is no preview to read, so callers fall back to the
 * calendar span rather than to a zero that would read as "this leave is free".
 */
function chargeableOf(preview?: LeavePreview): number | null {
  if (!preview) return null;
  return preview.working_days + preview.sandwich_days;
}

/* ── Range breakdown ──────────────────────────────────────────────────────── */

/**
 * What the picked range actually costs, from the server.
 *
 * This replaced a hardcoded line that read "Weekly offs and holidays inside the
 * range still count as applied days." That sentence was a POLICY CLAIM the app
 * had no way to verify — and `GET /work-calendar/leave-preview` exists, returns
 * `off_days_excluded`, and can therefore contradict it. Stating a rule the
 * backend may not follow is worse than saying nothing.
 *
 * The query lives on the SCREEN, not in here: the same answer decides the hero
 * figure and the shortfall check, and a second copy of the query would let the
 * headline and the breakdown disagree about the same range.
 */
function RangeBreakdown({
  data,
  loading,
}: {
  data?: LeavePreview;
  loading: boolean;
}) {
  const { c, dark } = useTheme();
  const still = useReducedMotion();

  if (loading) {
    return (
      <View className="mt-3">
        <Skeleton height={14} radius={radius.pill} />
      </View>
    );
  }

  // No preview is not worth an error banner — the form still works without it,
  // the dates are already on screen, and the hero has fallen back to the
  // calendar span.
  if (!data) return null;

  const warn = toneFor(surface.warning, dark);
  const charged = chargeableOf(data) ?? 0;
  const facts = [
    { value: data.days, label: data.days === 1 ? 'calendar day' : 'calendar days' },
    { value: charged, label: 'charged' },
    { value: data.off_days_excluded, label: 'off excluded' },
  ];

  return (
    <Animated.View
      entering={still ? undefined : FadeIn.duration(200)}
      // Keyed on the numbers so a new range re-runs the fade rather than
      // swapping digits in place — a figure that changes silently reads as a
      // glitch.
      key={`${data.days}:${charged}:${data.off_days_excluded}`}
      className="mt-3"
    >
      <View
        style={{
          backgroundColor: c.fill,
          borderRadius: radius.well,
          paddingVertical: space.sm + 2,
        }}
        className="flex-row items-center"
      >
        {facts.map((fact, i) => (
          <View key={fact.label} className="flex-1 flex-row items-center">
            {i > 0 ? (
              <View style={{ backgroundColor: c.border }} className="h-6 w-px" />
            ) : null}
            <View className="flex-1 items-center">
              <Text
                style={{ color: c.text }}
                className={T.cardTitleSm}
                allowFontScaling={false}
              >
                {fact.value}
              </Text>
              <Text style={{ color: c.textMuted }} className={T.nano} numberOfLines={1}>
                {fact.label}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Only when it applies. A sandwich rule is the single most surprising
          thing on an Indian leave policy, and finding out after approval is
          how a two-day leave silently becomes four. */}
      {data.sandwich_days > 0 ? (
        <View
          style={{
            marginTop: space.sm,
            backgroundColor: warn.bg,
            borderRadius: radius.well,
            borderWidth: 1,
            borderColor: warn.border,
          }}
          className="flex-row items-center gap-2 px-3 py-2"
        >
          <CalendarRange size={13} strokeWidth={2} color={warn.tint} />
          <Text style={{ color: warn.text }} className={`flex-1 ${T.micro}`}>
            {data.sandwich_days} sandwich {data.sandwich_days === 1 ? 'day' : 'days'} —
            an off day between two leave days is counted.
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Overflow menu ────────────────────────────────────────────────────────── */

/** Small caps label. Two groups in one sheet need saying apart. */
function MenuHeading({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <Text
      style={{ color: c.textFaint, letterSpacing: 0.7, marginTop: space.xs }}
      className={T.badge}
    >
      {label.toUpperCase()}
    </Text>
  );
}

/**
 * One choice in the overflow sheet.
 *
 * Icon, label, and a line explaining what picking it does — the explanation is
 * the whole reason these moved out of a segmented strip, where "Request" and
 * "Requested" sat a pixel apart and differed by two letters.
 */
function MenuRow({
  icon: Icon,
  label,
  hint,
  active,
  badge = 0,
  radio = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  active: boolean;
  badge?: number;
  /** `radio` for a setting, plain button for a page you are navigating to. */
  radio?: boolean;
  onPress: () => void;
}) {
  const { c, brand, tint } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge ? `${label}, ${badge} pending. ${hint}` : `${label}. ${hint}`}
      style={{
        backgroundColor: active ? tint.bg : c.fill,
        borderRadius: radius.well,
        borderWidth: 1,
        borderColor: active ? brand[600] : 'transparent',
      }}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      <View
        style={{
          backgroundColor: active ? brand[600] : c.card,
          borderRadius: radius.well - 4,
        }}
        className="h-10 w-10 items-center justify-center"
      >
        <Icon size={19} strokeWidth={2.1} color={active ? '#FFFFFF' : c.textMuted} />
      </View>

      <View className="flex-1">
        <Text
          style={{ color: active ? brand[700] : c.text }}
          className={T.cardTitleSm}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`}>
          {hint}
        </Text>
      </View>

      {badge ? <Badge label={String(badge)} tone={surface.warning} /> : null}
      {active ? <Check size={18} strokeWidth={2.6} color={brand[700]} /> : null}
    </Pressable>
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
  const { c, brand, dark, tint } = useTheme();
  const { width } = useWindowDimensions();

  const today = ymd(new Date());
  const [type, setType] = useState<LeaveType>('sl');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const balance = useGetMyBalanceQuery();
  const [applyLeave, { isLoading }] = useApplyLeaveMutation();

  /**
   * How many of my requests are still unanswered.
   *
   * Only the count is used here — the list itself is its own screen. This is
   * the same cached query that screen runs, so asking for it costs one request
   * between the two, and the apply mutation invalidates it either way.
   */
  const mine = useGetMyLeavesQuery({ limit: 50 });

  const pendingCount = useMemo(
    () => (mine.data?.items ?? []).filter((l) => l.status === 'pending').length,
    [mine.data],
  );

  // A half day is a single date by definition, so the range collapses and there
  // is nothing for the server to work out.
  const preview = useGetLeavePreviewQuery(
    { from, to },
    { skip: halfDay || !from || !to },
  );

  /**
   * What this leave actually costs.
   *
   * The calendar span is the FALLBACK, not the answer. It counts every day
   * between the two dates, so a Friday-to-Monday leave read as four days when
   * the weekend is usually let off — which then tripped the "not enough
   * balance" warning on a request that was really two days. The server knows
   * the working week and the holiday list; ask it, and only count days by hand
   * when it has not answered yet.
   */
  const days = halfDay ? 0.5 : (chargeableOf(preview.data) ?? daysBetween(from, to));

  const available = type === 'unpaid' ? null : (balance.data?.[type]?.available ?? 0);

  // Never warn on a guess. While the preview is in flight the fallback span may
  // be over-counting, and telling somebody they are short on days that will not
  // be charged is worse than saying nothing for a moment.
  const short =
    available !== null && days > available && (halfDay || !preview.isLoading);

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
      // REPLACE the form with the list rather than stacking it on top: the
      // question straight after submitting is "did it actually go", and backing
      // out of the answer should land on wherever you came from, not on a form
      // you have already filed.
      setReason('');
      navigation.dispatch(
        StackActions.replace('LeaveRequests' as never),
      );
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  const danger = toneFor(surface.danger, dark);
  const warn = toneFor(surface.warning, dark);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* With the duration behind the overflow, the subtitle is the only thing
          left saying what the form is set to. It restates the menu's answer so
          the menu does not have to be opened to remember it — "half day"
          applied silently is the one setting worth a permanent line. */}
      <ScreenHeader
        title="Apply for Leave"
        subtitle={halfDay ? 'Half day' : 'Full day'}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={pendingCount ? `Menu. ${pendingCount} pending` : 'Menu'}
            style={{ marginRight: -4, paddingLeft: 4 }}
          >
            <EllipsisVertical size={22} strokeWidth={2.2} color={c.text} />
            {/* A request nobody has answered yet is the one thing worth seeing
                without opening the menu. */}
            {pendingCount ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: 0,
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: surface.warning.tint,
                  borderWidth: 1.5,
                  borderColor: c.bg,
                }}
              />
            ) : null}
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            // Just breathing room under the last line. NOT clearance for the
            // submit bar: that bar is a flex SIBLING of this ScrollView, so it
            // already owns its own height and its own safe-area inset. The old
            // `insets.bottom + 130` was reserving that space a second time —
            // half a screen of nothing between the footnote and the button.
            paddingBottom: space.xxl,
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
                      backgroundColor: active ? tint.bg : c.card,
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
                <RangeBreakdown data={preview.data} loading={preview.isLoading} />
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

      {/* ── Menu ───────────────────────────────────────────────────────────
          Everything this screen can be switched to, in one place: which page
          you are on, and — while you are on the form — how long the leave is.
          A sheet rather than an anchored popover, because the trigger sits
          right under the status bar and a menu opening downward from there
          would cover the very thing it changes. */}
      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        maxHeightRatio={0.7}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <MenuHeading label="Show" />

          {VIEWS.map((v) => (
            <MenuRow
              key={v.key}
              icon={v.icon}
              label={v.label}
              hint={v.hint}
              active={v.key === 'apply'}
              badge={v.key === 'requests' ? pendingCount : 0}
              onPress={() => {
                setMenuOpen(false);
                if (v.key === 'requests') {
                  navigation.navigate('LeaveRequests' as never);
                }
              }}
            />
          ))}

          <View
            style={{ backgroundColor: c.border, marginVertical: space.sm }}
            className="h-px"
          />
          <MenuHeading label="How long" />

          {DURATIONS.map((opt) => (
            <MenuRow
              key={String(opt.key)}
              icon={opt.icon}
              label={opt.label}
              hint={opt.hint}
              active={halfDay === opt.key}
              radio
              onPress={() => {
                setHalfDay(opt.key);
                setMenuOpen(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}
