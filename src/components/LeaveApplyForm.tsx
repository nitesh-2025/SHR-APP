import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  CalendarRange,
  Check,
  Clock3,
  HeartPulse,
  Send,
  Sparkles,
  Sun,
  TreePalm,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { DateField } from "./DateField";
import { Button, Skeleton } from "./ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import {
  useApplyLeaveMutation,
  useGetMyBalanceQuery,
  LEAVE_TYPES,
  type LeaveType,
} from "../store/leaveApi";
import {
  useGetLeavePreviewQuery,
  type LeavePreview,
} from "../store/workCalendarApi";
import { radius, shadow, space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { daysBetween, fmtDayShort, parseYmd, ymd } from "../utils/date";

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
    key: "sl",
    label: "Sick / Emergency",
    blurb: "Unwell, or something urgent came up",
    icon: HeartPulse,
  },
  {
    key: "el",
    label: "Earned",
    blurb: "Planned time off from your accrued days",
    icon: TreePalm,
  },
  {
    key: "unpaid",
    label: "Unpaid",
    blurb: "Beyond your balance — deducted from salary",
    icon: Wallet,
  },
];

/** Full day or half day. Two options, so they fit one row. */
const DURATIONS: { key: boolean; label: string; hint: string; icon: LucideIcon }[] = [
  { key: false, label: "Full day", hint: "One or more whole days", icon: Sun },
  { key: true, label: "Half day", hint: "A single date, counts as 0.5", icon: Clock3 },
];

/** Openers, not answers — a tap fills the box and the cursor carries on. */
const PROMPTS: Record<LeaveType, string[]> = {
  sl: ["Not well — fever", "Doctor appointment", "Family emergency"],
  el: ["Personal work", "Family function", "Travelling"],
  unpaid: ["Personal work", "Extended travel", "Family commitment"],
};

const REASON_MAX = 300;

/* ── Hero ─────────────────────────────────────────────────────────────────── */

/**
 * Concentric arcs sweeping out of the card's corner — the same ornament the
 * balance hero and the profile identity card carry, so every filled surface in
 * the app reads as one family.
 */
function HeroArt({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={{ pointerEvents: "none", position: "absolute", inset: 0, overflow: "hidden" }}
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

/* ── Range breakdown ──────────────────────────────────────────────────────── */

/**
 * How many days a range is actually CHARGED for.
 *
 * `working_days` are the working days inside the range; `sandwich_days` are the
 * off days that fall between two leave days and are counted anyway. Their sum is
 * what leaves the balance. `null` when there is no preview to read, so callers
 * fall back to the calendar span rather than to a zero that would read as "this
 * leave is free".
 */
function chargeableOf(preview?: LeavePreview): number | null {
  if (!preview) return null;
  return preview.working_days + preview.sandwich_days;
}

/**
 * What the picked range actually costs, from the server.
 *
 * The query lives on the FORM, not in here: the same answer decides the hero
 * figure and the shortfall check, and a second copy of the query would let the
 * headline and the breakdown disagree about the same range.
 */
function RangeBreakdown({ data, loading }: { data?: LeavePreview; loading: boolean }) {
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
    { value: data.days, label: data.days === 1 ? "calendar day" : "calendar days" },
    { value: charged, label: "charged" },
    { value: data.off_days_excluded, label: "off excluded" },
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
            {data.sandwich_days} sandwich {data.sandwich_days === 1 ? "day" : "days"} —
            an off day between two leave days is counted.
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Form ─────────────────────────────────────────────────────────────────── */

/**
 * The leave application itself, as a block that drops into any scroller.
 *
 * It was a pushed screen reached from a FAB, which meant "apply" and "what
 * happened to what I applied for" were two different places — one of them
 * behind a floating button, the other behind a back gesture. This is the same
 * form with no chrome of its own: the caller supplies the scroll view, the
 * padding and the keyboard handling, so it can sit inside the Leave screen's
 * own tab strip.
 *
 * Every piece of state is internal. Nothing here is worth lifting: the caller's
 * only interest is that a request WAS filed, which arrives as `onApplied`.
 */
export function LeaveApplyForm({
  onApplied,
  width,
}: {
  /** Fired after a successful submit — switch tabs, pop the screen, refetch. */
  onApplied?: () => void;
  /** Content width, for the hero ornament. Defaults to the screen minus gutters. */
  width?: number;
}) {
  const { c, brand, dark, tint } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const today = ymd(new Date());
  const [type, setType] = useState<LeaveType>("sl");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const balance = useGetMyBalanceQuery();
  const [applyLeave, { isLoading }] = useApplyLeaveMutation();

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
   * balance" warning on a request that was really two days.
   */
  const days = halfDay ? 0.5 : (chargeableOf(preview.data) ?? daysBetween(from, to));

  const available = type === "unpaid" ? null : (balance.data?.[type]?.available ?? 0);

  // Never warn on a guess. While the preview is in flight the fallback span may
  // be over-counting, and telling somebody they are short on days that will not
  // be charged is worse than saying nothing for a moment.
  const short =
    available !== null && days > available && (halfDay || !preview.isLoading);

  const heroWidth = width ?? screenWidth - space.screen * 2;
  const heroHeight = 148;

  const spanLabel = useMemo(() => {
    if (halfDay) return `${fmtDayShort(from)} · half day`;
    if (from === to) return fmtDayShort(from);
    return `${fmtDayShort(from)} → ${fmtDayShort(to)}`;
  }, [from, to, halfDay]);

  const onSubmit = async () => {
    setError("");

    if (!reason.trim()) {
      setError("Please write a short reason for this leave.");
      return;
    }
    if (!halfDay && parseYmd(to)! < parseYmd(from)!) {
      setError("The end date cannot be before the start date.");
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
      toast.success("Leave applied", "Your request is pending approval.");
      // Back to a blank form. The request itself is now in the list the caller
      // is about to show — leaving the old reason in the box invites the same
      // leave being filed twice.
      setReason("");
      setHalfDay(false);
      setFrom(today);
      setTo(today);
      onApplied?.();
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  const danger = toneFor(surface.danger, dark);
  const warn = toneFor(surface.warning, dark);

  return (
    <View style={{ gap: space.xxl }}>
      {/* ── Hero ───────────────────────────────────────────────────────────
          The one filled surface on the form. It answers, at a glance, the only
          question the whole thing is asking: how many days, on which dates, and
          is that within what you have. */}
      <LinearGradient
        colors={[brand[600], brand[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: heroHeight,
          borderRadius: radius.card,
          paddingHorizontal: space.xl,
          justifyContent: "center",
          overflow: "hidden",
          ...(dark ? shadow.none : shadow.card),
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
              <Text className={`text-white ${T.kpiHero}`} allowFontScaling={false}>
                {days}
              </Text>
              <Text className={`text-white/85 ${T.cardTitle}`}>
                {days === 1 ? "day" : "days"}
              </Text>
            </View>

            <Text className={`mt-1 text-white/80 ${T.secondary}`} numberOfLines={1}>
              {spanLabel}
            </Text>
          </View>

          {/* Balance side. `unpaid` has no bucket to draw down, and showing a
              zero there would read as "you have none left" rather than "this one
              is not counted". */}
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.16)",
              borderRadius: radius.well,
              minWidth: 92,
            }}
            className="items-center px-3 py-2.5"
          >
            {available === null ? (
              <>
                <Wallet size={18} strokeWidth={2} color="#FFFFFF" />
                <Text className={`mt-1 text-center text-white/85 ${T.nano}`}>
                  Not counted{"\n"}against balance
                </Text>
              </>
            ) : (
              <>
                <Text className={`text-white ${T.kpiSm}`} allowFontScaling={false}>
                  {available}
                </Text>
                <Text className={`text-white/85 ${T.nano}`}>days left</Text>
              </>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ── Errors and warnings ────────────────────────────────────────────
          The shortfall warns BEFORE submit — finding out you are two days over
          only after tapping Send is a wasted round trip. */}
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
            {days} days requested but only {available} left in this bucket. Shorten the
            range, or apply as Unpaid.
          </Text>
        </View>
      ) : null}

      {/* ── Type ───────────────────────────────────────────────────────────── */}
      <Field label="Leave type">
        <View style={{ gap: space.md }}>
          {LEAVE_TYPES.map((key) => {
            const spec = TYPES.find((t) => t.key === key)!;
            const Icon = spec.icon;
            const active = key === type;
            const left = key === "unpaid" ? null : balance.data?.[key]?.available;

            return (
              <Pressable
                key={key}
                onPress={() => setType(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${spec.label}. ${
                  left == null ? "Not counted against balance" : `${left} days left`
                }`}
                style={({ pressed }) => ({
                  backgroundColor: active ? tint.bg : c.card,
                  borderRadius: radius.card,
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
                    borderRadius: radius.well,
                  }}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Icon
                    size={20}
                    strokeWidth={2.1}
                    color={active ? "#FFFFFF" : c.textMuted}
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
                    backgroundColor: active ? brand[600] : "transparent",
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

      {/* ── How long ───────────────────────────────────────────────────────
          On the form, not behind an overflow menu. It changes the number in the
          hero and whether the second date field exists at all — a setting with
          that much reach should not be something you have to go looking for. */}
      <Field label="How long">
        <View className="flex-row" style={{ gap: space.md }}>
          {DURATIONS.map((opt) => {
            const active = halfDay === opt.key;
            const Icon = opt.icon;
            return (
              <Pressable
                key={String(opt.key)}
                onPress={() => setHalfDay(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${opt.label}. ${opt.hint}`}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: active ? tint.bg : c.card,
                  borderRadius: radius.card,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? brand[600] : c.border,
                  padding: space.lg,
                  opacity: pressed ? 0.85 : 1,
                  ...(dark || active ? shadow.none : shadow.soft),
                })}
                className="gap-2"
              >
                <Icon
                  size={19}
                  strokeWidth={2.1}
                  color={active ? brand[600] : c.textMuted}
                />
                <View>
                  <Text
                    style={{ color: active && !dark ? brand[700] : c.text }}
                    className={T.cardTitleSm}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className={`mt-0.5 ${T.micro}`}
                    numberOfLines={2}
                  >
                    {opt.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* ── Dates ──────────────────────────────────────────────────────────── */}
      <Field
        label={halfDay ? "Date" : "Dates"}
        hint={halfDay ? undefined : `${days} ${days === 1 ? "day" : "days"}`}
      >
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: c.border,
            padding: space.lg,
            ...(dark ? shadow.none : shadow.soft),
          }}
        >
          <View className="flex-row" style={{ gap: space.md }}>
            <DateField
              label={halfDay ? "Date" : "From"}
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

      {/* ── Reason ─────────────────────────────────────────────────────────── */}
      <Field label="Reason" hint={`${reason.length}/${REASON_MAX}`}>
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

        {/* Starters, per bucket. Typing the same three sentences every month is
            the actual friction in this form. */}
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

      <Button
        label={
          isLoading ? "Submitting…" : `Submit · ${days} ${days === 1 ? "day" : "days"}`
        }
        icon={<Send size={18} strokeWidth={2} color="#FFFFFF" />}
        loading={isLoading}
        onPress={onSubmit}
      />

      <Text style={{ color: c.textFaint }} className={`leading-4 ${T.micro}`}>
        Your request goes to your reporting manager for approval. You can withdraw it
        from the Requested tab while it is still pending.
      </Text>
    </View>
  );
}
