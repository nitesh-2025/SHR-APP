import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Skeleton } from './ui';
import { LONG_BREAK_MIN } from '../config/env';
import { describeApiError } from '../lib/apiError';
import {
  useGetMyTodayQuery,
  type AttendanceRecord,
} from '../store/attendanceApi';
import { radius, shadow, space } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDuration, fmtTime } from '../utils/date';

const DEFAULT_SHIFT_MINUTES = 8 * 60;

/**
 * The goal arc. Amber, not white: it is the one thing on this card that is a
 * MEASURE rather than a fact, and against a deep green fill amber is the only
 * accent that stays legible without introducing a second "status" colour.
 */
const GOAL_ARC = '#FBBF24';

/** Reanimated can only animate a component's props, not an SVG element itself. */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function timeOf(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** `"09:30"` → 570. Anything else → null. */
export function minutesOfDay(hhmm?: string): number | null {
  const parts = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
}

/** `09:00 AM – 06:00 PM`, or null when the record carries no shift window. */
export function shiftLabel(record?: AttendanceRecord | null): string | null {
  const s = record?.shift_start;
  const e = record?.shift_end;
  if (!s || !e) return null;
  const to12 = (hhmm: string) => {
    const m = minutesOfDay(hhmm);
    if (m === null) return hhmm;
    const h = Math.floor(m / 60);
    return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} ${
      h < 12 ? 'AM' : 'PM'
    }`;
  };
  return `${to12(s)} – ${to12(e)}`;
}

export function shiftMinutes(record?: AttendanceRecord | null): number {
  const start = minutesOfDay(record?.shift_start);
  const end = minutesOfDay(record?.shift_end);
  if (start === null || end === null) return DEFAULT_SHIFT_MINUTES;
  const span = end > start ? end - start : end + 24 * 60 - start;
  return span > 0 ? span : DEFAULT_SHIFT_MINUTES;
}

/**
 * Minutes actually worked so far.
 *
 * `total_work_minutes` is only recomputed server-side on a punch, so a session
 * running for two hours would still read as whatever it was at clock-in. The
 * elapsed part is derived from the clock here, minus the breaks already closed.
 */
export function workedMinutes(
  record: AttendanceRecord | null | undefined,
  now: number,
): number {
  if (!record) return 0;
  const started = timeOf(record.clock_in?.at);
  if (started === null) return record.total_work_minutes ?? 0;

  const breaks = record.total_break_minutes ?? 0;

  // On break the clock freezes at the moment the break began, so the number
  // doesn't keep climbing while the user is away from work.
  const until =
    record.state === 'on_break'
      ? (timeOf(record.breaks?.[record.breaks.length - 1]?.break_out?.at) ?? now)
      : record.state === 'clocked_out'
        ? (timeOf(record.clock_out?.at) ?? now)
        : now;

  return Math.max(0, (until - started) / 60000 - breaks);
}

/**
 * Minutes on the CURRENT break, live. Zero unless a break is actually running.
 *
 * `total_break_minutes` only counts breaks the server has already closed, so
 * the running one is invisible until you come back — which is exactly when you
 * no longer need to know.
 */
export function currentBreakMinutes(
  record: AttendanceRecord | null | undefined,
  now: number,
): number {
  if (record?.state !== 'on_break') return 0;
  const started = timeOf(record.breaks?.[record.breaks.length - 1]?.break_out?.at);
  return started === null ? 0 : Math.max(0, (now - started) / 60000);
}

/** Every break today, including the one still running. */
export function totalBreakMinutes(
  record: AttendanceRecord | null | undefined,
  now: number,
): number {
  return (record?.total_break_minutes ?? 0) + currentBreakMinutes(record, now);
}

/**
 * Re-renders every `ms` while `active`.
 *
 * One second, not thirty: the card shows running SECONDS, and a stopwatch that
 * jumps in half-minute steps reads as broken rather than as live.
 */
function useTicker(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** 342.5 minutes → `05:42:30`. */
function stopwatch(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/* ── Goal ring ────────────────────────────────────────────────────────────── */

/**
 * Completion dial. Sweeps up from zero on mount — the movement is what tells you
 * the number is live rather than printed.
 *
 * Kept to 96: at 112 it claimed the entire right half of the card and squeezed
 * the stopwatch and the two punch columns into whatever was left.
 */
function GoalRing({ progress, size = 96, stroke = 9 }: {
  progress: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;
  const target = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));

  const swept = useSharedValue(0);
  useEffect(() => {
    swept.value = withTiming(target, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [target, swept]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - swept.value),
  }));

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Rotated so the arc grows clockwise from 12 o'clock, like a dial. */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={GOAL_ARC}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arc}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text className={`${T.kpiSm} text-white`} allowFontScaling={false}>
        {Math.round(target * 100)}%
      </Text>
      <Text className={`${T.nano} text-white/75`}>of goal</Text>
    </View>
  );
}

/* ── Punch time column ────────────────────────────────────────────────────── */

function Punch({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text
        className={`${T.button} text-white`}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text className={`mt-0.5 ${T.secondary} text-white/70`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Today's attendance — the hero of the home screen.
 *
 * A filled gradient card, not another white one: this is the single thing an
 * employee opens the app to do, and it should not look like the cards around
 * it. The running total is a live stopwatch because "how long have I been on
 * today" is the question this card exists to answer.
 *
 * **No buttons.** Every punch lives on the bottom bar's centre button now, so
 * this is purely a readout — and it exists on one screen while the punch has to
 * exist on all of them.
 */
export function AttendanceCard() {
  const { brand } = useTheme();
  const { data: record, isLoading, error } = useGetMyTodayQuery();

  const state = record?.state;
  const onBreak = state === 'on_break';
  // Ticks on break too — the break timer is the whole point of that state.
  const now = useTicker(state === 'clocked_in' || onBreak);

  const worked = workedMinutes(record, now);
  const progress = worked / shiftMinutes(record);
  const failed = Boolean(error);

  const breakNow = currentBreakMinutes(record, now);
  const breakTotal = totalBreakMinutes(record, now);
  /** Past the allowance. The number turns amber rather than raising an alert. */
  const breakOverrun = onBreak && breakNow > LONG_BREAK_MIN;

  const breakValue = breakTotal > 0 ? fmtDuration(breakTotal) : '--:--';

  /**
   * On a break the hero number becomes the BREAK stopwatch.
   *
   * A frozen worked-total answers "how much have I done"; mid-break the live
   * question is "how long have I been gone", and that is the only number that
   * is still moving. The worked total does not disappear — it is one line down,
   * in the punch row.
   */
  const heroMinutes = onBreak ? breakNow : worked;

  /**
   * The line under the stopwatch. It replaces the status chip, so it has to say
   * both what the number IS and what state the day is in — "Hours Worked" alone
   * would leave a frozen stopwatch looking broken rather than paused.
   */
  const statusLine = failed
    ? describeApiError(error).title
    : state === 'clocked_in'
      ? 'Hours Worked'
      : onBreak
        ? breakOverrun
          ? `On break · over ${fmtDuration(LONG_BREAK_MIN)}`
          : 'On break · work paused'
        : state === 'clocked_out'
          ? 'Day complete'
          : 'Not clocked in yet';

  if (isLoading) {
    return (
      <View style={{ marginHorizontal: space.screen }}>
        <Skeleton height={176} radius={radius.card} />
      </View>
    );
  }

  return (
    <>
      <LinearGradient
        // Deep, muted green — not the bright ramp mid-tone. A saturated green
        // this large stops being a surface and starts being a signal.
        colors={[brand[700], brand[900]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          marginHorizontal: space.screen,
          borderRadius: radius.card,
          padding: space.lg + 2,
          ...shadow.card,
        }}
      >
        {/* ── Eyebrow + stopwatch + goal ─────────────────────────────────
            The ring is lifted to the top-right and the glass status chip is
            gone. The chip was only ever a word, and the line under the
            stopwatch can carry that word for free — which buys the ring the
            whole right column instead of a slot below the header. */}
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <Text
              style={{ letterSpacing: 0.6 }}
              className={`${T.badge} text-white/85`}
            >
              TODAY&apos;S STATUS
            </Text>

            <Text
              style={{ color: breakOverrun ? GOAL_ARC : '#FFFFFF' }}
              className={`mt-2.5 ${T.kpiHero}`}
              allowFontScaling={false}
            >
              {stopwatch(heroMinutes)}
            </Text>
            <Text
              style={{ color: breakOverrun ? GOAL_ARC : 'rgba(255,255,255,0.75)' }}
              className={T.body}
              numberOfLines={1}
            >
              {statusLine}
            </Text>
          </View>

          <GoalRing progress={progress} />
        </View>

        {/* ── Punches ────────────────────────────────────────────────────
            One row across the FULL card width, break in the middle — that is
            the order the day actually happens in. Sharing the row with the ring
            left three columns fighting over ~220px and the times truncating. */}
        <View className="mt-5 flex-row items-center">
          <Punch label="Check In" value={fmtTime(record?.clock_in?.at) ?? '--:--'} />
          <View className="h-9 w-px bg-white/20" />
          {/* While the hero shows the running break, this column carries the
              worked total so neither number is ever off-screen. */}
          {onBreak ? (
            <Punch label="Worked" value={fmtDuration(worked)} />
          ) : (
            <Punch label="Break" value={breakValue} />
          )}
          <View className="h-9 w-px bg-white/20" />
          <Punch label="Check Out" value={fmtTime(record?.clock_out?.at) ?? '--:--'} />
        </View>

      </LinearGradient>
    </>
  );
}
