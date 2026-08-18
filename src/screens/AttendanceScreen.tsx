import { useNavigation } from "@react-navigation/native";
import {
  CalendarDays,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  EllipsisVertical,
  List as ListIcon,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
  PartyPopper,
  PenLine,
  Plane,
  Timer,
  TimerReset,
  UserRound,
  X,
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
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { MaskedText } from "../components/MaskedText";
import { RegularizeSheet } from "../components/RegularizeSheet";
import { Badge, EmptyState, RangeChip, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import {
  useGetMyHistoryQuery,
  useGetMyRegularizationsQuery,
  type AttendanceRecord,
  type Punch,
  type Regularization,
  type RegularizationStatus,
  type RegularizationType,
} from "../store/attendanceApi";
import { useGetMyLeaveCalendarQuery, LEAVE_TYPE_LABEL } from "../store/leaveApi";
import {
  useGetHolidaysQuery,
  useGetWorkCalendarConfigQuery,
} from "../store/workCalendarApi";
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
  buildDayRows,
  summarise,
  type DayKind,
  type DayRow,
} from "../utils/attendanceDays";
import {
  fmtDayShort,
  fmtDuration,
  fmtTime,
  monthRange,
  MONTHS,
  MONTHS_LONG,
  WEEKDAYS_LONG,
  ymd,
} from "../utils/date";
import { resolveHolidays } from "../utils/holidays";

/**
 * List is the RECORD — every day that happened, newest first.
 * Roster is the CALENDAR — the same month seen as a grid.
 */
type View$ = "list" | "roster" | "requests";

/**
 * The three views, as menu rows.
 *
 * Single source for the overflow menu AND the header subtitle, so the label you
 * pick is the label you then see under the title.
 */
const VIEWS: {
  key: View$;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    key: "list",
    label: "List",
    hint: "Every day, newest first",
    icon: ListIcon,
  },
  {
    key: "roster",
    label: "Roster",
    hint: "The month as a calendar",
    icon: CalendarDays,
  },
  {
    key: "requests",
    label: "Requests",
    hint: "Regularizations you raised",
    icon: PenLine,
  },
];

/* ── Regularization requests ──────────────────────────────────────────────── */

const REG_TYPE_LABEL: Record<RegularizationType, string> = {
  missing_clock_in: "Missing clock in",
  missing_clock_out: "Missing clock out",
  late_waiver: "Late waiver",
  wrong_time: "Wrong time",
  on_duty: "On duty",
  work_from_home: "Work from home",
};

const REG_STATUS: Record<
  RegularizationStatus,
  { label: string; tone: Surface; icon: LucideIcon }
> = {
  pending: { label: "Pending", tone: surface.warning, icon: Clock3 },
  approved: { label: "Approved", tone: surface.success, icon: Check },
  rejected: { label: "Rejected", tone: surface.danger, icon: X },
};

/**
 * One regularization I raised, and what came of it.
 *
 * `getMyRegularizations` was never called anywhere before this: the sheet could
 * POST a request and then it vanished — no record that it was sent, and no way
 * to learn it had been approved or rejected. A request you cannot track is
 * indistinguishable from one that failed to send.
 */
function RegularizationCard({
  expanded,
  onToggle,
  item,
  index,
}: {
  expanded: boolean;
  onToggle: () => void;
  item: Regularization;
  index: number;
}) {
  const { c, dark } = useTheme();
  const still = useReducedMotion();

  const spec = REG_STATUS[item.status] ?? REG_STATUS.pending;
  const tone = toneFor(spec.tone, dark);
  const Icon = spec.icon;

  return (
    <Pressable onPress={onToggle} accessibilityRole="button">
      <Animated.View
        entering={
          still
            ? undefined
            : FadeInDown.delay(Math.min(index, 6) * 40)
                .duration(240)
                .easing(Easing.out(Easing.cubic))
        }
        style={{
          backgroundColor: c.card,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: c.border,
          overflow: "hidden",
          ...(dark ? shadow.none : shadow.soft),
        }}
      >
        <View />

        <View style={{ padding: space.lg }}>
          <View className="flex-row items-start">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.card,
                backgroundColor: tone.bg,
                borderWidth: 1,
                borderColor: tone.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={20} strokeWidth={2.1} color={tone.tint} />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  color: c.text,
                  fontSize: 15,
                  fontWeight: "700",
                  letterSpacing: -0.15,
                }}
                numberOfLines={1}
              >
                {REG_TYPE_LABEL[item.type] ?? item.type}
              </Text>

              {/* Date */}
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <CalendarDays size={12} strokeWidth={2} color={c.textFaint} />

                <Text
                  style={{
                    color: c.textMuted,
                    fontSize: 11,
                    fontWeight: "500",
                  }}
                >
                  {fmtDayShort(item.date)}
                </Text>

                {(item.requested_clock_in || item.requested_clock_out) && (
                  <>
                    <View
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: c.textFaint,
                      }}
                    />

                    <Text
                      style={{
                        color: c.textMuted,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {[item.requested_clock_in, item.requested_clock_out]
                        .filter(Boolean)
                        .join(" – ")}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Status */}
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: tone.bg,
                borderWidth: 1,
                borderColor: tone.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: tone.tint,
                }}
              />

              <Text
                style={{
                  color: tone.text,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {spec.label}
              </Text>
            </View>
          </View>

          {/* ── Requested Time ──────────────────────────── */}
          {(item.requested_clock_in || item.requested_clock_out) && (
            <View
              style={{
                marginTop: 14,
                padding: 10,
                borderRadius: radius.card,
                backgroundColor: c.fill,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Clock3 size={15} strokeWidth={2} color={c.textMuted} />

              <View
                style={{
                  flex: 1,
                  marginLeft: 9,
                }}
              >
                <Text
                  style={{
                    color: c.textFaint,
                    fontSize: 9,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Requested time
                </Text>

                <Text
                  style={{
                    color: c.text,
                    fontSize: 12,
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                >
                  {[
                    item.requested_clock_in && `In ${item.requested_clock_in}`,
                    item.requested_clock_out &&
                      `Out ${item.requested_clock_out}`,
                  ]
                    .filter(Boolean)
                    .join("   ·   ")}
                </Text>
              </View>
            </View>
          )}

          {expanded ? (
            <>
              <View style={{ marginTop: 15 }}>
                <Text
                  style={{
                    color: c.textFaint,
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 5,
                  }}
                >
                  Reason
                </Text>

                {/* A reason is free text a reviewer reads — the same place
                    a phone number or an account number gets typed in passing. */}
                <MaskedText
                  value={item.reason}
                  style={{
                    color: c.textMuted,
                    fontSize: 13,
                    lineHeight: 19,
                    fontWeight: "500",
                  }}
                />
              </View>

              {item.status !== "pending" &&
              (item.review_note || item.reviewer_name) ? (
                <View
                  style={{
                    marginTop: 15,
                    padding: 12,
                    borderRadius: radius.card,
                    backgroundColor: tone.bg,
                    borderWidth: 1,
                    borderColor: tone.border,
                  }}
                >
                  <View className="flex-row items-center gap-2">
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: `${tone.tint}18`,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MessageSquareText
                        size={13}
                        strokeWidth={2}
                        color={tone.tint}
                      />
                    </View>

                    <Text
                      style={{
                        color: tone.text,
                        fontSize: 10,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Reviewer note
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: tone.text,
                      fontSize: 12,
                      lineHeight: 18,
                      fontWeight: "500",
                      marginTop: 9,
                    }}
                  >
                    {item.review_note ||
                      `${spec.label} by ${item.reviewer_name}`}
                  </Text>

                  {item.review_note && item.reviewer_name ? (
                    <View
                      className="mt-2 flex-row items-center"
                      style={{ gap: 5 }}
                    >
                      <UserRound
                        size={11}
                        strokeWidth={2}
                        color={c.textFaint}
                      />

                      <Text
                        style={{
                          color: c.textMuted,
                          fontSize: 10,
                        }}
                      >
                        {item.reviewer_name}
                      </Text>

                      {item.reviewed_at ? (
                        <>
                          <View
                            style={{
                              width: 3,
                              height: 3,
                              borderRadius: 2,
                              backgroundColor: c.textFaint,
                            }}
                          />

                          <Text
                            style={{
                              color: c.textMuted,
                              fontSize: 10,
                            }}
                          >
                            {fmtDayShort(item.reviewed_at)}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * What a day means, in one table.
 *
 * The old vocabulary had a `none` kind that stood for "weekend, holiday, or
 * future" — three different facts flattened into one blank cell, which is
 * exactly why the list could not tell an absence from a Sunday. Each reason now
 * has its own kind, its own colour and its own sentence.
 */
const KIND_META: Record<
  DayKind,
  { label: string; tone: Surface; icon: LucideIcon }
> = {
  present: { label: "Present", tone: surface.success, icon: Check },
  late: { label: "Late", tone: surface.warning, icon: Clock3 },
  half_day: { label: "Half day", tone: surface.warning, icon: Timer },
  absent: { label: "Absent", tone: surface.danger, icon: CalendarX },
  leave: { label: "On leave", tone: surface.purple, icon: Plane },
  holiday: { label: "Holiday", tone: surface.info, icon: PartyPopper },
  weekoff: { label: "Week off", tone: surface.neutral, icon: Coffee },
  future: { label: "—", tone: surface.muted, icon: CalendarDays },
};

/** Legend order follows how often a day is each thing, not the enum. */
const LEGEND: DayKind[] = [
  "present",
  "late",
  "absent",
  "leave",
  "holiday",
  "weekoff",
];

/**
 * The one line under the weekday that says what happened.
 *
 * Every kind gets a real sentence — "No attendance" used to be printed for a
 * Sunday as readily as for a genuine absence, which made the list impossible to
 * trust at a glance.
 */
function summaryOf(row: DayRow): string {
  if (row.record && (row.record.clock_in?.at || row.record.status !== "absent")) {
    const worked = fmtDuration(row.record.total_work_minutes);
    return row.record.state === "clocked_out"
      ? `${worked} worked`
      : `${worked} so far`;
  }
  if (row.kind === "leave") {
    const type = row.leave?.type;
    return type ? LEAVE_TYPE_LABEL[type] : "Approved leave";
  }
  if (row.kind === "holiday") return row.holidayName ?? "Company holiday";
  if (row.kind === "weekoff") return "Weekly off";
  return "Nothing was recorded";
}

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
function canRegularize(row: DayRow, todayKey: string): boolean {
  if (row.key > todayKey) return false;
  if (row.key !== todayKey) return true;
  // Today: only once the day has actually been closed out.
  return row.record?.state === "clocked_out";
}

/**
 * Which request type the sheet should open on for this day.
 *
 * A guess, not a decision — every option stays selectable. But the guess
 * matters: on an absent day the reviewer needs a clock-IN, and on a holiday or
 * a weekly off the honest request is "I was on duty", neither of which is the
 * "forgot to clock out" the sheet used to default to for every single day.
 */
function suggestedType(row: DayRow): RegularizationType {
  if (row.kind === "absent") return "missing_clock_in";
  if (row.kind === "holiday" || row.kind === "weekoff") return "on_duty";
  if (row.record && !row.record.clock_out?.at) return "missing_clock_out";
  if (row.record?.is_late) return "late_waiver";
  return "missing_clock_out";
}

/**
 * What the correction button should SAY on this day.
 *
 * A missing punch and a Sunday you actually worked are both regularizations,
 * but they are not the same request, and one label for both leaves the reader
 * guessing whether the button even applies to them.
 */
function regularizeLabel(row: DayRow): string {
  if (row.kind === "absent") return "Mark my attendance";
  if (row.kind === "holiday" || row.kind === "weekoff") return "I worked this day";
  return "Regularize";
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
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View
        style={{ backgroundColor: tone.tint, borderRadius: radius.well }}
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

/* ── Stat card ────────────────────────────────────────────────────────────── */

function StatCardInline({
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
      className="flex-row items-center"
      style={{
        width: STAT_WIDTH,
        backgroundColor: c.card,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      {/* Icon */}
      <View
        className="items-center justify-center"
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.card,
          backgroundColor: tone.tint,
        }}
      >
        <Icon size={20} color={(tone as any).icon} strokeWidth={2.2} />
      </View>

      {/* Text */}
      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className={T.kpiSm}
          style={{
            color: c.text,
            fontWeight: "700",
          }}
        >
          {value}
        </Text>

        <Text
          numberOfLines={1}
          className={T.micro}
          style={{
            color: c.textMuted,
            marginTop: 2,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/* ── Regularize button ────────────────────────────────────────────────────── */

/** Same affordance on both tabs, so the action is learned once. */
function RegularizeButton({
  onPress,
  label = "Regularize",
}: {
  onPress: () => void;
  label?: string;
}) {
  const { brand, tint } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Request a correction for this day`}
      style={({ pressed }) => ({
        backgroundColor: tint.bg,
        borderRadius: radius.pill,
        opacity: pressed ? 0.7 : 1,
      })}
      className="flex-row items-center gap-1.5 self-start px-3 py-1.5"
    >
      <PenLine size={13} strokeWidth={2.4} color={brand[600]} />
      <Text style={{ color: brand[700] }} className={T.badge}>
        {label}
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
  const { c, dark } = useTheme();

  // Green for In, red for Out — that pairing is the only thing distinguishing
  // the two columns at a glance, so the well is re-mixed for the dark canvas
  // rather than dropped to a neutral fill.
  const well = toneFor(tone, dark);

  return (
    <View className="flex-1 flex-row items-center gap-2.5">
      <View
        style={{ backgroundColor: well.bg, borderRadius: radius.well }}
        className="h-8 w-8 items-center justify-center"
      >
        <Icon size={15} strokeWidth={2.2} color={well.tint} />
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
 * One DAY, whatever happened on it.
 *
 * This used to take an `AttendanceRecord`, which is why the list could only
 * ever show days the server had a row for: an absence, a Sunday, a holiday and
 * a day on approved leave all produce NO record, so all four were invisible —
 * and an invisible day cannot be tapped, expanded, or regularized. It now takes
 * a calendar row instead, and the record is just one of the things that row may
 * carry.
 */
function DayCard({
  row,
  expanded,
  onToggle,
  onRegularize,
}: {
  row: DayRow;
  expanded: boolean;
  onToggle: () => void;
  onRegularize?: () => void;
}) {
  const { c, dark } = useTheme();
  const record = row.record;
  const meta = KIND_META[row.kind];
  const tone = toneFor(meta.tone, dark);
  const date = row.date;
  const punched = Boolean(record?.clock_in?.at || record?.clock_out?.at);
  const hasFlags = Boolean(record?.is_late || record?.is_manual);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${
        MONTHS[date.getMonth()]
      }. ${meta.label}. ${summaryOf(row)}`}
    >
      <View
        style={{
          backgroundColor: c.card,
          borderWidth: 1,
          borderRadius: 4,
          borderColor: c.border,
          // A left edge in the day's colour. The badge alone sits at the far
          // right of a 360dp row, so a column of days could not be skimmed for
          // "which ones went wrong" without reading every line to its end.
          borderLeftWidth: 3,
          borderLeftColor: row.kind === "future" ? c.border : tone.tint,
          padding: space.lg,
          ...(dark ? shadow.none : shadow.soft),
        }}
      >
        {/* ── Head ─────────────────────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3">
          <View
            style={{
              backgroundColor: row.isToday ? tone.bg : c.fill,
              borderRadius: radius.well,
              borderWidth: row.isToday ? 1 : 0,
              borderColor: tone.border,
            }}
            className="h-12 w-12 items-center justify-center"
          >
            <Text
              style={{ color: c.text }}
              className={T.cardTitle}
              allowFontScaling={false}
            >
              {date.getDate()}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={T.nano}
              allowFontScaling={false}
            >
              {MONTHS[date.getMonth()]}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text
                style={{ color: c.text }}
                className={T.cardTitleSm}
                numberOfLines={1}
              >
                {WEEKDAYS_LONG[date.getDay()]}
              </Text>
              {row.isToday ? (
                <Text style={{ color: c.textFaint }} className={T.micro}>
                  (today)
                </Text>
              ) : null}
            </View>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-0.5 ${T.micro}`}
              numberOfLines={1}
            >
              {summaryOf(row)}
            </Text>
          </View>

          <Badge label={meta.label} tone={meta.tone} />
        </View>

        {expanded ? (
          <>
            <View style={{ backgroundColor: c.border }} className="my-3 h-px" />

            {punched ? (
              <>
                <View className="flex-row items-center gap-3">
                  <PunchCol
                    icon={LogIn}
                    label="Clock In"
                    time={fmtTime(record?.clock_in?.at)}
                    tone={surface.success}
                  />
                  <PunchCol
                    icon={LogOut}
                    label="Clock Out"
                    time={fmtTime(record?.clock_out?.at)}
                    tone={surface.danger}
                  />
                </View>

                <Where punch={record?.clock_in} label="In" />
                <Where punch={record?.clock_out} label="Out" />

                <View
                  style={{
                    backgroundColor: c.fill,
                    borderRadius: radius.well,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm + 2,
                  }}
                  className="mt-3 flex-row items-center gap-3"
                >
                  <Total
                    label="Break"
                    value={fmtDuration(record?.total_break_minutes ?? 0)}
                  />
                  <View
                    style={{ backgroundColor: c.border }}
                    className="h-7 w-px"
                  />
                  <Total
                    label="Worked"
                    value={fmtDuration(record?.total_work_minutes ?? 0)}
                  />
                </View>
              </>
            ) : (
              /* ── Nothing was punched ───────────────────────────────────
                 The reason, in the day's own colour, instead of an empty
                 expansion. A card that opens onto nothing reads as broken —
                 and on an absent day the reason IS the thing to act on. */
              <View
                style={{
                  backgroundColor: tone.bg,
                  borderRadius: radius.well,
                  borderWidth: 1,
                  borderColor: tone.border,
                  padding: space.md,
                }}
                className="flex-row items-start gap-2.5"
              >
                <meta.icon size={16} strokeWidth={2.2} color={tone.tint} />
                <View className="flex-1">
                  <Text style={{ color: tone.text }} className={T.cardTitleSm}>
                    {row.kind === "absent"
                      ? "No punches on this day"
                      : meta.label}
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className={`mt-0.5 leading-5 ${T.caption}`}
                  >
                    {row.kind === "absent"
                      ? "Neither a clock-in nor an approved leave. Raise a correction if you were working."
                      : row.kind === "leave"
                        ? `Approved leave${
                            row.leave?.reason ? ` — ${row.leave.reason}` : ""
                          }. No punch was expected.`
                        : row.kind === "holiday"
                          ? `${row.holidayName ?? "Company holiday"} — no punch was expected.`
                          : "A weekly off under your work calendar — no punch was expected."}
                  </Text>
                </View>
              </View>
            )}

            {hasFlags || onRegularize ? (
              <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
                <View
                  className="flex-row flex-wrap items-center"
                  style={{ gap: space.sm }}
                >
                  {record?.is_late ? (
                    <Badge
                      label={`Late by ${fmtDuration(record.late_by_minutes)}`}
                      tone={surface.warning}
                    />
                  ) : null}
                  {record?.is_manual ? (
                    <Badge
                      label={`Approved${record.marked_by_name ? ` · ${record.marked_by_name}` : ""}`}
                      tone={surface.info}
                      icon={
                        <Check
                          size={11}
                          strokeWidth={3}
                          color={surface.info.tint}
                        />
                      }
                    />
                  ) : null}
                </View>

                {onRegularize ? (
                  <RegularizeButton
                    onPress={onRegularize}
                    label={regularizeLabel(row)}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </Pressable>
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
  const { c, brand, tint } = useTheme();

  const today = new Date();
  const todayKey = ymd(today);
  const [year, setYear] = useState(today.getFullYear());
  const [view, setView] = useState<View$>("list");
  /** Tabs mounted so far — the other one waits until it is asked for. */
  const [visited, setVisited] = useState<Set<View$>>(
    () => new Set<View$>(["list"]),
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  /**
   * The day being corrected, or null while the sheet is closed.
   *
   * The whole ROW, not just its date: the sheet opens on a different request
   * type depending on what the day was. "Forgot to clock out" is the right
   * guess for a day with a clock-in and nothing after it, and exactly the wrong
   * one for a Sunday you came in on — and a pre-filled wrong answer is the one
   * people submit.
   */
  const [regularizeRow, setRegularizeRow] = useState<DayRow | null>(null);

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

  /**
   * My regularizations, newest first.
   *
   * Not scoped to the month filter on purpose: a request raised for the 3rd can
   * be reviewed on the 20th, and hiding it behind whichever month the LIST
   * happens to be on is how "I never heard back" happens. Fetched only once the
   * tab is opened.
   */
  const regs = useGetMyRegularizationsQuery(
    { limit: 50 },
    { skip: !visited.has("requests") },
  );

  const regItems = useMemo(
    () =>
      [...(regs.data?.items ?? [])].sort((a, b) =>
        String(b.createdAt ?? b.date).localeCompare(
          String(a.createdAt ?? a.date),
        ),
      ),
    [regs.data],
  );

  const pendingRegs = useMemo(
    () => regItems.filter((r) => r.status === "pending").length,
    [regItems],
  );

  /**
   * The three things that explain a day WITHOUT an attendance record.
   *
   * Absent, on leave, a holiday and a weekly off all arrive from the server as
   * the same thing — nothing — so the list could not tell them apart and simply
   * dropped all four. Two of these are cached app-wide and effectively free
   * (the holiday master and the work-calendar policy barely change in a year);
   * the leave calendar is the only per-range request, and it is one call for
   * the whole month.
   */
  const calendarConfig = useGetWorkCalendarConfigQuery();
  const holidayMaster = useGetHolidaysQuery();
  const leaveCalendar = useGetMyLeaveCalendarQuery(range);

  const holidays = useMemo(
    () => resolveHolidays(holidayMaster.data, year),
    [holidayMaster.data, year],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of items) map.set(r.date, r);
    return map;
  }, [items]);

  /**
   * Every day in the range, newest first — records joined onto the calendar
   * rather than the other way round. This is the list.
   */
  const listItems = useMemo(
    () =>
      buildDayRows({
        from: range.from,
        to: range.to,
        records: byDate,
        holidays,
        leaves: leaveCalendar.data ?? [],
        config: calendarConfig.data,
        todayKey,
      }),
    [
      range.from,
      range.to,
      byDate,
      holidays,
      leaveCalendar.data,
      calendarConfig.data,
      todayKey,
    ],
  );

  /** Day → row, so the calendar grid and the list agree by construction. */
  const rowByDate = useMemo(() => {
    const map = new Map<string, DayRow>();
    for (const r of listItems) map.set(r.key, r);
    return map;
  }, [listItems]);

  // Stats follow whatever the list is showing, so the numbers always describe
  // the rows underneath them.
  const stats = useMemo(() => summarise(listItems), [listItems]);

  const cells = useMemo(() => {
    const first = new Date(year, gridMonth, 1);
    const days = new Date(year, gridMonth + 1, 0).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  }, [year, gridMonth]);

  /** The day the calendar has focus on — its card is drawn under the grid. */
  const selectedRow = selectedDay ? rowByDate.get(selectedDay) : undefined;

  const years = Array.from(
    { length: YEAR_SPAN },
    (_, i) => today.getFullYear() - i,
  );

  const stepMonth = (delta: number) => {
    const next = gridMonth + delta;
    if (next < 0 || next > 11) return;
    setMonth(next);
  };

  /**
   * The list waits for the POLICY, not just the punches.
   *
   * Rendering as soon as the records land would draw every Sunday as "Absent"
   * for the split second before the work calendar arrives, then silently
   * re-colour it. A wrong answer shown confidently and corrected later is worse
   * than a skeleton — this is somebody's attendance record.
   */
  const listLoading =
    isLoading || calendarConfig.isLoading || leaveCalendar.isLoading;

  const refreshAll = () => {
    refetch();
    leaveCalendar.refetch();
    calendarConfig.refetch();
    holidayMaster.refetch();
  };

  const refresher = (
    <RefreshControl
      refreshing={
        (isFetching || leaveCalendar.isFetching) && !listLoading
      }
      onRefresh={refreshAll}
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

        {/* The title carries the active view now that the segmented control is
            gone: with the tabs behind a menu, "Attendance" alone would leave no
            way to tell the roster from the request list at a glance. */}
        <View className="flex-1">
          <Text
            style={{ color: c.text, fontFamily: "Inter_800SemiBold" }}
            className={T.section}
            numberOfLines={1}
          >
            Attendance
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={T.caption}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {VIEWS.find((v) => v.key === view)?.label}
          </Text>
        </View>

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

        {/* ── View menu ────────────────────────────────────────────────────
            The three tabs used to sit in a full-width segmented control under
            the header, which cost a 48px band of every screen to show two
            options nobody was about to switch to. Behind the overflow menu they
            cost nothing — but a pending request would then be invisible, so the
            count rides out here as a dot on the trigger. */}
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            pendingRegs
              ? `Change view. ${pendingRegs} pending requests`
              : "Change view"
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          className="-mr-1 pl-1"
        >
          <EllipsisVertical size={22} strokeWidth={2.2} color={c.text} />
          {pendingRegs ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: 0,
                width: 9,
                height: 9,
                borderRadius: 999,
                backgroundColor: surface.danger.tint,
                borderWidth: 1.5,
                borderColor: c.bg,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      <View className="flex-1">
        <TabPane active={view === "list"}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            refreshControl={refresher}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.screen,
                gap: space.md,
                paddingBottom: space.xl,
              }}
            >
              {listLoading ? (
                <>
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card}
                  />
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card}
                  />
                  <Skeleton
                    height={118}
                    width={STAT_WIDTH}
                    radius={radius.card}
                  />
                </>
              ) : (
                <>
                  <StatCardInline
                    icon={Timer}
                    value={String(stats.present).padStart(2, "0")}
                    label="Days Present"
                    tone={surface.success}
                  />
                  <StatCardInline
                    icon={TimerReset}
                    value={String(stats.late).padStart(2, "0")}
                    label="Late Arrivals"
                    tone={surface.warning}
                  />
                  {/* Absences now count UNRECORDED working days, not only the
                      rows the server sent with `status: absent` — a month with
                      no punches at all used to report zero and read as clean. */}
                  <StatCardInline
                    icon={CalendarX}
                    value={String(stats.absent).padStart(2, "0")}
                    label="Days Absent"
                    tone={surface.danger}
                  />
                  <StatCardInline
                    icon={Plane}
                    value={String(stats.leave).padStart(2, "0")}
                    label="On Leave"
                    tone={surface.purple}
                  />
                  <StatCardInline
                    icon={Coffee}
                    value={String(stats.off).padStart(2, "0")}
                    label="Offs & Holidays"
                    tone={surface.info}
                  />
                  <StatCardInline
                    icon={CalendarDays}
                    value={fmtDuration(stats.minutes)}
                    label="Total Worked"
                    tone={surface.neutral}
                  />
                </>
              )}
            </ScrollView>

            {listLoading ? (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                <Skeleton height={92} radius={radius.card} />
                <Skeleton height={92} radius={radius.card} />
                <Skeleton height={92} radius={radius.card} />
                <Skeleton height={92} radius={radius.card} />
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
                title={error ? "Could not load this month" : "Nothing here yet"}
                message={
                  error
                    ? describeApiError(error).title
                    : `${
                        month === null ? year : `${MONTHS_LONG[month]} ${year}`
                      } has not started yet.`
                }
                actionLabel={error ? "Try again" : undefined}
                onAction={error ? refreshAll : undefined}
              />
            ) : (
              <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
                {/* Keyed by DATE, not by record id: an absent day has no record
                    and therefore no id, and two of them would collide on
                    `undefined`. The date is the row's real identity anyway. */}
                {listItems.map((r) => (
                  <DayCard
                    key={r.key}
                    row={r}
                    expanded={expandedId === r.key}
                    onToggle={() =>
                      setExpandedId(expandedId === r.key ? null : r.key)
                    }
                    onRegularize={
                      canRegularize(r, todayKey)
                        ? () => setRegularizeRow(r)
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </TabPane>

        {/* ── Roster ─────────────────────────────────────────────── */}
        {visited.has("roster") ? (
          <TabPane active={view === "roster"}>
            <ScrollView
              contentContainerStyle={{
                paddingBottom: bottomPad + 24,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={refresher}
            >
              <View style={{ paddingHorizontal: space.screen }}>
                {/* ── Month Header ─────────────────────────────────── */}
                <View
                  style={{
                    marginTop: space.md,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 4,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Pressable
                    onPress={() => stepMonth(-1)}
                    disabled={gridMonth === 0}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: c.fill,
                      opacity: gridMonth === 0 ? 0.35 : pressed ? 0.6 : 1,
                    })}
                  >
                    <ChevronLeft size={21} strokeWidth={2.4} color={c.text} />
                  </Pressable>

                  <View style={{ alignItems: "center" }}>
                    <View className="flex-row items-center gap-2">
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 4,
                          backgroundColor: brand[50],
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CalendarDays
                          size={18}
                          strokeWidth={2}
                          color={brand[600]}
                        />
                      </View>

                      <Text
                        style={{
                          color: c.text,
                          fontSize: 17,
                          fontWeight: "700",
                          letterSpacing: -0.3,
                        }}
                      >
                        {MONTHS_LONG[gridMonth]} {year}
                      </Text>
                    </View>

                    <Text
                      style={{
                        color: c.textFaint,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      Your attendance calendar
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => stepMonth(1)}
                    disabled={gridMonth === 11}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: c.fill,
                      opacity: gridMonth === 11 ? 0.35 : pressed ? 0.6 : 1,
                    })}
                  >
                    <ChevronRight size={21} strokeWidth={2.4} color={c.text} />
                  </Pressable>
                </View>

                {/* ── Calendar ─────────────────────────────────────── */}
                <View
                  style={{
                    marginTop: space.md,
                    backgroundColor: c.card,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: space.md,
                  }}
                >
                  {/* Weekdays */}
                  <View
                    style={{
                      flexDirection: "row",
                      borderRadius: radius.card,
                      paddingVertical: 10,
                      marginBottom: 8,
                    }}
                  >
                    {WEEKDAYS_LONG.map((d) => (
                      <Text
                        key={d}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          color: c.textMuted,
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 0.5,
                        }}
                      >
                        {d.slice(0, 3).toUpperCase()}
                      </Text>
                    ))}
                  </View>

                  {/* Days */}
                  <View className="flex-row flex-wrap">
                    {cells.map((day, i) => {
                      if (day === null) {
                        return (
                          <View
                            key={`blank-${i}`}
                            style={{
                              width: "14.28%",
                              height: 58,
                            }}
                          />
                        );
                      }

                      const key = ymd(new Date(year, gridMonth, day));

                      // The grid and the list are now the SAME data. They used
                      // to run two different classifiers over the same records,
                      // which is how a day could be blank here and absent there.
                      const row = rowByDate.get(key);
                      const record = row?.record;
                      const kind = row?.kind ?? "future";

                      const isSelected = key === selectedDay;
                      const isToday = key === ymd(today);

                      const statusColor =
                        kind === "future" ? "transparent" : KIND_META[kind].tone.tint;

                      return (
                        <Pressable
                          key={day}
                          onPress={() => setSelectedDay(key)}
                          accessibilityRole="button"
                          accessibilityLabel={`${day} ${MONTHS[gridMonth]}`}
                          accessibilityState={{
                            selected: isSelected,
                          }}
                          style={({ pressed }) => ({
                            width: "14.28%",
                            height: 58,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.65 : 1,
                          })}
                        >
                          {/* Today outer glow */}
                          <View
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 23,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: isSelected
                                ? `${brand[600]}12`
                                : isToday
                                  ? `${brand[600]}08`
                                  : "transparent",
                              borderWidth: isToday && !isSelected ? 1 : 0,
                              borderColor: `${brand[600]}30`,
                            }}
                          >
                            {/* Selected */}
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isSelected
                                  ? brand[600]
                                  : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  color: isSelected
                                    ? "#FFFFFF"
                                    : record
                                      ? c.text
                                      : c.textFaint,
                                  fontSize: 15,
                                  fontWeight:
                                    isSelected || isToday ? "700" : "500",
                                }}
                              >
                                {day}
                              </Text>
                            </View>
                          </View>

                          {/* Status */}
                          <View
                            style={{
                              position: "absolute",
                              bottom: 4,
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: statusColor,
                            }}
                          />
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* ── Legend ─────────────────────────────────────── */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    {LEGEND.map((k) => (
                      <View
                        key={k}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          paddingHorizontal: 8,
                          paddingVertical: 7,
                          borderRadius: 999,
                        }}
                      >
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 4,
                            backgroundColor: KIND_META[k].tone.tint,
                          }}
                        />

                        <Text
                          style={{
                            color: c.textMuted,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {KIND_META[k].label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── The selected day ─────────────────────────────────
                    Tapping a date used to do nothing but move a highlight —
                    the calendar could SHOW you an absence and then offer no
                    way to act on it. The same card the list uses is drawn
                    here, already open, so "tap the day, fix the day" works
                    from either view. */}
                {selectedRow ? (
                  <View style={{ marginTop: space.md }}>
                    <DayCard
                      row={selectedRow}
                      expanded
                      onToggle={() => setSelectedDay(null)}
                      onRegularize={
                        canRegularize(selectedRow, todayKey)
                          ? () => setRegularizeRow(selectedRow)
                          : undefined
                      }
                    />
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </TabPane>
        ) : null}

        {/* ── Requests (regularizations) ─────────────────────────────────── */}
        {visited.has("requests") ? (
          <TabPane active={view === "requests"}>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: space.screen,
                paddingBottom: bottomPad,
                gap: space.md,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={regs.isFetching && !regs.isLoading}
                  onRefresh={() => regs.refetch()}
                  tintColor={brand[600]}
                />
              }
            >
              {regs.isLoading ? (
                <>
                  <Skeleton height={130} radius={radius.card} />
                  <Skeleton height={130} radius={radius.card} />
                  <Skeleton height={130} radius={radius.card} />
                  <Skeleton height={130} radius={radius.card} />
                  <Skeleton height={130} radius={radius.card} />
                  <Skeleton height={130} radius={radius.card} />
                </>
              ) : regs.error ? (
                <EmptyState
                  icon={
                    <PenLine size={32} strokeWidth={1.6} color={brand[600]} />
                  }
                  title="Could not load your requests"
                  message={describeApiError(regs.error).title}
                  actionLabel="Try again"
                  onAction={() => regs.refetch()}
                />
              ) : regItems.length === 0 ? (
                <EmptyState
                  icon={
                    <PenLine size={32} strokeWidth={1.6} color={brand[600]} />
                  }
                  title="No requests raised"
                  message="Open a day on the Roster and tap Regularize when a punch is missing or wrong. Whatever you raise shows up here with its outcome."
                  actionLabel="Go to Roster"
                  onAction={() => {
                    setView("roster");
                    setVisited((v) =>
                      v.has("roster") ? v : new Set(v).add("roster"),
                    );
                  }}
                />
              ) : (
                regItems.map((item, i) => (
                  <RegularizationCard
                    expanded={expandedId === item._id}
                    onToggle={() =>
                      setExpandedId(expandedId === item._id ? null : item._id)
                    }
                    key={item._id}
                    item={item}
                    index={i}
                  />
                ))
              )}
            </ScrollView>
          </TabPane>
        ) : null}
      </View>

      <BottomNav
        active="attendance"
        onSelect={(key) => {
          if (key === "home") navigation.goBack();
          else if (key === "chat") navigation.navigate("Chats" as never);
          else if (key === "apply") navigation.navigate("LeaveApply" as never);
          else if (key === "profile") navigation.navigate("Profile" as never);
        }}
      />

      <RegularizeSheet
        visible={Boolean(regularizeRow)}
        date={regularizeRow?.key ?? ""}
        defaultType={regularizeRow ? suggestedType(regularizeRow) : undefined}
        context={regularizeRow ? KIND_META[regularizeRow.kind].label : undefined}
        onClose={() => setRegularizeRow(null)}
      />

      {/* ── View menu ────────────────────────────────────────────────────────
          A sheet, not a floating popover: the trigger sits under the status bar
          on a phone, and an anchored menu there would open downward across the
          content it is meant to switch. The sheet is also where every other
          choice on this screen already lives. */}
      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        maxHeightRatio={0.5}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text style={{ color: c.text }} className={T.section}>
            View
          </Text>

          {VIEWS.map((v) => {
            const active = v.key === view;
            const Icon = v.icon;
            const count = v.key === "requests" ? pendingRegs : 0;

            return (
              <Pressable
                key={v.key}
                onPress={() => {
                  setView(v.key);
                  setVisited((s) => (s.has(v.key) ? s : new Set(s).add(v.key)));
                  setMenuOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={count ? `${v.label}, ${count}` : v.label}
                style={({ pressed }) => ({
                  backgroundColor: active ? tint.bg : c.fill,
                  borderRadius: radius.well,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="flex-row items-center gap-3 px-4 py-3"
              >
                <Icon
                  size={20}
                  strokeWidth={2.2}
                  color={active ? brand[700] : c.textMuted}
                />

                <View className="flex-1">
                  <Text
                    style={{ color: active ? brand[700] : c.text }}
                    className={T.cardTitleSm}
                    numberOfLines={1}
                  >
                    {v.label}
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className={T.caption}
                    numberOfLines={1}
                  >
                    {v.hint}
                  </Text>
                </View>

                {count ? (
                  <Badge label={String(count)} tone={surface.danger} />
                ) : null}
                {active ? (
                  <Check size={18} strokeWidth={2.6} color={brand[700]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

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
