import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, ClipboardList, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_CLEARANCE, BottomNav } from '../components/BottomNav';
import { BalanceTile, useBalanceTiles } from '../components/LeaveBalanceCard';
import { Badge, EmptyState, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useCancelLeaveMutation,
  useGetMyBalanceQuery,
  useGetMyLeavesQuery,
  type Leave,
  type LeaveStatus,
} from '../store/leaveApi';
import { radius, shadow, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { fmtDate, fmtDayShort, MONTHS, parseYmd } from '../utils/date';

const TYPE_LABEL: Record<string, string> = {
  sl: 'Sick Leave',
  el: 'Annual Leave',
  unpaid: 'Unpaid Leave',
};

// Rejected reads violet rather than red: red is already the calendar's
// "absent", and a declined request is not an error state.
const STATUS: Record<LeaveStatus, { label: string; tone: Surface }> = {
  approved: { label: 'Approved', tone: surface.success },
  pending: { label: 'Pending', tone: surface.warning },
  rejected: { label: 'Rejected', tone: surface.purple },
  cancelled: { label: 'Cancelled', tone: surface.neutral },
};

/* ── Timeline row ─────────────────────────────────────────────────────────── */

function TimelineItem({
  leave,
  last,
  onCancel,
}: {
  leave: Leave;
  last: boolean;
  onCancel: () => void;
}) {
  const { c, dark } = useTheme();
  const status = STATUS[leave.status] ?? STATUS.pending;
  const span =
    leave.from_date === leave.to_date
      ? fmtDate(leave.from_date)
      : `${fmtDayShort(leave.from_date)} – ${fmtDate(leave.to_date)}`;

  return (
    <View className="flex-row" style={{ paddingHorizontal: space.screen }}>
      {/* Rail: dot + connector. A timeline reads as a sequence; a stack of
          identical cards reads as a pile. */}
      <View className="items-center" style={{ width: 22 }}>
        <View
          style={{ backgroundColor: status.tone.tint, borderColor: c.bg }}
          className="mt-5 h-3.5 w-3.5 rounded-full border-[3px]"
        />
        {last ? null : <View style={{ backgroundColor: c.border }} className="w-px flex-1" />}
      </View>

      <View
        style={{
          flex: 1,
          marginLeft: space.md,
          marginBottom: space.md,
          backgroundColor: c.card,
          borderRadius: radius.card,
          padding: space.lg,
          ...(dark ? shadow.none : shadow.card),
        }}
      >
        <View className="flex-row items-start justify-between">
          <Text
            style={{ color: c.text }}
            className="flex-1 pr-2 font-ui-semibold text-[15px]"
            numberOfLines={1}
          >
            {TYPE_LABEL[leave.type] ?? leave.type}
          </Text>
          <Badge label={status.label} tone={status.tone} />
        </View>

        <Text style={{ color: c.textMuted }} className="mt-1 font-ui-regular text-[12.5px]">
          {span} · {leave.days} {leave.days === 1 ? 'day' : 'days'}
          {leave.half_day ? ' · half day' : ''}
        </Text>

        {leave.reason ? (
          <Text
            style={{ color: c.textMuted }}
            className="mt-1.5 font-ui-regular text-[12.5px]"
            numberOfLines={2}
          >
            <Text style={{ color: c.textFaint }}>Reason: </Text>
            {leave.reason}
          </Text>
        ) : null}

        {leave.review_note ? (
          <Text
            style={{ color: c.textMuted }}
            className="mt-0.5 font-ui-regular text-[12.5px]"
            numberOfLines={2}
          >
            <Text style={{ color: c.textFaint }}>Admin: </Text>
            {leave.review_note}
          </Text>
        ) : null}

        {/* Only a pending request is still the employee's to withdraw. */}
        {leave.status === 'pending' ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Withdraw this leave request"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              backgroundColor: c.fill,
              borderRadius: radius.pill,
            })}
            className="mt-2.5 flex-row items-center gap-1.5 self-start px-3 py-1.5"
          >
            <X size={12} strokeWidth={2.4} color={c.textMuted} />
            <Text style={{ color: c.textMuted }} className="font-ui-semibold text-[12px]">
              Withdraw
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My leave — balance, request history and the entry point to the apply form.
 *
 * `GET /leave/me` takes no date range, so the month filter runs on the client.
 * That is the right trade: a personal leave history is tens of rows, and
 * filtering locally keeps the chips instant.
 */
export default function LeaveScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, primary, dark } = useTheme();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  /** `null` = the whole year. */
  const [month, setMonth] = useState<number | null>(null);

  const balance = useGetMyBalanceQuery();
  const { data, isLoading, isFetching, error, refetch } = useGetMyLeavesQuery({ limit: 100 });
  const [cancelLeave] = useCancelLeaveMutation();
  const tiles = useBalanceTiles(balance.data);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((l) => {
      const d = parseYmd(l.from_date);
      if (!d || d.getFullYear() !== year) return false;
      return month === null || d.getMonth() === month;
    });
  }, [data, year, month]);

  const onCancel = async (id: string) => {
    try {
      await cancelLeave(id).unwrap();
      toast.success('Leave request withdrawn');
    } catch (e) {
      toast.error(describeApiError(e).title);
    }
  };

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
            My Leave
          </Text>
          <Text style={{ color: brand[600] }} className="font-ui text-[12.5px]">
            {year}
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('LeaveApply')}
          accessibilityRole="button"
          accessibilityLabel="Apply for leave"
          style={({ pressed }) => ({
            backgroundColor: primary.bg,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          })}
          className="h-10 w-10 items-center justify-center"
        >
          <Plus size={20} strokeWidth={2.4} color={brand[600]} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 72 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              refetch();
              balance.refetch();
            }}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Balance strip ──────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.screen, gap: space.md }}
        >
          {balance.isLoading ? (
            <>
              <Skeleton height={124} width={168} radius={radius.card} />
              <Skeleton height={124} width={168} radius={radius.card} />
            </>
          ) : (
            <>
              {tiles.map((t) => (
                <BalanceTile
                  key={t.key}
                  label={t.label}
                  bucket={t.bucket}
                  tone={t.tone ?? primary}
                  variant={t.variant}
                />
              ))}
            </>
          )}
        </ScrollView>

        {/* ── Year stepper ───────────────────────────────────────────────── */}
        <View
          className="flex-row items-center gap-2"
          style={{ paddingHorizontal: space.screen, paddingTop: space.xl }}
        >
          <Pressable
            onPress={() => setYear((y) => y - 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ChevronLeft size={18} strokeWidth={2.2} color={c.textMuted} />
          </Pressable>
          <Text style={{ color: c.text }} className="font-ui-semibold text-[15px]">
            {year}
          </Text>
          {/* Nothing to show past the current year. */}
          {year < today.getFullYear() ? (
            <Pressable
              onPress={() => setYear((y) => y + 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next year"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <ChevronRight size={18} strokeWidth={2.2} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Month chips ────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingVertical: space.md,
            gap: space.sm,
          }}
        >
          {[null, ...MONTHS.map((_, i) => i)].map((m) => {
            const active = m === month;
            const label = m === null ? 'All' : MONTHS[m];
            return (
              <Pressable
                key={label}
                onPress={() => setMonth(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  backgroundColor: active ? brand[600] : c.card,
                  borderRadius: radius.pill,
                  borderWidth: active || dark ? 0 : 1,
                  borderColor: c.border,
                  opacity: pressed ? 0.75 : 1,
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

        <Text
          style={{ color: c.text, paddingHorizontal: space.screen, marginBottom: space.md }}
          className="font-ui-semibold text-[16px]"
        >
          Leave History
        </Text>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
            <Skeleton height={110} radius={radius.card} />
            <Skeleton height={110} radius={radius.card} />
            <Skeleton height={110} radius={radius.card} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={32} strokeWidth={1.6} color={brand[600]} />}
            title="No leave in this period"
            message={
              error
                ? describeApiError(error).title
                : 'Every request you apply for shows up here with its approval trail.'
            }
            actionLabel="Apply for leave"
            onAction={() => navigation.navigate('LeaveApply')}
          />
        ) : (
          items.map((l, i) => (
            <TimelineItem
              key={l._id}
              leave={l}
              last={i === items.length - 1}
              onCancel={() => onCancel(l._id)}
            />
          ))
        )}
      </ScrollView>

      {/* Sticky primary action. */}
      <Pressable
        onPress={() => navigation.navigate('LeaveApply')}
        accessibilityRole="button"
        accessibilityLabel="Apply for leave"
        style={({ pressed }) => ({
          position: 'absolute',
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
        <Text className="font-ui-semibold text-[14.5px] text-white">Apply Leave</Text>
      </Pressable>

      <BottomNav
        active="leaves"
        onSelect={(key) => {
          if (key === 'home') navigation.navigate('Dashboard');
          else if (key === 'attendance') navigation.navigate('Attendance');
          else if (key === 'apply') navigation.navigate('LeaveApply');
        }}
      />
    </View>
  );
}
