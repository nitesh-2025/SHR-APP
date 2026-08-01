import { useNavigation } from "@react-navigation/native";
import {
  CalendarDays,
  CalendarX,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  MapPin,
  PenLine,
  Smartphone,
  Timer,
  TimerReset,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { RegularizeSheet } from "../components/RegularizeSheet";
import { Badge, EmptyState, Segmented, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import {
  useGetMyHistoryQuery,
  type AttendanceRecord,
  type AttendanceStatus,
  type Punch,
} from "../store/attendanceApi";
import { radius, shadow, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import {
  fmtDuration,
  fmtTime,
  monthRange,
  MONTHS,
  MONTHS_LONG,
  parseYmd,
  WEEKDAYS_LONG,
  ymd,
} from "../utils/date";

/**
 * List is the RECORD — every day that happened, newest first.
 * Roster is the CALENDAR — the same month seen as a grid.
 */
type View$ = "list" | "roster";

/** Day-cell meaning. `none` = nothing recorded (weekend, holiday, future). */
type DayKind = "present" | "late" | "absent" | "leave" | "holiday" | "none";

const KIND_TONE: Record<Exclude<DayKind, "none">, Surface> = {
  present: surface.success,
  late: surface.warning,
  absent: surface.danger,
  leave: surface.purple,
  holiday: surface.info,
};

const LEGEND: [string, Surface][] = [
  ["Present", surface.success],
  ["Late", surface.warning],
  ["Absent", surface.danger],
  ["Leave", surface.purple],
  ["Holiday", surface.info],
];

const STATUS_TONE: Record<AttendanceStatus, { label: string; tone: Surface }> =
  {
    present: { label: "Present", tone: surface.success },
    in_progress: { label: "Running", tone: surface.success },
    half_day: { label: "Half Day", tone: surface.warning },
    absent: { label: "Absent", tone: surface.danger },
  };

/** Years offered in the dropdown, newest first. */
const YEAR_SPAN = 4;

/** Fixed width so the fourth card peeks and the row reads as scrollable. */
const STAT_WIDTH = 132;

/**
 * Where a punch was made, as something a person can read.
 *
 * Prefers the address the server reverse-geocoded; falls back to the raw fix so
 * a punch that has coordinates but no address still says WHERE rather than
 * nothing. Returns null when the punch carries no location at all — there is no
 * "Office" default, because inventing a place is worse than admitting none was
 * recorded.
 */
function placeOf(punch?: Punch): string | null {
  const loc = punch?.location;
  if (!loc) return null;
  if (loc.address?.trim()) return loc.address.trim();
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  }
  return null;
}

/** Google Maps deep link for a punch, or null when there is no fix to open. */
function mapUrlOf(punch?: Punch): string | null {
  const loc = punch?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;
  return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
}

async function openMap(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast.error("Maps open nahi ho paya.");
  }
}

/**
 * A day can only be corrected once it is over.
 *
 * Today, while the clock is still running, has nothing to correct yet — the
 * "missing" clock-out is simply one that has not happened. Offering the button
 * there invites a request that describes a day that is still changing, and the
 * reviewer would be approving a correction to a moving target.
 *
 * A PAST day left open (forgot to clock out) is the opposite case, and the
 * single most common reason to file one — so state alone cannot be the test.
 */
function canRegularize(
  dateKey: string,
  todayKey: string,
  record?: AttendanceRecord,
): boolean {
  if (dateKey > todayKey) return false;
  if (dateKey !== todayKey) return true;
  // Today: only once the day has actually been closed out.
  return Boolean(record) && record?.state === "clocked_out";
}

/* ── Stat card ────────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: Surface;
}) {
  const { c, dark } = useTheme();
  return (
    <View
      style={{
        width: STAT_WIDTH,
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View
        style={{ backgroundColor: tone.tint, borderRadius: radius.well - 4 }}
        className="h-9 w-9 items-center justify-center"
      >
        <Icon size={18} strokeWidth={2.2} color="#FFFFFF" />
      </View>
      <Text
        style={{ color: c.text }}
        className={`mt-3 ${T.kpiSm}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{ color: c.textMuted }}
        className={`mt-0.5 ${T.micro}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── Regularize button ────────────────────────────────────────────────────── */

/** Same affordance on both tabs, so the action is learned once. */
function RegularizeButton({ onPress }: { onPress: () => void }) {
  const { c, brand, primary } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Request a correction for this day"
      style={({ pressed }) => ({
        backgroundColor: primary.bg,
        borderRadius: radius.pill,
        opacity: pressed ? 0.7 : 1,
      })}
      className="flex-row items-center gap-1.5 self-start px-3 py-1.5"
    >
      <PenLine size={13} strokeWidth={2.4} color={brand[600]} />
      <Text style={{ color: brand[700] }} className={T.badge}>
        Regularize
      </Text>
    </Pressable>
  );
}

/* ── Day card ─────────────────────────────────────────────────────────────── */

/**
 * One punch, as a column. In and Out sit SIDE BY SIDE.
 *
 * A day is a span, and a span reads as two ends next to each other — stacked,
 * the pair read as two unrelated facts and the card grew a row taller for
 * nothing.
 */
function PunchCol({
  icon: Icon,
  label,
  time,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  time: string | null;
  tone: Surface;
}) {
  const { c } = useTheme();
  return (
    <View className="flex-1 flex-row items-center gap-2.5">
      <View
        style={{ backgroundColor: tone.bg, borderRadius: radius.well - 6 }}
        className="h-8 w-8 items-center justify-center"
      >
        <Icon size={15} strokeWidth={2.2} color={tone.tint} />
      </View>

      <View className="flex-1">
        <Text
          style={{ color: c.textMuted }}
          className={T.nano}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{ color: time ? c.text : c.textFaint }}
          className={`mt-0.5 ${T.cardTitleSm}`}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {time ?? "—"}
        </Text>
      </View>
    </View>
  );
}

/**
 * Where a punch happened, on its own full-width line.
 *
 * Under the two-column punch row rather than inside a column: an address does
 * not fit in half a phone, and truncating it to "Kat…" defeats the point of
 * having stored it. Rendered only when the server actually stamped a location —
 * a line reading "In · Unknown" looks like data that failed rather than data
 * that was never collected.
 */
function Where({ punch, label }: { punch?: Punch; label: string }) {
  const { c, brand } = useTheme();
  const place = placeOf(punch);
  const mapUrl = mapUrlOf(punch);
  if (!place) return null;

  return (
    <Pressable
      onPress={mapUrl ? () => openMap(mapUrl) : undefined}
      disabled={!mapUrl}
      accessibilityRole={mapUrl ? "link" : "text"}
      accessibilityLabel={`${label} location: ${place}`}
      accessibilityHint={mapUrl ? "Opens in Maps" : undefined}
      style={({ pressed }) => ({ opacity: pressed && mapUrl ? 0.6 : 1 })}
      className="mt-2 flex-row items-start gap-1.5"
    >
      <MapPin
        size={11}
        strokeWidth={2}
        color={mapUrl ? brand[600] : c.textFaint}
        style={{ marginTop: 2 }}
      />
      <Text style={{ color: c.textFaint }} className={T.micro}>
        {label}
      </Text>
      <Text
        style={{ color: mapUrl ? brand[700] : c.textMuted }}
        className={`flex-1 ${T.micro}`}
        numberOfLines={1}
      >
        {place}
      </Text>
    </Pressable>
  );
}

/** A totals figure in the card's footer strip. */
function Total({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-1">
      <Text style={{ color: c.textMuted }} className={T.nano}>
        {label}
      </Text>
      <Text
        style={{ color: c.text }}
        className={`mt-0.5 ${T.cardTitleSm}`}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * One day, as a card.
 *
 * Laid out the way the day happened rather than as a grid of figures: a date
 * block to anchor it, the two punches as their own rows with room for a real
 * address under each, then the totals, then anything that went wrong.
 *
 * The four-column version squeezed "Clock In / Clock Out / Break / Work Hrs"
 * into ~78px each on a 360dp screen, which left every value truncated and the
 * addresses with nowhere to live.
 */
function DayCard({
  record,
  onRegularize,
}: {
  record: AttendanceRecord;
  /** Omitted while the day is still running — see `canRegularize`. */
  onRegularize?: () => void;
}) {
  const { c, dark } = useTheme();
  const date = parseYmd(record.date);
  const status = STATUS_TONE[record.status] ?? STATUS_TONE.absent;
  const absent = record.status === "absent";
  const hasFlags = record.is_late || record.is_manual;

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
      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: c.fill, borderRadius: radius.well - 2 }}
          className="h-12 w-12 items-center justify-center"
        >
          <Text
            style={{ color: c.text }}
            className={T.cardTitle}
            allowFontScaling={false}
          >
            {date ? date.getDate() : "--"}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={T.nano}
            allowFontScaling={false}
          >
            {date ? MONTHS[date.getMonth()] : ""}
          </Text>
        </View>

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.cardTitleSm}
            numberOfLines={1}
          >
            {date ? WEEKDAYS_LONG[date.getDay()] : record.date}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {absent
              ? "No attendance"
              : `${fmtDuration(record.total_work_minutes)} worked`}
          </Text>
        </View>

        <Badge label={status.label} tone={status.tone} />
      </View>

      {absent ? (
        <Text style={{ color: c.textMuted }} className={`mt-3 ${T.secondary}`}>
          No punches were recorded for this day.
        </Text>
      ) : (
        <>
          <View style={{ backgroundColor: c.border }} className="my-3 h-px" />

          <View className="flex-row items-center gap-3">
            <PunchCol
              icon={LogIn}
              label="Clock In"
              time={fmtTime(record.clock_in?.at)}
              tone={surface.success}
            />
            <PunchCol
              icon={LogOut}
              label="Clock Out"
              time={fmtTime(record.clock_out?.at)}
              tone={surface.danger}
            />
          </View>

          <Where punch={record.clock_in} label="In" />
          <Where punch={record.clock_out} label="Out" />

          {/* Totals sit in their own recessed strip — they are derived from the
              punches above, and the inset says so. */}
          <View
            style={{
              backgroundColor: c.fill,
              borderRadius: radius.well - 4,
              paddingHorizontal: space.md,
              paddingVertical: space.sm + 2,
            }}
            className="mt-3 flex-row items-center gap-3"
          >
            <Total
              label="Break"
              value={fmtDuration(record.total_break_minutes ?? 0)}
            />
            <View style={{ backgroundColor: c.border }} className="h-7 w-px" />
            <Total
              label="Worked"
              value={fmtDuration(record.total_work_minutes)}
            />
          </View>
        </>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────
          Exceptions only when there ARE any — a row of "no problem" chips on
          every card would bury the days that have one. */}
      {hasFlags || onRegularize ? (
        <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
          <View
            className="flex-row flex-wrap items-center"
            style={{ gap: space.sm }}
          >
            {record.is_late ? (
              <Badge
                label={`Late by ${fmtDuration(record.late_by_minutes)}`}
                tone={surface.warning}
              />
            ) : null}
            {record.is_manual ? (
              <Badge
                label={`Approved${record.marked_by_name ? ` · ${record.marked_by_name}` : ""}`}
                tone={surface.info}
                icon={
                  <Check size={11} strokeWidth={3} color={surface.info.tint} />
                }
              />
            ) : null}
          </View>

          {onRegularize ? <RegularizeButton onPress={onRegularize} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ── Tab pane ─────────────────────────────────────────────────────────────── */

/**
 * One tab's content. No transition — the switch is instant.
 *
 * A cross-fade was here and has been removed on purpose: on a screen already
 * waiting on the network, 240ms of animation is 240ms before the content can be
 * read, and the fade made a slow tab feel slower rather than smoother.
 *
 * `display: 'none'` rather than unmounting, so each tab keeps its scroll
 * position and its rendered rows.
 */
function TabPane({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ flex: 1, display: active ? "flex" : "none" }}>
      {children}
    </View>
  );
}

/* ── Range chip ───────────────────────────────────────────────────────────── */

/** The month / year dropdown trigger in the header. */
function RangeChip({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  const { brand, primary } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        backgroundColor: primary.bg,
        borderRadius: radius.pill,
        opacity: pressed ? 0.75 : 1,
      })}
      className="h-9 flex-row items-center gap-1 px-3"
    >
      <Text
        style={{ color: brand[700] }}
        className={T.badge}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
      <ChevronDown size={14} strokeWidth={2.6} color={brand[700]} />
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My attendance, a year at a time.
 *
 * ONE request for the whole year: the list, the calendar and the stats are
 * three readings of the same set, so fetching per-month would have meant three
 * round trips to say one thing. The month filter then runs on the client, where
 * it is instant and costs nothing.
 */
export default function AttendanceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, primary } = useTheme();

  const today = new Date();
  const todayKey = ymd(today);
  const [year, setYear] = useState(today.getFullYear());
  const [view, setView] = useState<View$>("list");
  /** Tabs mounted so far — the other one waits until it is asked for. */
  const [visited, setVisited] = useState<Set<View$>>(
    () => new Set<View$>(["list"]),
  );

  /**
   * `null` = the whole year, but the list opens on the CURRENT month.
   *
   * Opening on "All" meant the first thing anyone saw was a year of cards they
   * had to scroll past to reach this week. The month you are in is the one you
   * came to look at; the rest is a filter away.
   */
  const [month, setMonth] = useState<number | null>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(today));

  /**
   * The calendar draws whatever month the list is filtered to.
   *
   * These used to be two independent states, which meant the screen had to hold
   * a whole YEAR in memory so either could be satisfied. One month, one fetch,
   * and the two tabs can never disagree about which month you are looking at.
   */
  const gridMonth = month ?? today.getMonth();

  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  /** Empty while closed — the sheet regularises exactly one date. */
  const [regularizeDate, setRegularizeDate] = useState("");

  /**
   * Ask for the month on screen, not the year around it.
   *
   * A year at `limit: 400` is ~365 records on every open, and the screen only
   * ever draws one month of them. RTK Query caches per-argument, so stepping to
   * a month you have already seen is instant and stepping to a new one costs
   * about thirty rows instead of four hundred.
   */
  const range = useMemo(() => monthRange(year, month), [year, month]);
  const { data, isLoading, isFetching, error, refetch } = useGetMyHistoryQuery({
    ...range,
    limit: month === null ? 400 : 40,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of items) map.set(r.date, r);
    return map;
  }, [items]);

  // Newest first — a list of days reads backwards from today, not forwards
  // from January. The server already scoped the range, so there is nothing left
  // to filter here.
  const listItems = useMemo(
    () => [...items].sort((a, b) => b.date.localeCompare(a.date)),
    [items],
  );

  // Stats follow whatever the list is showing, so the numbers always describe
  // the rows underneath them.
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let minutes = 0;
    for (const r of listItems) {
      if (r.status === "present" || r.status === "in_progress") present += 1;
      else if (r.status === "half_day") present += 0.5;
      else if (r.status === "absent") absent += 1;
      if (r.is_late) late += 1;
      minutes += r.total_work_minutes ?? 0;
    }
    return { present, late, absent, minutes };
  }, [listItems]);

  const cells = useMemo(() => {
    const first = new Date(year, gridMonth, 1);
    const days = new Date(year, gridMonth + 1, 0).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  }, [year, gridMonth]);

  const kindOf = (record?: AttendanceRecord): DayKind => {
    if (!record) return "none";
    if (record.status === "absent") return "absent";
    if (record.is_late || record.status === "half_day") return "late";
    return "present";
  };

  const selected = selectedDay ? byDate.get(selectedDay) : undefined;
  const selectedDate = parseYmd(selectedDay ?? undefined);
  const selectedStatus = selected
    ? (STATUS_TONE[selected.status] ?? STATUS_TONE.absent)
    : null;

  const years = Array.from(
    { length: YEAR_SPAN },
    (_, i) => today.getFullYear() - i,
  );

  const stepMonth = (delta: number) => {
    const next = gridMonth + delta;
    if (next < 0 || next > 11) return;
    setMonth(next);
  };

  const refresher = (
    <RefreshControl
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      tintColor={brand[600]}
    />
  );

  const bottomPad = insets.bottom + BOTTOM_NAV_CLEARANCE + 16;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────
          The title is deliberately smaller than a screen heading: it shares
          the row with controls, and at 28px it pushed them off a 360dp screen. */}
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
            My Attendance
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={T.caption}
            numberOfLines={1}
          >
            {listItems.length} {listItems.length === 1 ? "day" : "days"}{" "}
            recorded
          </Text>
        </View>

        {/* Month sits to the LEFT of year — narrowing reads outer-to-inner.
            The calendar has its own stepper, so the chips are List-only. */}
        {view === "list" ? (
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
        ) : (
          <RangeChip
            label={String(year)}
            a11y={`Year ${year}. Change year`}
            onPress={() => setYearOpen(true)}
          />
        )}
      </View>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: space.screen,
          gap: space.md,
          paddingBottom: space.lg,
        }}
      >
        <Segmented<View$>
          segments={[
            { key: "list", label: "List" },
            { key: "roster", label: "Roster" },
          ]}
          value={view}
          onChange={(next) => {
            setView(next);
            setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
          }}
        />
      </View>

      {/* ── Panes ────────────────────────────────────────────────────────── */}
      <View className="flex-1">
        {/* ── List ───────────────────────────────────────────────────────── */}
        <TabPane active={view === "list"}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            refreshControl={refresher}
          >
            {/* Stats — a scrolling rail, not a squeezed row: a fourth stat at
                flex-1 would be narrower than its own icon. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.screen,
                gap: space.md,
                paddingBottom: space.xl,
              }}
            >
              {isLoading ? (
                <>
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card - 4}
                  />
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card - 4}
                  />
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card - 4}
                  />
                </>
              ) : (
                <>
                  <StatCard
                    icon={Timer}
                    value={String(stats.present).padStart(2, "0")}
                    label="Days Present"
                    tone={surface.success}
                  />
                  <StatCard
                    icon={TimerReset}
                    value={String(stats.late).padStart(2, "0")}
                    label="Late Arrivals"
                    tone={surface.warning}
                  />
                  <StatCard
                    icon={CalendarX}
                    value={String(stats.absent).padStart(2, "0")}
                    label="Days Absent"
                    tone={surface.danger}
                  />
                  <StatCard
                    icon={CalendarDays}
                    value={fmtDuration(stats.minutes)}
                    label="Total Worked"
                    tone={surface.purple}
                  />
                </>
              )}
            </ScrollView>

            {isLoading ? (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                <Skeleton height={150} radius={radius.card - 4} />
                <Skeleton height={150} radius={radius.card - 4} />
                <Skeleton height={150} radius={radius.card - 4} />
              </View>
            ) : listItems.length === 0 ? (
              <EmptyState
                icon={
                  <CalendarDays
                    size={32}
                    strokeWidth={1.6}
                    color={brand[600]}
                  />
                }
                title="No attendance yet"
                message={
                  error
                    ? describeApiError(error).title
                    : `Nothing recorded in ${
                        month === null ? year : `${MONTHS_LONG[month]} ${year}`
                      }.`
                }
              />
            ) : (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                {listItems.map((r) => (
                  <DayCard
                    key={r._id}
                    record={r}
                    onRegularize={
                      canRegularize(r.date, todayKey, r)
                        ? () => setRegularizeDate(r.date)
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </TabPane>

        {/* ── Roster (calendar) ──────────────────────────────────────────── */}
        {visited.has("roster") ? (
          <TabPane active={view === "roster"}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: bottomPad }}
              showsVerticalScrollIndicator={false}
              refreshControl={refresher}
            >
              <View style={{ paddingHorizontal: space.screen }}>
                {/* Month stepper. A strip of twelve chips to move the grid by
                    one was a lot of control for one small job. */}
                <View className="flex-row items-center justify-between pb-4">
                  <Pressable
                    onPress={() => stepMonth(-1)}
                    disabled={gridMonth === 0}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    style={({ pressed }) => ({
                      opacity: gridMonth === 0 ? 0.3 : pressed ? 0.6 : 1,
                    })}
                    className="h-9 w-9 items-center justify-center"
                  >
                    <ChevronLeft size={20} strokeWidth={2.2} color={c.text} />
                  </Pressable>

                  <Text style={{ color: c.text }} className={T.cardTitle}>
                    {MONTHS_LONG[gridMonth]} {year}
                  </Text>

                  <Pressable
                    onPress={() => stepMonth(1)}
                    disabled={gridMonth === 11}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    style={({ pressed }) => ({
                      opacity: gridMonth === 11 ? 0.3 : pressed ? 0.6 : 1,
                    })}
                    className="h-9 w-9 items-center justify-center"
                  >
                    <ChevronRight size={20} strokeWidth={2.2} color={c.text} />
                  </Pressable>
                </View>

                <View className="flex-row pb-3">
                  {WEEKDAYS_LONG.map((d) => (
                    <Text
                      key={d}
                      style={{ color: c.textFaint }}
                      className={`flex-1 text-center uppercase ${T.nano}`}
                    >
                      {d.slice(0, 3)}
                    </Text>
                  ))}
                </View>

                <View className="flex-row flex-wrap">
                  {cells.map((day, i) => {
                    if (day === null) {
                      return (
                        <View
                          key={`blank-${i}`}
                          style={{ width: "14.28%", height: 46 }}
                        />
                      );
                    }
                    const key = ymd(new Date(year, gridMonth, day));
                    const record = byDate.get(key);
                    const kind = kindOf(record);
                    const isSelected = key === selectedDay;
                    const isToday = key === ymd(today);

                    return (
                      <Pressable
                        key={day}
                        onPress={() => setSelectedDay(key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${day} ${MONTHS[gridMonth]}`}
                        accessibilityState={{ selected: isSelected }}
                        style={({ pressed }) => ({
                          width: "14.28%",
                          height: 46,
                          opacity: pressed ? 0.6 : 1,
                        })}
                        className="items-center justify-center"
                      >
                        {/* The ring marks today / the selection; the DOT below
                            carries the day's status, so the two never compete
                            for the same colour. */}
                        <View
                          style={{
                            borderWidth: isSelected || isToday ? 1.5 : 0,
                            borderColor: isSelected ? brand[600] : c.border,
                          }}
                          className="h-9 w-9 items-center justify-center rounded-full"
                        >
                          <Text
                            style={{ color: record ? c.text : c.textFaint }}
                            className={T.body}
                          >
                            {day}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor:
                              kind === "none"
                                ? "transparent"
                                : KIND_TONE[kind].tint,
                          }}
                          className="mt-1 h-1.5 w-1.5 rounded-full"
                        />
                      </Pressable>
                    );
                  })}
                </View>

                {/* A colour-coded grid is only readable with a key. */}
                <View
                  className="flex-row flex-wrap justify-center"
                  style={{ gap: space.md, marginTop: space.lg }}
                >
                  {LEGEND.map(([label, tone]) => (
                    <View key={label} className="flex-row items-center gap-1.5">
                      <View
                        style={{ backgroundColor: tone.tint }}
                        className="h-1.5 w-1.5 rounded-full"
                      />
                      <Text style={{ color: c.textMuted }} className={T.micro}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Selected day ─────────────────────────────────────────── */}
              <View
                style={{ marginTop: space.xl, paddingHorizontal: space.screen }}
              >
                {/* Flat: a hairline and the standard radius, no lift. It is the
                    only card on this tab, with nothing beside it to be raised
                    above — a shadow here just fuzzes its edge. */}
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: space.lg,
                    ...shadow.none,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: c.text }} className={T.cardTitleSm}>
                      {selectedDate
                        ? `${WEEKDAYS_LONG[selectedDate.getDay()].slice(0, 3)}, ${selectedDate.getDate()} ${
                            MONTHS_LONG[selectedDate.getMonth()]
                          }`
                        : "Select a day"}
                    </Text>
                    {selectedStatus ? (
                      <Badge
                        label={selectedStatus.label}
                        tone={selectedStatus.tone}
                      />
                    ) : null}
                  </View>

                  {selected ? (
                    <>
                      <View
                        style={{ backgroundColor: c.border }}
                        className="my-3 h-px"
                      />

                      {/* Same anatomy as the List card — one day should not
                          read two different ways depending on which tab found
                          it. */}
                      <View className="flex-row items-center gap-3">
                        <PunchCol
                          icon={LogIn}
                          label="Clock In"
                          time={fmtTime(selected.clock_in?.at)}
                          tone={surface.success}
                        />
                        <PunchCol
                          icon={LogOut}
                          label="Clock Out"
                          time={fmtTime(selected.clock_out?.at)}
                          tone={surface.danger}
                        />
                      </View>

                      <Where punch={selected.clock_in} label="In" />
                      <Where punch={selected.clock_out} label="Out" />

                      <View
                        style={{
                          backgroundColor: c.fill,
                          borderRadius: radius.well - 4,
                          paddingHorizontal: space.md,
                          paddingVertical: space.sm + 2,
                        }}
                        className="mt-3 flex-row items-center gap-3"
                      >
                        <Total
                          label="Break"
                          value={fmtDuration(selected.total_break_minutes ?? 0)}
                        />
                        <View
                          style={{ backgroundColor: c.border }}
                          className="h-7 w-px"
                        />
                        <Total
                          label="Worked"
                          value={fmtDuration(selected.total_work_minutes)}
                        />
                      </View>

                      <View className="mt-3 flex-row items-center gap-1.5">
                        <Smartphone
                          size={12}
                          strokeWidth={2}
                          color={c.textFaint}
                        />
                        <Text
                          style={{ color: c.textFaint }}
                          className={T.micro}
                        >
                          {selected.clock_in?.application ||
                            selected.clock_in?.device_info ||
                            "Unknown device"}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text
                      style={{ color: c.textMuted }}
                      className={`mt-2 ${T.secondary}`}
                    >
                      No attendance recorded on this day.
                    </Text>
                  )}

                  {selectedDay &&
                  canRegularize(selectedDay, todayKey, selected) ? (
                    <View className="mt-4">
                      <RegularizeButton
                        onPress={() => setRegularizeDate(selectedDay)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          </TabPane>
        ) : null}
      </View>

      <BottomNav
        active="attendance"
        onSelect={(key) => {
          if (key === "home") navigation.goBack();
          else if (key === "leaves") navigation.navigate("Leave" as never);
          else if (key === "apply") navigation.navigate("LeaveApply" as never);
          else if (key === "profile") navigation.navigate("Profile" as never);
        }}
      />

      <RegularizeSheet
        visible={Boolean(regularizeDate)}
        date={regularizeDate}
        onClose={() => setRegularizeDate("")}
      />

      {/* ── Month picker ─────────────────────────────────────────────────── */}
      <BottomSheet
        visible={monthOpen}
        onClose={() => setMonthOpen(false)}
        maxHeightRatio={0.62}
      >
        <View style={{ padding: space.screen }}>
          <Text style={{ color: c.text }} className={T.section}>
            Filter by month
          </Text>

          {/* A 3-across grid, not a 13-row list: twelve months are a shape
              everyone already knows, and scrolling past them to reach December
              is work the grid does not ask for.

              No per-month record count any more — the screen fetches one month
              at a time, so it has no honest way to know what the other eleven
              hold. A number that is only right for the month you are already on
              is worse than no number. */}
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
                    backgroundColor: active ? primary.bg : c.fill,
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
                  backgroundColor: active ? primary.bg : c.fill,
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
