import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Coffee, LogIn, LogOut, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Skeleton } from './ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import {
  useBreakInMutation,
  useBreakOutMutation,
  useClockInMutation,
  useClockOutMutation,
  useGetMyTodayQuery,
  type AttendanceRecord,
  type PunchBody,
} from '../store/attendanceApi';
import { radius, shadow, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { fmtDuration, fmtTime } from '../utils/date';

const DEFAULT_SHIFT_MINUTES = 8 * 60;

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

function shiftMinutes(record?: AttendanceRecord | null): number {
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

/** Re-renders every `ms` while `active` — drives the live duration. */
function useTicker(active: boolean, ms = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/* ── Ring (on the coloured card, so it draws in white) ────────────────────── */

function Ring({ progress, size = 96, stroke = 8 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Rotated so the arc grows clockwise from 12 o'clock, like a dial. */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="#FFFFFF"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - p)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text className="font-display text-[19px] text-white" allowFontScaling={false}>
        {Math.round(p * 100)}%
      </Text>
      <Text className="font-ui-regular text-[10px] text-white/70">Completed</Text>
    </View>
  );
}

/* ── Button that lives ON the coloured card ───────────────────────────────── */

function CardButton({
  label,
  icon: Icon,
  onPress,
  solid = false,
  busy = false,
  disabled = false,
}: {
  label: string;
  icon: typeof LogIn;
  onPress: () => void;
  /** White fill — the action to take right now. */
  solid?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const { brand } = useTheme();
  const off = disabled || busy;
  const fg = solid ? brand[700] : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => ({
        flex: 1,
        height: 46,
        borderRadius: radius.button,
        backgroundColor: solid ? '#FFFFFF' : 'rgba(255,255,255,0.14)',
        borderWidth: solid ? 0 : 1.5,
        borderColor: 'rgba(255,255,255,0.5)',
        opacity: off ? 0.55 : pressed ? 0.85 : 1,
      })}
      className="flex-row items-center justify-center gap-2"
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon size={17} strokeWidth={2.2} color={fg} />
      )}
      <Text style={{ color: fg }} className="font-ui-semibold text-[13.5px]">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Today's attendance — the hero of the home screen.
 *
 * A filled accent card, not another white one: this is the single thing an
 * employee opens the app to do, and it should not look like the cards around
 * it. The actions are named on the card — an employee mid-shift must never
 * have to guess where Break and Clock Out are — with hierarchy coming from
 * fill vs outline rather than from hiding one of them.
 */
export function AttendanceCard({ onViewAll }: { onViewAll?: () => void }) {
  const { brand, primary } = useTheme();
  const { data: record, isLoading, error } = useGetMyTodayQuery();

  const [clockIn, clockInState] = useClockInMutation();
  const [clockOut, clockOutState] = useClockOutMutation();
  const [breakOut, breakOutState] = useBreakOutMutation();
  const [breakIn, breakInState] = useBreakInMutation();

  const state = record?.state;
  const now = useTicker(state === 'clocked_in');
  const worked = workedMinutes(record, now);
  const progress = worked / shiftMinutes(record);
  const inAt = fmtTime(record?.clock_in?.at);
  const failed = Boolean(error);

  const punch = async (
    fn: (body: PunchBody) => { unwrap: () => Promise<unknown> },
    okMessage: string,
  ) => {
    try {
      await fn(undefined).unwrap();
      toast.success(okMessage);
    } catch (e) {
      toast.error(describeApiError(e).title);
    }
  };

  const statusLabel = failed
    ? 'Unavailable'
    : state === 'clocked_in'
      ? 'Working'
      : state === 'on_break'
        ? 'On Break'
        : state === 'clocked_out'
          ? 'Day Complete'
          : 'Not Clocked In';

  const busy = clockInState.isLoading || clockOutState.isLoading;

  if (isLoading) {
    return (
      <View style={{ marginHorizontal: space.screen }}>
        <Skeleton height={230} radius={radius.card} />
      </View>
    );
  }

  return (
    <>
      <LinearGradient
        colors={[brand[600], brand[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          marginHorizontal: space.screen,
          borderRadius: radius.card,
          padding: space.lg + 2,
          ...shadow.card,
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between">
          <Text className="font-ui-semibold text-[15px] text-white">
            Today&apos;s Attendance
          </Text>
          <Pressable
            onPress={onViewAll}
            disabled={!onViewAll}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="View attendance details"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="flex-row items-center gap-0.5"
          >
            <Text className="font-ui-semibold text-[12.5px] text-white/85">View Details</Text>
            <ChevronRight size={14} strokeWidth={2.2} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        {/* ── Ring + times ───────────────────────────────────────────────── */}
        <View className="mt-4 flex-row items-center gap-4">
          <Ring progress={progress} />

          <View className="flex-1">
            <Text className="font-ui-regular text-[11.5px] text-white/70">Clock In</Text>
            <Text className="font-display text-[22px] leading-7 text-white">
              {inAt ?? '--:-- AM'}
            </Text>

            <View
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill }}
              className="mt-1.5 self-start px-2.5 py-1"
            >
              <Text className="font-ui-semibold text-[10.5px] text-white">{statusLabel}</Text>
            </View>

            <Text className="mt-2.5 font-ui-regular text-[11.5px] text-white/70">
              Working Hours
            </Text>
            <Text className="font-ui-semibold text-[14px] text-white">
              {fmtDuration(worked)}
            </Text>
          </View>
        </View>

        {/* ── Actions ────────────────────────────────────────────────────
            Named buttons, on the card. "Manage Attendance" hid the two things
            the user actually needs mid-shift — where Break and Clock Out live
            should never be a guess. Hierarchy comes from fill vs outline, not
            from hiding one of them. */}
        <View className="mt-4 flex-row gap-2.5">
          {!state ? (
            <CardButton
              label="Clock In"
              icon={LogIn}
              solid
              busy={clockInState.isLoading}
              disabled={failed}
              onPress={() => punch(clockIn, 'Clocked in')}
            />
          ) : state === 'clocked_out' ? (
            <CardButton
              label="View Summary"
              icon={ChevronRight}
              disabled={!onViewAll}
              onPress={() => onViewAll?.()}
            />
          ) : (
            <>
              {state === 'clocked_in' ? (
                <CardButton
                  label="Start Break"
                  icon={Coffee}
                  busy={breakOutState.isLoading}
                  onPress={() => punch(breakOut, 'Break started')}
                />
              ) : (
                <CardButton
                  label="End Break"
                  icon={Play}
                  busy={breakInState.isLoading}
                  onPress={() => punch(breakIn, 'Welcome back')}
                />
              )}
              <CardButton
                label="Clock Out"
                icon={LogOut}
                solid
                busy={clockOutState.isLoading}
                onPress={() => punch(clockOut, 'Clocked out')}
              />
            </>
          )}
        </View>

        <Text className="mt-2.5 text-center font-ui-regular text-[11px] text-white/70">
          {failed
            ? describeApiError(error).title
            : !state
              ? "You're all set to make today great!"
              : state === 'on_break'
                ? 'On a break — the clock is paused.'
                : state === 'clocked_out'
                  ? `Great work today · ${fmtDuration(worked)} logged.`
                  : 'Have a productive shift!'}
        </Text>
      </LinearGradient>

    </>
  );
}
