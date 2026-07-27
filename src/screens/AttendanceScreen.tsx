import { useNavigation } from '@react-navigation/native';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListFilter,
  LogIn,
  LogOut,
  MapPin,
  Smartphone,
  Timer,
  TimerReset,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_CLEARANCE, BottomNav } from '../components/BottomNav';
import { BottomSheet } from '../components/BottomSheet';
import { Badge, Card, EmptyState, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import {
  useGetMyHistoryQuery,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../store/attendanceApi';
import { radius, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import {
  fmtDuration,
  fmtTime,
  monthRange,
  MONTHS,
  MONTHS_LONG,
  parseYmd,
  WEEKDAYS_LONG,
  ymd,
} from '../utils/date';

/** Day-cell meaning. `none` = nothing recorded (weekend, holiday, future). */
type DayKind = 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'none';

const KIND_TONE: Record<Exclude<DayKind, 'none'>, Surface> = {
  present: surface.success,
  late: surface.warning,
  absent: surface.danger,
  leave: surface.purple,
  holiday: surface.info,
};

const LEGEND: [string, Surface][] = [
  ['Present', surface.success],
  ['Late', surface.warning],
  ['Absent', surface.danger],
  ['Leave', surface.purple],
  ['Holiday', surface.info],
];

const STATUS_TONE: Record<AttendanceStatus, { label: string; tone: Surface }> = {
  present: { label: 'Present', tone: surface.success },
  in_progress: { label: 'Running', tone: surface.success },
  half_day: { label: 'Half Day', tone: surface.warning },
  absent: { label: 'Absent', tone: surface.danger },
};

/** Calendar filter — which days keep their dot. */
type Filter = 'all' | 'late' | 'absent';

/* ── Stat card ────────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Clock3;
  value: string;
  label: string;
  /** Solid fill for the icon square — white glyph on top. */
  color: string;
}) {
  const { c } = useTheme();
  return (
    <Card style={{ flex: 1, padding: space.lg }}>
      <View
        style={{ backgroundColor: color, borderRadius: radius.well }}
        className="h-10 w-10 items-center justify-center"
      >
        <Icon size={19} strokeWidth={2.2} color="#FFFFFF" />
      </View>
      <Text style={{ color: c.text }} className="mt-3 font-display text-[22px] leading-7">
        {value}
      </Text>
      <Text
        style={{ color: c.textMuted }}
        className="mt-0.5 font-ui-regular text-[11.5px]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Card>
  );
}

/* ── Detail cell ──────────────────────────────────────────────────────────── */

function Detail({
  icon: Icon,
  label,
  value,
  place,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  place?: string;
}) {
  const { c } = useTheme();
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-1.5">
        <Icon size={13} strokeWidth={2} color={c.textFaint} />
        <Text style={{ color: c.textMuted }} className="font-ui-regular text-[11.5px]">
          {label}
        </Text>
      </View>
      <Text style={{ color: c.text }} className="mt-1 font-ui-semibold text-[15px]">
        {value}
      </Text>
      {place ? (
        <View className="mt-0.5 flex-row items-center gap-1">
          <MapPin size={11} strokeWidth={2} color={c.textFaint} />
          <Text style={{ color: c.textFaint }} className="font-ui-regular text-[11px]">
            {place}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My attendance, a month at a time.
 *
 * The range is sent to the server (`GET /attendance/me?from&to`) rather than
 * filtered on the device — a year of records is not something to pull down and
 * throw most of away, and the stats must reflect the same range.
 */
export default function AttendanceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, primary, dark } = useTheme();

  const today = new Date();
  const year = today.getFullYear();
  /** `null` = the whole year (the "All" chip). */
  const [month, setMonth] = useState<number | null>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(today));
  const [filter, setFilter] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  // The strip defaults to the CURRENT month, which sits past the right edge on
  // a 12-chip row — without this the screen opens looking like nothing is
  // selected. `x` is chip width + gap, measured from the styles below.
  const monthStrip = useRef<ScrollView>(null);
  useEffect(() => {
    if (month === null) return;
    const CHIP = 54 + space.sm;
    monthStrip.current?.scrollTo({ x: Math.max(0, (month - 1) * CHIP), animated: false });
  }, [month]);

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const { data, isLoading, isFetching, error, refetch } = useGetMyHistoryQuery({
    ...range,
    limit: 400,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of items) map.set(r.date, r);
    return map;
  }, [items]);

  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let minutes = 0;
    for (const r of items) {
      if (r.status === 'present' || r.status === 'in_progress') present += 1;
      else if (r.status === 'half_day') present += 0.5;
      if (r.is_late) late += 1;
      minutes += r.total_work_minutes ?? 0;
    }
    return { present, late, minutes };
  }, [items]);

  // The grid always shows a real month, even when the range is the whole year —
  // "All" widens the stats, not the calendar.
  const gridMonth = month ?? today.getMonth();
  const cells = useMemo(() => {
    const first = new Date(year, gridMonth, 1);
    const days = new Date(year, gridMonth + 1, 0).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  }, [year, gridMonth]);

  const kindOf = (record?: AttendanceRecord): DayKind => {
    if (!record) return 'none';
    if (record.status === 'absent') return 'absent';
    if (record.is_late || record.status === 'half_day') return 'late';
    return 'present';
  };

  const passesFilter = (kind: DayKind) =>
    filter === 'all' ? true : filter === 'late' ? kind === 'late' : kind === 'absent';

  const selected = selectedDay ? byDate.get(selectedDay) : undefined;
  const selectedDate = parseYmd(selectedDay ?? undefined);
  const selectedStatus = selected ? (STATUS_TONE[selected.status] ?? STATUS_TONE.absent) : null;

  const HeaderButton = ({
    icon: Icon,
    label,
    onPress,
    active,
  }: {
    icon: typeof CalendarDays;
    label: string;
    onPress: () => void;
    active?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        backgroundColor: active ? primary.bg : c.card,
        borderRadius: radius.well,
        borderWidth: 1,
        borderColor: active ? brand[600] : c.border,
        opacity: pressed ? 0.7 : 1,
      })}
      className="h-10 w-10 items-center justify-center"
    >
      <Icon size={18} strokeWidth={2} color={active ? brand[600] : c.textMuted} />
    </Pressable>
  );

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
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} strokeWidth={2.2} color={c.text} />
        </Pressable>

        <View className="flex-1">
          <Text style={{ color: c.text }} className="font-display text-[22px] leading-7">
            My Attendance
          </Text>
          <Text style={{ color: brand[600] }} className="font-ui text-[12.5px]">
            {month === null ? `${year}` : `${MONTHS_LONG[month]} ${year}`}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <HeaderButton
            icon={CalendarDays}
            label="Jump to this month"
            onPress={() => {
              setMonth(today.getMonth());
              setSelectedDay(ymd(today));
            }}
          />
          <HeaderButton
            icon={ListFilter}
            label="Filter days"
            active={filter !== 'all'}
            onPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Month chips ────────────────────────────────────────────────── */}
        <ScrollView
          ref={monthStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            gap: space.sm,
            paddingBottom: space.lg,
          }}
        >
          {[null, ...MONTHS.map((_, i) => i)].map((m) => {
            const active = m === month;
            const label = m === null ? 'All' : MONTHS[m];
            // Nothing to show for a month that hasn't happened yet.
            const future = m !== null && m > today.getMonth();
            return (
              <Pressable
                key={label}
                onPress={() => setMonth(m)}
                disabled={future}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: future }}
                style={({ pressed }) => ({
                  backgroundColor: active ? brand[600] : c.card,
                  borderRadius: radius.pill,
                  borderWidth: active ? 0 : 1,
                  borderColor: c.border,
                  opacity: future ? 0.35 : pressed ? 0.75 : 1,
                  minWidth: 54,
                })}
                className="h-9 items-center justify-center px-3"
              >
                <Text
                  style={{ color: active ? '#FFFFFF' : c.textMuted }}
                  className="font-ui-semibold text-[12.5px]"
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <View
          className="flex-row"
          style={{ gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.xl }}
        >
          {isLoading ? (
            <>
              <Skeleton height={116} radius={radius.card} />
              <Skeleton height={116} radius={radius.card} />
              <Skeleton height={116} radius={radius.card} />
            </>
          ) : (
            <>
              <StatCard
                icon={Timer}
                value={String(stats.present).padStart(2, '0')}
                label="Days Present"
                color={brand[600]}
              />
              <StatCard
                icon={TimerReset}
                value={String(stats.late).padStart(2, '0')}
                label="Late Arrivals"
                color={surface.warning.tint}
              />
              <StatCard
                icon={CalendarDays}
                value={fmtDuration(stats.minutes)}
                label="Total Worked"
                color={surface.purple.tint}
              />
            </>
          )}
        </View>

        {isLoading ? (
          <View style={{ paddingHorizontal: space.screen }}>
            <Skeleton height={280} radius={radius.card} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={32} strokeWidth={1.6} color={brand[600]} />}
            title="No attendance yet"
            message={
              error
                ? describeApiError(error).title
                : `Nothing recorded in ${MONTHS_LONG[gridMonth]}. Start by clocking in.`
            }
            actionLabel="Clock In"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <>
            {/* ── Calendar (on the canvas, no card frame) ───────────────── */}
            <View style={{ paddingHorizontal: space.screen }}>
              <View className="flex-row pb-3">
                {WEEKDAYS_LONG.map((d) => (
                  <Text
                    key={d}
                    style={{ color: c.textFaint }}
                    className="flex-1 text-center font-ui-semibold text-[10.5px] uppercase"
                  >
                    {d.slice(0, 3)}
                  </Text>
                ))}
              </View>

              <View className="flex-row flex-wrap">
                {cells.map((day, i) => {
                  if (day === null) {
                    return <View key={`blank-${i}`} style={{ width: '14.28%', height: 46 }} />;
                  }
                  const key = ymd(new Date(year, gridMonth, day));
                  const record = byDate.get(key);
                  const kind = kindOf(record);
                  const dotted = kind !== 'none' && passesFilter(kind);
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
                        width: '14.28%',
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
                          className="font-ui text-[13.5px]"
                        >
                          {day}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: dotted ? KIND_TONE[kind].tint : 'transparent',
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
                    <Text style={{ color: c.textMuted }} className="font-ui-regular text-[11px]">
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Selected day ───────────────────────────────────────────── */}
            <View style={{ marginTop: space.xl, paddingHorizontal: space.screen }}>
              <View
                style={{
                  backgroundColor: dark ? c.card : primary.bg,
                  borderRadius: radius.card,
                  padding: space.md,
                }}
              >
                <View
                  className="flex-row items-center justify-between"
                  style={{ paddingHorizontal: space.sm, paddingBottom: space.md }}
                >
                  <Text style={{ color: c.text }} className="font-ui-semibold text-[15px]">
                    {selectedDate
                      ? `${WEEKDAYS_LONG[selectedDate.getDay()].slice(0, 3)}, ${selectedDate.getDate()} ${
                          MONTHS_LONG[selectedDate.getMonth()]
                        } ${selectedDate.getFullYear()}`
                      : 'Select a day'}
                  </Text>
                  {selectedStatus ? (
                    <Badge label={selectedStatus.label} tone={selectedStatus.tone} />
                  ) : null}
                </View>

                {selected ? (
                  <View
                    style={{
                      backgroundColor: c.card,
                      borderRadius: radius.well,
                      padding: space.lg,
                    }}
                  >
                    <View className="flex-row" style={{ gap: space.md }}>
                      <Detail
                        icon={LogIn}
                        label="Clock In"
                        value={fmtTime(selected.clock_in?.at) ?? '—'}
                        place={selected.clock_in?.location?.address || 'Office'}
                      />
                      <Detail
                        icon={LogOut}
                        label="Clock Out"
                        value={fmtTime(selected.clock_out?.at) ?? '—'}
                        place={selected.clock_out?.location?.address || 'Office'}
                      />
                    </View>

                    <View style={{ backgroundColor: c.border }} className="my-4 h-px" />

                    <Detail
                      icon={Clock3}
                      label="Working Hours"
                      value={fmtDuration(selected.total_work_minutes)}
                    />

                    <View style={{ backgroundColor: c.border }} className="my-4 h-px" />

                    <View className="flex-row items-center gap-3">
                      <Detail
                        icon={Smartphone}
                        label="Device"
                        value={
                          selected.clock_in?.application ||
                          selected.clock_in?.device_info ||
                          'Unknown'
                        }
                      />
                      <ChevronRight size={18} strokeWidth={2} color={c.textFaint} />
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: c.card,
                      borderRadius: radius.well,
                      padding: space.lg,
                    }}
                  >
                    <Text style={{ color: c.textMuted }} className="font-ui-regular text-[13px]">
                      No attendance recorded on this day.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav
        active="attendance"
        onSelect={(key) => {
          if (key === 'home') navigation.goBack();
          else if (key === 'leaves') navigation.navigate('Leave' as never);
          else if (key === 'apply') navigation.navigate('LeaveApply' as never);
        }}
      />

      {/* ── Filter sheet ─────────────────────────────────────────────────── */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} maxHeightRatio={0.45}>
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text style={{ color: c.text }} className="font-ui-semibold text-[17px]">
            Show days
          </Text>
          {(
            [
              ['all', 'All days'],
              ['late', 'Late arrivals only'],
              ['absent', 'Absences only'],
            ] as [Filter, string][]
          ).map(([key, label]) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setFilter(key);
                  setFilterOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  backgroundColor: active ? primary.bg : c.fill,
                  borderRadius: radius.well,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="h-12 justify-center px-4"
              >
                <Text
                  style={{ color: active ? brand[700] : c.text }}
                  className="font-ui-semibold text-[14px]"
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
