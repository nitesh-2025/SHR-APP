import { useNavigation } from "@react-navigation/native";
import {
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Repeat,
  TriangleAlert,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { useMenuNav } from "../navigation/useMenuNav";
import {
  useGetHolidaysQuery,
  useGetWorkCalendarConfigQuery,
} from "../store/workCalendarApi";
import { radius, shadow, space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { MONTHS_LONG, WEEKDAYS_LONG, ymd } from "../utils/date";
import { resolveHolidays, type HolidayDate } from "../utils/holidays";

/* ── Rows ─────────────────────────────────────────────────────────────────── */

function HolidayRow({ item, todayKey }: { item: HolidayDate; todayKey: string }) {
  const { c, dark } = useTheme();

  const passed = item.key < todayKey;
  const isToday = item.key === todayKey;
  const tone = isToday ? surface.success : passed ? surface.neutral : surface.info;
  const well = toneFor(tone, dark);

  return (
    <View
      style={{ opacity: passed ? 0.68 : 1 }}
      className="flex-row items-center gap-3"
    >
      <View
        style={{ backgroundColor: well.bg, borderRadius: radius.well - 4 }}
        className="h-11 w-11 items-center justify-center"
      >
        <Text
          style={{ color: well.text }}
          className={T.cardTitleSm}
          allowFontScaling={false}
        >
          {String(item.date.getDate()).padStart(2, "0")}
        </Text>
      </View>

      <View className="flex-1">
        <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
          {item.name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <Text style={{ color: c.textMuted }} className={T.micro}>
            {WEEKDAYS_LONG[item.date.getDay()]}
          </Text>
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

      {isToday ? <Badge label="Today" tone={surface.success} /> : null}
    </View>
  );
}

/** One line of the shift/policy card. */
function PolicyRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text style={{ color: c.textMuted }} className={T.secondary}>
        {label}
      </Text>
      <Text style={{ color: c.text }} className={T.cardTitleSm}>
        {value}
      </Text>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

const SAT_ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * Work calendar — the company's year, not the employee's.
 *
 * Deliberately separate from the Leave screen's Holidays tab: that one answers
 * "what is off in the month I am filtering", this one answers "what does my
 * working year look like, and what counts as a working day at all". The shift
 * and weekly-off policy only makes sense here.
 */
export default function WorkCalendarScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const go = useMenuNav();

  const today = new Date();
  const todayKey = ymd(today);
  const [year, setYear] = useState(today.getFullYear());

  const holidays = useGetHolidaysQuery();
  const config = useGetWorkCalendarConfigQuery();

  /** Grouped by month so a 20-row year reads as a calendar, not a list. */
  const months = useMemo(() => {
    const all = resolveHolidays(holidays.data, year);
    const map = new Map<number, HolidayDate[]>();
    for (const h of all) {
      const k = h.date.getMonth();
      const bucket = map.get(k);
      if (bucket) bucket.push(h);
      else map.set(k, [h]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [holidays.data, year]);

  const total = months.reduce((n, [, items]) => n + items.length, 0);

  const weeklyOffs = useMemo(() => {
    const w = config.data?.weekly_offs;
    if (!w) return null;
    const parts: string[] = [];
    if (w.sunday) parts.push("Every Sunday");
    if (w.saturday_offs?.length) {
      parts.push(
        `${w.saturday_offs
          .slice()
          .sort((a, b) => a - b)
          .map((n) => SAT_ORDINAL[n - 1] ?? `${n}th`)
          .join(", ")} Saturday`,
      );
    }
    return parts.length ? parts.join(" · ") : "None";
  }, [config.data]);

  const shift = config.data?.weekday_shift;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Work Calendar"
        subtitle={`${total} holiday${total === 1 ? "" : "s"} in ${year}`}
        onBack={() => navigation.goBack()}
        right={
          /* Year stepper rather than a picker sheet: the useful range is
             "this year and the one either side", and two 32px taps beat
             opening a modal to move by one. */
          <View
            style={{ backgroundColor: c.card, borderRadius: radius.pill }}
            className="flex-row items-center gap-1 px-1"
          >
            <Pressable
              onPress={() => setYear((y) => y - 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Show ${year - 1}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              className="h-8 w-8 items-center justify-center"
            >
              <ChevronLeft size={16} strokeWidth={2.4} color={c.textMuted} />
            </Pressable>
            <Text
              style={{ color: c.text }}
              className={T.badge}
              allowFontScaling={false}
            >
              {year}
            </Text>
            <Pressable
              onPress={() => setYear((y) => y + 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Show ${year + 1}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              className="h-8 w-8 items-center justify-center"
            >
              <ChevronRight size={16} strokeWidth={2.4} color={c.textMuted} />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={holidays.isFetching && !holidays.isLoading}
            onRefresh={() => {
              holidays.refetch();
              config.refetch();
            }}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Policy ─────────────────────────────────────────────────────
            First, because it is the part nobody can look up anywhere else.
            Rendered only once the config lands — a card of em-dashes is worse
            than no card. */}
        {shift ? (
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: c.border,
              padding: space.lg + 2,
              ...(dark ? shadow.none : shadow.card),
            }}
          >
            <View className="flex-row items-center gap-2">
              <Clock3 size={16} strokeWidth={2.2} color={brand[600]} />
              <Text style={{ color: c.text }} className={T.cardTitle}>
                Your working week
              </Text>
            </View>

            <View className="mt-2">
              <PolicyRow
                label="Shift"
                value={`${shift.start_time} – ${shift.end_time}`}
              />
              <View style={{ backgroundColor: c.border }} className="h-px" />
              <PolicyRow label="Grace" value={`${shift.grace_minutes} min`} />
              <View style={{ backgroundColor: c.border }} className="h-px" />
              <PolicyRow label="Late after" value={shift.late_until} />
              {weeklyOffs ? (
                <>
                  <View style={{ backgroundColor: c.border }} className="h-px" />
                  <PolicyRow label="Weekly off" value={weeklyOffs} />
                </>
              ) : null}
            </View>

            {config.data?.saturday_shift ? (
              <Text style={{ color: c.textFaint }} className={`mt-2 ${T.micro}`}>
                Working Saturdays run {config.data.saturday_shift.start_time} –{" "}
                {config.data.saturday_shift.end_time}.
              </Text>
            ) : null}
          </View>
        ) : config.isLoading ? (
          <Skeleton height={200} radius={radius.card} />
        ) : null}

        {/* ── Holidays ───────────────────────────────────────────────────── */}
        {holidays.isLoading ? (
          <>
            <Skeleton height={140} radius={radius.card} />
            <Skeleton height={140} radius={radius.card} />
          </>
        ) : holidays.error ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load the holiday list"
            message={describeApiError(holidays.error).title}
            actionLabel="Try again"
            onAction={() => holidays.refetch()}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={<CalendarHeart size={32} strokeWidth={1.6} color={brand[600]} />}
            title={`Nothing marked for ${year}`}
            message="The company calendar has no holidays declared for this year yet."
          />
        ) : (
          months.map(([month, items]) => (
            <View
              key={month}
              style={{
                backgroundColor: c.card,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: c.border,
                padding: space.lg + 2,
                ...(dark ? shadow.none : shadow.soft),
              }}
            >
              <Text
                style={{ color: c.textFaint }}
                className={`uppercase ${T.micro}`}
              >
                {MONTHS_LONG[month]}
              </Text>

              <View className="mt-3" style={{ gap: space.md }}>
                {items.map((h) => (
                  <HolidayRow key={h.id + h.key} item={h} todayKey={todayKey} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
