import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Skeleton } from './ui';
import { useGetMyHistoryQuery, type AttendanceRecord } from '../store/attendanceApi';
import { radius, shadow, space } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { ymd } from '../utils/date';

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Height of the plot area. Bars are drawn as a fraction of this. */
const PLOT = 92;

/** A full shift, used as the chart's floor so one long day cannot flatten the rest. */
const FULL_DAY_MINUTES = 8 * 60;

/** Bar corner. Small — see the note where it is applied. */
const BAR_RADIUS = 4;

/** Monday → Sunday of the week `d` falls in. Weeks start Monday, not Sunday. */
function weekRange(d: Date): { from: string; to: string; days: Date[] } {
  const monday = new Date(d);
  // getDay(): 0 = Sunday. Shift it so Monday is the origin.
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
  return { from: ymd(days[0]), to: ymd(days[6]), days };
}

function Bar({
  minutes,
  ceiling,
  label,
  today,
  index,
}: {
  minutes: number | null;
  ceiling: number;
  label: string;
  today: boolean;
  index: number;
}) {
  const { c, brand } = useTheme();

  // No record at all (weekend, holiday, a day not yet reached) reads as a flat
  // dash rather than a zero-height bar — an absent day and a zero-minute day
  // are not the same statement.
  if (minutes === null) {
    return (
      <View className="flex-1 items-center">
        <View style={{ height: PLOT }} className="justify-end">
          <View
            style={{ backgroundColor: c.border, borderRadius: BAR_RADIUS }}
            className="h-1 w-5"
          />
        </View>
        <Text style={{ color: c.textFaint }} className={`mt-2 ${T.nano}`}>
          {label}
        </Text>
      </View>
    );
  }

  const height = Math.max(6, Math.round((minutes / ceiling) * PLOT));

  return (
    <View className="flex-1 items-center">
      <View style={{ height: PLOT }} className="justify-end">
        <Animated.View
          entering={FadeInDown.delay(index * 60).duration(420)}
          style={{
            height,
            width: 11,
            backgroundColor: today ? brand[500] : brand[600],
            // Small, not a pill: at 11px wide a fully rounded cap eats most of
            // the bar and short days end up looking like identical lozenges.
            borderRadius: BAR_RADIUS,
          }}
        />
      </View>
      <Text
        style={{ color: today ? brand[600] : c.textMuted }}
        className={`mt-2 ${today ? T.badge : T.nano}`}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * This week at a glance — days present on the left, minutes worked per day on
 * the right.
 *
 * The range is sent to the server (`GET /attendance/me?from&to`) rather than
 * filtered on the device: a week is seven rows, and asking for exactly seven is
 * cheaper than pulling a month and throwing most of it away.
 */
export function WeekSummary() {
  const { c } = useTheme();

  const today = new Date();
  const { from, to, days } = useMemo(() => weekRange(today), [ymd(today)]);

  const { data, isLoading } = useGetMyHistoryQuery({ from, to, limit: 20 });

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of data?.items ?? []) map.set(r.date, r);
    return map;
  }, [data]);

  const cells = useMemo(
    () =>
      days.map((day) => {
        const record = byDate.get(ymd(day));
        return {
          key: ymd(day),
          record,
          minutes: record ? (record.total_work_minutes ?? 0) : null,
          isToday: ymd(day) === ymd(today),
        };
      }),
    // `days` is derived from the same date key, so this stays stable for a day.
    [days, byDate],
  );

  const present = cells.filter(
    (d) => d.record?.status === 'present' || d.record?.status === 'in_progress',
  ).length;
  const totalDays = cells.filter((d) => d.record).length;

  const ceiling = Math.max(
    FULL_DAY_MINUTES,
    ...cells.map((d) => d.minutes ?? 0),
  );

  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: space.screen }}>
        <Skeleton height={168} radius={radius.card} />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: space.screen }}>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: radius.card,
          // No shadow. A full-width panel has nothing beside it to be lifted
          // above — the hairline is the only edge it needs.
          borderWidth: 1,
          borderColor: c.border,
          padding: space.lg,
          ...shadow.none,
        }}
        className="flex-row"
      >
        {/* ── Totals ───────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: c.fill,
            borderRadius: radius.well,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
            width: 84,
          }}
          className="justify-center"
        >
          <Text style={{ color: c.textMuted }} className={T.nano} numberOfLines={1}>
            Total Days
          </Text>
          <Text style={{ color: c.text }} className={T.kpiSm} allowFontScaling={false}>
            {totalDays}
          </Text>

          <Text
            style={{ color: c.textMuted }}
            className={`mt-2 ${T.nano}`}
            numberOfLines={1}
          >
            Present
          </Text>
          <Text style={{ color: c.text }} className={T.kpiSm} allowFontScaling={false}>
            {present}
          </Text>
        </View>

        {/* ── Bars ─────────────────────────────────────────────────────── */}
        <View className="ml-3 flex-1 flex-row items-end">
          {cells.map((d, i) => (
            <Bar
              key={d.key}
              index={i}
              minutes={d.minutes}
              ceiling={ceiling}
              label={LABELS[i]}
              today={d.isToday}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
