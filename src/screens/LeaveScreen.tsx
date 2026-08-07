import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  CalendarHeart,
  Check,
  ChevronLeft,
  ClipboardList,
  FileText,
  MessageSquareText,
  PartyPopper,
  Plus,
  Repeat,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import {
  ConfirmDivider,
  ConfirmSheet,
  ConfirmStat,
} from "../components/ConfirmSheet";
import { BalanceTile, useBalanceTiles } from "../components/LeaveBalanceCard";
import {
  Badge,
  EmptyState,
  RangeChip,
  SectionHeader,
  Segmented,
  Skeleton,
} from "../components/ui";
import { describeApiError, toastApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useMenuNav } from "../navigation/useMenuNav";
import {
  useCancelLeaveMutation,
  useGetMyBalanceQuery,
  useGetMyLeavesQuery,
  type Leave,
  type LeaveStatus,
} from "../store/leaveApi";
import { useGetHolidaysQuery } from "../store/workCalendarApi";
import {
  radius,
  shadow,
  space,
  surface,
  toneFor,
  type Surface,
} from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import {
  fmtDate,
  fmtDayShort,
  MONTHS,
  MONTHS_LONG,
  parseYmd,
  weekdayOf,
  WEEKDAYS_LONG,
  ymd,
} from "../utils/date";
import { resolveHolidays, type HolidayDate } from "../utils/holidays";

const TYPE_LABEL: Record<string, string> = {
  sl: "Sick Leave",
  el: "Annual Leave",
  unpaid: "Unpaid Leave",
};

// Rejected reads violet rather than red: red is already the calendar's
// "absent", and a declined request is not an error state.
const STATUS: Record<LeaveStatus, { label: string; tone: Surface }> = {
  approved: { label: "Approved", tone: surface.success },
  pending: { label: "Pending", tone: surface.warning },
  rejected: { label: "Rejected", tone: surface.purple },
  cancelled: { label: "Cancelled", tone: surface.neutral },
};

/** `all` is not a status — it is the absence of the filter. */
type StatusFilter = "all" | LeaveStatus;

/**
 * Each chip carries its status's own colour as a DOT, never as its text.
 *
 * The label used to be painted in `surface.*.bg` — the 50-step tint, which is a
 * near-white. On a white card that is white text on white: the row was five
 * invisible chips with a visible count beside each one. The tint belongs on a
 * 6px dot; the label belongs in an ink that can be read.
 */
const FILTERS: { key: StatusFilter; label: string; tone: Surface | null }[] = [
  { key: "all", label: "All", tone: null },
  { key: "pending", label: "Pending", tone: surface.warning },
  { key: "approved", label: "Approved", tone: surface.success },
  { key: "rejected", label: "Rejected", tone: surface.purple },
  { key: "cancelled", label: "Cancelled", tone: surface.neutral },
];

/** Years offered in the picker, newest first. */
const YEAR_SPAN = 4;

/** The two halves of "leave": what YOU asked for, and what the COMPANY gives. */
type Tab = "requests" | "holidays";

const TILE_WIDTH = 168;

/* ── Holidays ─────────────────────────────────────────────────────────────── */

/** Whole days from today. Negative = already passed. */
function daysAway(key: string, todayKey: string): number {
  const a = parseYmd(todayKey);
  const b = parseYmd(key);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function HolidayCard({
  item,
  todayKey,
}: {
  item: HolidayDate;
  todayKey: string;
}) {
  const { c, dark } = useTheme();

  const away = daysAway(item.key, todayKey);
  const isToday = away === 0;
  const passed = away < 0;

  // Today is a success state, anything ahead is informational, anything behind
  // steps back to neutral — a past holiday is history, not news.
  const tone = isToday
    ? surface.success
    : passed
      ? surface.neutral
      : surface.info;

  // Re-mixed rather than flattened to grey: the date well is the only thing
  // saying "today / upcoming / gone" at a glance, and a dark scheme that drops
  // every tint to `fill` throws that signal away. `toneFor` keeps the hue and
  // swaps the recipe for one that survives on a dark canvas.
  const well = toneFor(tone, dark);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        opacity: passed ? 0.72 : 1,
        ...(dark ? shadow.none : shadow.soft),
      }}
      className="flex-row items-center gap-3"
    >
      <View
        style={{ backgroundColor: well.bg, borderRadius: radius.well - 2 }}
        className="h-12 w-12 items-center justify-center"
      >
        <Text
          style={{ color: well.text }}
          className={T.cardTitle}
          allowFontScaling={false}
        >
          {String(item.date.getDate()).padStart(2, "0")}
        </Text>
        <Text
          style={{ color: well.text }}
          className={T.nano}
          allowFontScaling={false}
        >
          {MONTHS[item.date.getMonth()]}
        </Text>
      </View>

      <View className="flex-1">
        <Text
          style={{ color: c.text }}
          className={T.cardTitleSm}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <Text
            style={{ color: c.textMuted }}
            className={T.micro}
            numberOfLines={1}
          >
            {WEEKDAYS_LONG[item.date.getDay()]}
          </Text>
          {/* A recurring holiday falls on the same date every year; a one-off
              was declared for this year only. Worth saying — it is the
              difference between "always" and "this time". */}
          {item.recurring ? (
            <>
              <Text style={{ color: c.textFaint }} className={T.micro}>
                ·
              </Text>
              <Repeat size={10} strokeWidth={2.4} color={c.textFaint} />
              <Text style={{ color: c.textFaint }} className={T.micro}>
                Every year
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {isToday ? (
        <Badge
          label="Today"
          tone={surface.success}
          icon={
            <PartyPopper
              size={11}
              strokeWidth={2.6}
              color={surface.success.tint}
            />
          }
        />
      ) : (
        <Text
          style={{ color: passed ? c.textFaint : c.textMuted }}
          className={T.micro}
          allowFontScaling={false}
        >
          {passed ? "Passed" : away === 1 ? "Tomorrow" : `in ${away} days`}
        </Text>
      )}
    </View>
  );
}

/* ── Balance hero ─────────────────────────────────────────────────────────── */

const HERO_HEIGHT = 168;

/** Ring geometry. Small enough to share the row with the number it explains. */
const RING = 86;
const RING_STROKE = 8;

/**
 * Decorative arcs + horizon, same ornament as the apply screen's hero and the
 * profile identity card — the three filled surfaces in the app read as one
 * family rather than three one-off treatments.
 */
function HeroArt({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={{
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
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
          d={`M0 ${height * 0.72} Q ${width * 0.3} ${height * 0.58} ${width * 0.62} ${height * 0.76} T ${width} ${height * 0.68}`}
          stroke="#FFFFFF"
          strokeOpacity={0.16}
          strokeWidth={1.4}
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** One figure in the hero's footer strip. */
function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className={`text-white ${T.cardTitleSm}`} allowFontScaling={false}>
        {value}
      </Text>
      <Text className={`mt-0.5 text-white/75 ${T.nano}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Total leave still available, as the one filled card on the screen.
 *
 * The ring shows CONSUMED, not remaining: a ring that empties as you take leave
 * reads as a battery draining, which is the wrong story — the days were yours to
 * spend. It fills as you use them.
 */
function BalanceHero({
  totals,
  pending,
  width,
}: {
  totals: { allocated: number; used: number; available: number };
  pending: number;
  width: number;
}) {
  const { brand } = useTheme();

  const pct =
    totals.allocated > 0
      ? Math.min(1, Math.max(0, totals.used / totals.allocated))
      : 0;
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <LinearGradient
      colors={[brand[600], brand[800]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: HERO_HEIGHT,
        borderRadius: radius.card,
        paddingHorizontal: space.xl,
        paddingVertical: space.lg,
        justifyContent: "space-between",
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      <HeroArt width={width} height={HERO_HEIGHT} />

      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text
            className={`text-white/85 ${T.badge}`}
            style={{ letterSpacing: 0.6 }}
            allowFontScaling={false}
          >
            LEAVE BALANCE
          </Text>

          <View className="mt-1 flex-row items-baseline gap-2">
            <Text className={`text-white ${T.kpiHero}`} allowFontScaling={false}>
              {totals.available}
            </Text>
            <Text className={`text-white/85 ${T.cardTitle}`}>
              {totals.available === 1 ? "day left" : "days left"}
            </Text>
          </View>

          <Text className={`mt-0.5 text-white/75 ${T.secondary}`} numberOfLines={1}>
            {pending > 0
              ? `${pending} request${pending === 1 ? "" : "s"} awaiting approval`
              : "Nothing waiting on your manager"}
          </Text>
        </View>

        {/* Ring. Amber arc for the same reason the attendance hero uses one:
            against a deep green fill it is the only accent that stays legible
            without introducing a second status colour. */}
        <View style={{ width: RING, height: RING }}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke="#FBBF24"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - pct)}
              // Start at 12 o'clock, sweep clockwise.
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View
            style={{ position: "absolute", inset: 0 }}
            className="items-center justify-center"
          >
            <Text className={`text-white ${T.kpiSm}`} allowFontScaling={false}>
              {Math.round(pct * 100)}%
            </Text>
            <Text className={`text-white/75 ${T.nano}`}>used</Text>
          </View>
        </View>
      </View>

      <View
        style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" }}
        className="flex-row items-center pt-3"
      >
        <HeroFact label="Allocated" value={String(totals.allocated)} />
        <View
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          className="h-7 w-px"
        />
        <HeroFact label="Used" value={String(totals.used)} />
        <View
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          className="h-7 w-px"
        />
        <HeroFact label="Pending" value={String(pending)} />
      </View>
    </LinearGradient>
  );
}

/* ── Filter chip ──────────────────────────────────────────────────────────── */

/**
 * A status filter carrying its own count.
 *
 * The number is the point: it says how many requests are waiting on someone
 * before you tap, so an empty filter is never a surprise. A chip with nothing
 * behind it stays visible but reads as disabled — hiding it would make the row
 * reflow every time the month changes.
 */
function FilterChip({
  label,
  count,
  active,
  tone,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  /** `null` for "All" — the absence of a filter has no status colour. */
  tone: Surface | null;
  onPress: () => void;
}) {
  const { c, brand, dark } = useTheme();
  const empty = count === 0 && !active;
  const dot = tone ? toneFor(tone, dark).tint : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        backgroundColor: active ? brand[600] : c.card,
        borderRadius: radius.pill,
        borderWidth: active ? 0 : 1,
        borderColor: c.border,
        opacity: pressed ? 0.75 : empty ? 0.55 : 1,
      })}
      className="h-9 flex-row items-center gap-2 px-3.5"
    >
      {dot ? (
        <View
          style={{
            // On the accent fill the status dot goes white — its own hue
            // against brand green is two saturated colours fighting in a 6px
            // circle, and the chip is already telling you which status it is.
            backgroundColor: active ? "rgba(255,255,255,0.9)" : dot,
          }}
          className="h-1.5 w-1.5 rounded-full"
        />
      ) : null}

      <Text
        style={{ color: active ? "#FFFFFF" : c.text }}
        className={T.badge}
        allowFontScaling={false}
      >
        {label}
      </Text>

      <Text
        style={{
          color: active ? "rgba(255,255,255,0.75)" : c.textFaint,
        }}
        className={T.count}
        allowFontScaling={false}
      >
        {count}
      </Text>
    </Pressable>
  );
}

/* ── Card parts ───────────────────────────────────────────────────────────── */

/** One figure in the card's recessed facts strip. */
function Fact({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-1">
      <Text style={{ color: c.textMuted }} className={T.nano} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: c.text }}
        className={`mt-0.5 ${T.cardTitleSm}`}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}

function Rule() {
  const { c } = useTheme();
  return <View style={{ backgroundColor: c.border }} className="h-7 w-px" />;
}

/* ── Request card ─────────────────────────────────────────────────────────── */

/**
 * One request, as a card — same anatomy as an attendance day.
 *
 * A date well anchors it, the type and span read as the headline, the derived
 * figures sit in their own recessed strip, and anything anyone WROTE (the
 * employee's reason, the reviewer's note) is quoted below in its own block.
 *
 * This replaced a timeline rail. The rail spent 22px of a 360dp screen on a
 * dotted line and pushed every card off the grid the rest of the app sits on,
 * for a sequence the dates already state — and the cards themselves were
 * carrying a full drop shadow apiece, which stacked into grey haze down the
 * length of the list.
 */
function LeaveCard({
  leave,
  onWithdraw,
  busy,
}: {
  leave: Leave;
  /** Omitted unless the request is still the employee's to withdraw. */
  onWithdraw?: () => void;
  busy: boolean;
}) {
  const { c, dark } = useTheme();
  const status = STATUS[leave.status] ?? STATUS.pending;
  const from = parseYmd(leave.from_date);
  const single = leave.from_date === leave.to_date;

  // Dark mode drops the pastel fills — a tint that reads as "soft" on white
  // reads as "muddy" on a dark surface.
  // Same reasoning as the holiday card: the well is what says "approved" from
  // the left edge of the row, so dark mode re-mixes the tint instead of
  // discarding it.
  const well = toneFor(status.tone, dark);

  return (
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
      {/* ── Head ───────────────────────────────────────────────────────────
          The date well carries the status colour, so the card says approved /
          pending from its left edge and the badge only confirms it. */}
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: well.bg, borderRadius: radius.well - 2 }}
          className="h-12 w-12 items-center justify-center"
        >
          <Text
            style={{ color: well.text }}
            className={T.cardTitle}
            allowFontScaling={false}
          >
            {from ? String(from.getDate()).padStart(2, "0") : "--"}
          </Text>
          <Text
            style={{ color: well.text }}
            className={T.nano}
            allowFontScaling={false}
          >
            {from ? MONTHS[from.getMonth()] : ""}
          </Text>
        </View>

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.cardTitleSm}
            numberOfLines={1}
          >
            {TYPE_LABEL[leave.type] ?? leave.type}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {single
              ? `${weekdayOf(leave.from_date)}, ${fmtDate(leave.from_date)}`
              : `${fmtDayShort(leave.from_date)} → ${fmtDate(leave.to_date)}`}
          </Text>
        </View>

        <Badge label={status.label} tone={status.tone} />
      </View>

      {/* ── Facts ──────────────────────────────────────────────────────────
          Derived from the dates above, and the inset says so. */}
      <View
        style={{
          backgroundColor: c.fill,
          borderRadius: radius.well - 4,
          paddingHorizontal: space.md,
          paddingVertical: space.sm + 2,
        }}
        className="mt-3 flex-row items-center gap-3"
      >
        <Fact
          label="Duration"
          value={`${leave.days} ${leave.days === 1 ? "day" : "days"}`}
        />
        <Rule />
        <Fact
          label="Session"
          value={leave.half_day ? "Half day" : "Full day"}
        />
        {leave.createdAt ? (
          <>
            <Rule />
            <Fact label="Applied" value={fmtDayShort(leave.createdAt)} />
          </>
        ) : null}
      </View>

      {/* ── Reason ─────────────────────────────────────────────────────────
          Three lines, then it stops. A request is skimmed in a list; the whole
          essay belongs on the request itself, not in every row of history. */}
      {leave.reason ? (
        <View className="mt-3 flex-row gap-2">
          <FileText
            size={13}
            strokeWidth={2}
            color={c.textFaint}
            style={{ marginTop: 2 }}
          />
          <Text
            style={{ color: c.textMuted }}
            className={`flex-1 ${T.secondary}`}
            numberOfLines={3}
          >
            {leave.reason}
          </Text>
        </View>
      ) : null}

      {/* ── Reviewer's note ────────────────────────────────────────────────
          Quoted in the status tint. Someone else wrote this, and it should
          never read as a continuation of the employee's own reason. */}
      {leave.review_note ? (
        <View
          style={{
            backgroundColor: well.bg,
            borderRadius: radius.well - 4,
            padding: space.md,
          }}
          className="mt-3 flex-row gap-2"
        >
          <MessageSquareText
            size={13}
            strokeWidth={2}
            color={well.tint}
            style={{ marginTop: 2 }}
          />
          <View className="flex-1">
            <Text style={{ color: well.text }} className={T.nano}>
              {leave.reviewer_name || "Reviewer"}
            </Text>
            <Text style={{ color: c.text }} className={`mt-0.5 ${T.secondary}`}>
              {leave.review_note}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Footer ─────────────────────────────────────────────────────────
          Only a pending request is still the employee's to withdraw. */}
      {onWithdraw ? (
        <Pressable
          onPress={onWithdraw}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Withdraw this leave request"
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => ({
            opacity: busy ? 0.6 : pressed ? 0.6 : 1,
            backgroundColor: c.fill,
            borderRadius: radius.pill,
          })}
          className="mt-3 flex-row items-center gap-1.5 self-start px-3 py-1.5"
        >
          {busy ? (
            <ActivityIndicator size="small" color={c.textMuted} />
          ) : (
            <X size={13} strokeWidth={2.6} color={c.textMuted} />
          )}
          <Text style={{ color: c.textMuted }} className={T.badge}>
            Withdraw
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My leave — balance, request history and the entry point to the apply form.
 *
 * `GET /leave/me` takes no date range, so the month and status filters run on
 * the client. That is the right trade: a personal leave history is tens of
 * rows, and filtering locally keeps every chip instant.
 */
export default function LeaveScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, primary, tint } = useTheme();
  const { width } = useWindowDimensions();

  const today = new Date();
  const todayKey = ymd(today);
  const [tab, setTab] = useState<Tab>("requests");
  const [year, setYear] = useState(today.getFullYear());
  /** `null` = the whole year. History is sparse, so it opens wide. */
  const [month, setMonth] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");

  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  /** The request awaiting a withdrawal confirmation, if any. */
  const [confirm, setConfirm] = useState<Leave | null>(null);

  const balance = useGetMyBalanceQuery();
  const { data, isLoading, isFetching, error, refetch } = useGetMyLeavesQuery({
    limit: 100,
  });
  const [cancelLeave, { isLoading: cancelling }] = useCancelLeaveMutation();
  const tiles = useBalanceTiles(balance.data);

  // The holiday master is one small, rarely-changing list — fetched once and
  // resolved per year on the client, so stepping years costs no round trip.
  const holidays = useGetHolidaysQuery();

  /** Everything in the chosen period, newest first — what the chips count. */
  const inPeriod = useMemo(() => {
    const all = data?.items ?? [];
    return all
      .filter((l) => {
        const d = parseYmd(l.from_date);
        if (!d || d.getFullYear() !== year) return false;
        return month === null || d.getMonth() === month;
      })
      .sort((a, b) => b.from_date.localeCompare(a.from_date));
  }, [data, year, month]);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: inPeriod.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };
    for (const l of inPeriod) map[l.status] = (map[l.status] ?? 0) + 1;
    return map;
  }, [inPeriod]);

  const items = useMemo(
    () =>
      status === "all" ? inPeriod : inPeriod.filter((l) => l.status === status),
    [inPeriod, status],
  );

  /**
   * Every bucket added together — what the hero shows.
   *
   * Summed over whatever buckets the server actually sent rather than over a
   * hardcoded `["sl", "el"]`: the day a third bucket is added, a fixed list
   * would quietly under-report the balance instead of failing loudly.
   */
  const totals = useMemo(() => {
    const sum = { allocated: 0, used: 0, available: 0 };
    for (const b of Object.values(balance.data ?? {})) {
      if (!b) continue;
      sum.allocated += b.allocated ?? 0;
      sum.used += b.used ?? 0;
      sum.available += b.available ?? 0;
    }
    return sum;
  }, [balance.data]);

  /**
   * Month buckets, newest first. Only used while the period is the whole year —
   * with a month already picked, a header naming that same month is noise.
   */
  const groups = useMemo(() => {
    if (month !== null) return [{ key: -1, items }];
    const map = new Map<number, Leave[]>();
    for (const l of items) {
      const d = parseYmd(l.from_date);
      const k = d ? d.getMonth() : -1;
      const bucket = map.get(k);
      if (bucket) bucket.push(l);
      else map.set(k, [l]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([key, group]) => ({ key, items: group }));
  }, [items, month]);

  /** This year's holidays, narrowed by the same month chip the requests use. */
  const holidayList = useMemo(() => {
    const all = resolveHolidays(holidays.data, year);
    return month === null
      ? all
      : all.filter((h) => h.date.getMonth() === month);
  }, [holidays.data, year, month]);

  const upcoming = useMemo(
    () => holidayList.filter((h) => h.key >= todayKey),
    [holidayList, todayKey],
  );
  const passed = useMemo(
    () => holidayList.filter((h) => h.key < todayKey),
    [holidayList, todayKey],
  );

  const years = Array.from(
    { length: YEAR_SPAN },
    (_, i) => today.getFullYear() - i,
  );

  const go = useMenuNav();

  const withdraw = async (leave: Leave) => {
    try {
      await cancelLeave(leave._id).unwrap();
      setConfirm(null);
      toast.success("Leave request withdrawn");
    } catch (e) {
      toast.error(...toastApiError(e));
    }
  };

  const period =
    month === null ? String(year) : `${MONTHS_LONG[month]} ${year}`;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────
          The title is deliberately smaller than a screen heading: it shares
          the row with controls, and at 28px it pushed them off a 360dp
          screen — the same reason Attendance sizes its title down. */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.lg,
        }}
        className="flex-row items-center gap-3"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} strokeWidth={2.2} color={c.text} />
        </Pressable>

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.section}
            numberOfLines={1}
          >
            My Leave
          </Text>
        </View>

        {/* Month left of year — narrowing reads outer-to-inner. */}
        <View className="flex-row items-center gap-2">
          <RangeChip
            label={month === null ? "All" : MONTHS[month]}
            a11y={`Month ${month === null ? "all" : MONTHS_LONG[month]}. Change month`}
            onPress={() => setMonthOpen(true)}
          />
          <RangeChip
            label={String(year)}
            a11y={`Year ${year}. Change year`}
            onPress={() => setYearOpen(true)}
          />
        </View>
      </View>

      {/* ── Tabs ─────────────────────────────────────────────────────────
          Two readings of the same word. "Requested" is what YOU asked for;
          "Holidays" is what the company already closed — days you never have
          to ask for. They were two different screens' worth of question stuck
          on one list before. */}
      <View
        style={{ paddingHorizontal: space.screen, paddingBottom: space.lg }}
      >
        <Segmented<Tab>
          segments={[
            { key: "requests", label: "Requested", count: inPeriod.length },
            { key: "holidays", label: "Holidays", count: holidayList.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 76,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              tab === "requests"
                ? isFetching && !isLoading
                : holidays.isFetching && !holidays.isLoading
            }
            onRefresh={() => {
              if (tab === "requests") {
                refetch();
                balance.refetch();
              } else {
                holidays.refetch();
              }
            }}
            tintColor={brand[600]}
          />
        }
      >
        {tab === "holidays" ? (
          /* ── Holidays ─────────────────────────────────────────────────
             Upcoming first, then what has already gone by — the question on
             this tab is "when is the next day off", not "what happened in
             March". */
          <>
            {holidays.isLoading ? (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                <Skeleton height={78} radius={radius.card - 4} />
                <Skeleton height={78} radius={radius.card - 4} />
                <Skeleton height={78} radius={radius.card - 4} />
              </View>
            ) : holidays.error ? (
              <EmptyState
                icon={
                  <TriangleAlert
                    size={32}
                    strokeWidth={1.6}
                    color={brand[600]}
                  />
                }
                title="Could not load the holiday list"
                message={describeApiError(holidays.error).title}
                actionLabel="Try again"
                onAction={() => holidays.refetch()}
              />
            ) : holidayList.length === 0 ? (
              <EmptyState
                icon={
                  <CalendarHeart
                    size={32}
                    strokeWidth={1.6}
                    color={brand[600]}
                  />
                }
                title="No holidays in this period"
                message={`The company calendar has nothing marked for ${period}. Try another month or year.`}
                actionLabel={month === null ? undefined : "Show the whole year"}
                onAction={month === null ? undefined : () => setMonth(null)}
              />
            ) : (
              <View style={{ gap: space.xl }}>
                {upcoming.length > 0 ? (
                  <View style={{ gap: space.md }}>
                    <Text
                      style={{
                        color: c.textFaint,
                        paddingHorizontal: space.screen,
                      }}
                      className={`uppercase ${T.micro}`}
                    >
                      Coming up
                    </Text>
                    <View
                      style={{ paddingHorizontal: space.screen, gap: space.md }}
                    >
                      {upcoming.map((h) => (
                        <HolidayCard
                          key={h.id + h.key}
                          item={h}
                          todayKey={todayKey}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {passed.length > 0 ? (
                  <View style={{ gap: space.md }}>
                    <Text
                      style={{
                        color: c.textFaint,
                        paddingHorizontal: space.screen,
                      }}
                      className={`uppercase ${T.micro}`}
                    >
                      Already passed
                    </Text>
                    <View
                      style={{ paddingHorizontal: space.screen, gap: space.md }}
                    >
                      {passed.map((h) => (
                        <HolidayCard
                          key={h.id + h.key}
                          item={h}
                          todayKey={todayKey}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </>
        ) : (
          <>
            {/* ── Balance hero ───────────────────────────────────────────────
                One number answers the question people open this screen with:
                how many days do I still have. The per-bucket tiles below break
                it down, but a rail of two tiles as the FIRST thing on the page
                made the answer something you had to assemble yourself. */}
            {balance.isLoading ? (
              <View style={{ paddingHorizontal: space.screen }}>
                <Skeleton height={HERO_HEIGHT} radius={radius.card} />
              </View>
            ) : (
              <View style={{ paddingHorizontal: space.screen }}>
                <BalanceHero
                  totals={totals}
                  pending={counts.pending ?? 0}
                  width={width - space.screen * 2}
                />
              </View>
            )}

            {/* ── By type ────────────────────────────────────────────────────── */}
            <View style={{ paddingTop: space.xxl }}>
              <SectionHeader title="By type" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.screen,
                gap: space.md,
              }}
            >
              {balance.isLoading ? (
                <>
                  <Skeleton
                    height={118}
                    width={TILE_WIDTH}
                    radius={radius.card}
                  />
                  <Skeleton
                    height={118}
                    width={TILE_WIDTH}
                    radius={radius.card}
                  />
                </>
              ) : (
                tiles.map((t) => (
                  <BalanceTile
                    key={t.key}
                    label={t.label}
                    bucket={t.bucket}
                    tone={t.tone ?? primary}
                    variant={t.variant}
                    width={TILE_WIDTH}
                  />
                ))
              )}
            </ScrollView>

            {/* ── History ────────────────────────────────────────────────────── */}
            <View style={{ paddingTop: space.xxl }}>
              <SectionHeader title="Requests" />
            </View>

            {/* A rail, not a wrapped row: five statuses at 360dp would break onto a
            second line and push the list a chip-height further down. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.screen,
                gap: space.sm,
                paddingBottom: space.lg,
              }}
            >
              {FILTERS.map((f) => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  count={counts[f.key] ?? 0}
                  active={status === f.key}
                  tone={f.tone}
                  onPress={() => setStatus(f.key)}
                />
              ))}
            </ScrollView>

            {isLoading ? (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                <Skeleton height={150} radius={radius.card - 4} />
                <Skeleton height={150} radius={radius.card - 4} />
                <Skeleton height={150} radius={radius.card - 4} />
              </View>
            ) : error ? (
              <EmptyState
                icon={
                  <TriangleAlert
                    size={32}
                    strokeWidth={1.6}
                    color={brand[600]}
                  />
                }
                title="Could not load your leave"
                message={describeApiError(error).title}
                actionLabel="Try again"
                onAction={() => {
                  refetch();
                  balance.refetch();
                }}
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={
                  <ClipboardList
                    size={32}
                    strokeWidth={1.6}
                    color={brand[600]}
                  />
                }
                title={
                  status === "all"
                    ? "No leave in this period"
                    : `Nothing ${status} here`
                }
                message={
                  status === "all"
                    ? `Every request you apply for in ${period} shows up here with its approval trail.`
                    : `No ${status} requests in ${period}. Try another status or period.`
                }
                actionLabel={status === "all" ? "Apply for leave" : "Show all"}
                onAction={
                  status === "all"
                    ? () => navigation.navigate("LeaveApply")
                    : () => setStatus("all")
                }
              />
            ) : (
              <View style={{ gap: space.xl }}>
                {groups.map((g) => (
                  <View key={g.key} style={{ gap: space.md }}>
                    {g.key >= 0 ? (
                      <Text
                        style={{
                          color: c.textFaint,
                          paddingHorizontal: space.screen,
                        }}
                        className={`uppercase ${T.micro}`}
                      >
                        {MONTHS_LONG[g.key]}
                      </Text>
                    ) : null}

                    <View
                      style={{ paddingHorizontal: space.screen, gap: space.md }}
                    >
                      {g.items.map((l) => (
                        <LeaveCard
                          key={l._id}
                          leave={l}
                          busy={cancelling && confirm?._id === l._id}
                          onWithdraw={
                            l.status === "pending"
                              ? () => setConfirm(l)
                              : undefined
                          }
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky primary action — the only "apply" affordance on the screen now.
          A header + button, a FAB and a nav slot were three ways to reach one
          form. */}
      <Pressable
        onPress={() => navigation.navigate("LeaveApply")}
        accessibilityRole="button"
        accessibilityLabel="Apply for leave"
        style={({ pressed }) => ({
          position: "absolute",
          right: space.screen,
          bottom: insets.bottom + BOTTOM_NAV_CLEARANCE,
          height: 52,
          backgroundColor: brand[600],
          borderRadius: radius.pill,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          ...shadow.floating,
        })}
        className="flex-row items-center gap-2 px-5"
      >
        <Plus size={20} strokeWidth={2.4} color="#FFFFFF" />
        <Text className="font-ui-semibold text-[14.5px] text-white">Leave</Text>
      </Pressable>

      {/* No tab of its own — Leave is reached from the rail and the drawer, so
          nothing in the bar should light up while you are here. */}
      <BottomNav active={null} onSelect={go} />

      {/* ── Withdraw confirmation ────────────────────────────────────────
          Withdrawing is irreversible and returns days to the balance — a tap
          away from a scrolling list is not enough of a gate for that. The
          summary restates WHICH request, because the list scrolled out of view
          the moment the sheet came up. */}
      <ConfirmSheet
        visible={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm ? withdraw(confirm) : undefined)}
        tone="danger"
        icon={TriangleAlert}
        title="Withdraw this request?"
        message="This cancels the request for good. You can always apply again."
        confirmLabel="Yes, withdraw"
        cancelLabel="No, keep it"
        loading={cancelling}
        detail={
          confirm ? (
            <>
              <ConfirmStat
                label="Type"
                value={TYPE_LABEL[confirm.type] ?? confirm.type}
              />
              <ConfirmDivider />
              <ConfirmStat
                label="Dates"
                value={
                  confirm.from_date === confirm.to_date
                    ? fmtDayShort(confirm.from_date)
                    : `${fmtDayShort(confirm.from_date)} → ${fmtDayShort(confirm.to_date)}`
                }
              />
              <ConfirmDivider />
              <ConfirmStat
                label="Days"
                value={`${confirm.days} ${confirm.days === 1 ? "day" : "days"}`}
              />
            </>
          ) : null
        }
      />

      {/* ── Month picker ─────────────────────────────────────────────────
          A 3-across grid, not a strip of thirteen chips to scroll past: twelve
          months are a shape everyone already knows. */}
      <BottomSheet
        visible={monthOpen}
        onClose={() => setMonthOpen(false)}
        maxHeightRatio={0.62}
      >
        <View style={{ padding: space.screen }}>
          <Text style={{ color: c.text }} className={T.section}>
            Filter by month
          </Text>

          <View className="mt-3 flex-row flex-wrap" style={{ gap: space.sm }}>
            {[null, ...MONTHS.map((_, i) => i)].map((m) => {
              const active = m === month;
              const label = m === null ? "All" : MONTHS[m];

              return (
                <Pressable
                  key={label}
                  onPress={() => {
                    setMonth(m);
                    setMonthOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    width: "31%",
                    backgroundColor: active ? tint.bg : c.fill,
                    borderRadius: radius.well,
                    borderWidth: 1,
                    borderColor: active ? brand[600] : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                  className="items-center py-3.5"
                >
                  <Text
                    style={{ color: active ? brand[700] : c.text }}
                    className={T.cardTitleSm}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>

      {/* ── Year picker ──────────────────────────────────────────────────── */}
      <BottomSheet
        visible={yearOpen}
        onClose={() => setYearOpen(false)}
        maxHeightRatio={0.5}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text style={{ color: c.text }} className={T.section}>
            Select year
          </Text>
          {years.map((y) => {
            const active = y === year;
            return (
              <Pressable
                key={y}
                onPress={() => {
                  setYear(y);
                  setYearOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  backgroundColor: active ? tint.bg : c.fill,
                  borderRadius: radius.well,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="h-12 flex-row items-center justify-between px-4"
              >
                <Text
                  style={{ color: active ? brand[700] : c.text }}
                  className={T.cardTitleSm}
                >
                  {y}
                </Text>
                {active ? (
                  <Check size={18} strokeWidth={2.6} color={brand[700]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
