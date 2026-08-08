import { useNavigation } from '@react-navigation/native';
import { CalendarRange, FileWarning, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, EmptyState, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import {
  useGetMyLeavesQuery,
  type Leave,
  type LeaveStatus,
  type LeaveType,
} from '../store/leaveApi';
import { radius, shadow, space, surface, toneFor, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDayShort } from '../utils/date';

/* ── Status ───────────────────────────────────────────────────────────────── */

// Rejected reads violet rather than red — the same call the My Leave screen
// makes, and for the same reason: red already means "absent" elsewhere, and a
// declined request is a decision, not an error.
const STATUS: Record<LeaveStatus, { label: string; tone: Surface }> = {
  approved: { label: 'Approved', tone: surface.success },
  pending: { label: 'Pending', tone: surface.warning },
  rejected: { label: 'Rejected', tone: surface.purple },
  cancelled: { label: 'Cancelled', tone: surface.neutral },
};

const TYPE_LABEL: Record<LeaveType, string> = {
  sl: 'Sick / Emergency',
  el: 'Earned',
  unpaid: 'Unpaid',
};

/* ── Summary ──────────────────────────────────────────────────────────────── */

/**
 * The three numbers that answer "so where do I stand".
 *
 * Counts rather than filter chips: this page is short and already sorted
 * newest-first, so a filter would hide rows to save a scroll that is two
 * flicks long. The pending figure is the one anybody opened this for.
 */
function Summary({ items }: { items: Leave[] }) {
  const { c, dark } = useTheme();

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const l of items) {
      if (l.status === 'pending') pending += 1;
      else if (l.status === 'approved') approved += 1;
      else if (l.status === 'rejected') rejected += 1;
    }
    return [
      { label: 'Pending', value: pending, tone: surface.warning },
      { label: 'Approved', value: approved, tone: surface.success },
      { label: 'Rejected', value: rejected, tone: surface.purple },
    ];
  }, [items]);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        paddingVertical: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
      className="flex-row items-center"
    >
      {counts.map((f, i) => {
        const tone = toneFor(f.tone, dark);
        return (
          <View key={f.label} className="flex-1 flex-row items-center">
            {i > 0 ? (
              <View style={{ backgroundColor: c.border }} className="h-8 w-px" />
            ) : null}
            <View className="flex-1 items-center">
              <Text
                style={{ color: f.value ? tone.tint : c.textFaint }}
                className={T.kpiSm}
                allowFontScaling={false}
              >
                {f.value}
              </Text>
              <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
                {f.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

/**
 * One request I sent, and where it got to.
 *
 * Deliberately thinner than the My Leave card: this page answers "did it go
 * through, and has anyone looked at it", not "what did I take in March". Dates,
 * days, status — and the reviewer's note only once there IS one, because an
 * empty "Note" heading reads as a note that failed to load.
 */
function RequestCard({ item, index }: { item: Leave; index: number }) {
  const { c, dark } = useTheme();
  const still = useReducedMotion();

  const spec = STATUS[item.status] ?? STATUS.pending;
  const tone = toneFor(spec.tone, dark);

  const span =
    item.from_date === item.to_date
      ? fmtDayShort(item.from_date)
      : `${fmtDayShort(item.from_date)} → ${fmtDayShort(item.to_date)}`;

  return (
    <Animated.View
      entering={
        still ? undefined : FadeInDown.delay(Math.min(index, 6) * 40).duration(240)
      }
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-center gap-3">
        {/* The day count is the headline — it is the number that left the
            balance, and the one worth checking against what you asked for. */}
        <View
          style={{ backgroundColor: tone.bg, borderRadius: radius.well - 2 }}
          className="h-12 w-12 items-center justify-center"
        >
          <Text
            style={{ color: tone.text }}
            className={T.cardTitle}
            allowFontScaling={false}
          >
            {item.days}
          </Text>
          <Text style={{ color: tone.text }} className={T.nano} allowFontScaling={false}>
            {item.days === 1 ? 'day' : 'days'}
          </Text>
        </View>

        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
            {TYPE_LABEL[item.type] ?? item.type}
            {item.half_day ? ' · half day' : ''}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {span}
          </Text>
        </View>

        <Badge label={spec.label} tone={spec.tone} />
      </View>

      {item.reason ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-3 leading-5 ${T.micro}`}
          numberOfLines={2}
        >
          {item.reason}
        </Text>
      ) : null}

      {item.review_note || (item.status !== 'pending' && item.reviewer_name) ? (
        <View
          style={{
            marginTop: space.md,
            backgroundColor: tone.bg,
            borderRadius: radius.well,
            borderWidth: 1,
            borderColor: tone.border,
          }}
          className="px-3 py-2"
        >
          <Text style={{ color: tone.text }} className={`leading-5 ${T.micro}`}>
            {item.review_note || `${spec.label} by ${item.reviewer_name}`}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Everything I have asked for, newest first.
 *
 * Its own page rather than a tab hidden inside the apply form: "did my leave go
 * through" is a question people come back to on a different day, and an answer
 * you can only reach by first opening a blank application form is an answer
 * nobody finds. Deliberately unfiltered — the My Leave screen is the archive
 * with month and status pickers; this is the receipt.
 */
export default function LeaveRequestsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();

  const mine = useGetMyLeavesQuery({ limit: 50 });

  const items = useMemo(
    () =>
      [...(mine.data?.items ?? [])].sort((a, b) =>
        String(b.createdAt ?? b.from_date).localeCompare(
          String(a.createdAt ?? a.from_date),
        ),
      ),
    [mine.data],
  );

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="My requests"
        subtitle={
          items.length ? `${items.length} in total` : 'Leave you have applied for'
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + 96,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={mine.isFetching && !mine.isLoading}
            onRefresh={() => mine.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {mine.isLoading ? (
          <>
            <Skeleton height={92} radius={radius.card - 4} />
            <Skeleton height={116} radius={radius.card - 4} />
            <Skeleton height={116} radius={radius.card - 4} />
            <Skeleton height={116} radius={radius.card - 4} />
          </>
        ) : mine.error ? (
          <EmptyState
            icon={<FileWarning size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your requests"
            message={describeApiError(mine.error).title}
            actionLabel="Try again"
            onAction={() => mine.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarRange size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Nothing requested yet"
            message="Whatever you apply for shows up here with its status, and the reviewer's note once someone has decided."
            actionLabel="Apply for leave"
            onAction={() => navigation.navigate('LeaveApply' as never)}
          />
        ) : (
          <>
            <Summary items={items} />
            {items.map((item, i) => (
              <RequestCard key={item._id} item={item} index={i} />
            ))}
          </>
        )}
      </ScrollView>

      {/* A list of past requests is where you stand when you decide to file the
          next one, so the way to do that is on this page rather than a back-tap
          away. Floating, not sticky: the list is the content, and a bar across
          the bottom of a read-only page is a bar in the way. */}
      {items.length ? (
        <Pressable
          onPress={() => navigation.navigate('LeaveApply' as never)}
          accessibilityRole="button"
          accessibilityLabel="Apply for leave"
          style={{
            position: 'absolute',
            right: space.screen,
            bottom: insets.bottom + space.lg,
            height: 52,
            paddingHorizontal: space.xl,
            borderRadius: radius.pill,
            backgroundColor: brand[600],
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            ...(dark ? shadow.none : shadow.floating),
          }}
        >
          <Plus size={19} strokeWidth={2.4} color="#FFFFFF" />
          <Text
            style={{ color: '#FFFFFF', fontFamily: 'Outfit_600SemiBold', fontSize: 15 }}
            allowFontScaling={false}
          >
            Apply
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
