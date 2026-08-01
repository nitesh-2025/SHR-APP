import {
  AlertCircle,
  Coffee,
  LogIn,
  LogOut,
  Play,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { currentBreakMinutes, shiftMinutes, workedMinutes } from './AttendanceCard';
import { BottomSheet } from './BottomSheet';
import { Button } from './ui';
import { LONG_BREAK_MIN } from '../config/env';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import {
  useBreakInMutation,
  useBreakOutMutation,
  useClockInMutation,
  useClockOutMutation,
  useGetMyTodayQuery,
  type PunchBody,
} from '../store/attendanceApi';
import { radius, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDuration, fmtTime } from '../utils/date';

/** The sheet swaps its contents rather than opening a second sheet. See below. */
type Step = 'actions' | 'confirmOut';

interface Row {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Surface;
  busy: boolean;
  run: () => void;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-1 items-center">
      <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: tone ?? c.text }}
        className={`mt-0.5 ${T.cardTitleSm}`}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}

/** A failure, said where the tap happened rather than in a toast that flies by. */
function ErrorNote({ text }: { text: string }) {
  return (
    <View
      style={{ backgroundColor: surface.danger.bg, borderRadius: radius.well }}
      className="mt-4 flex-row items-start gap-2.5 px-4 py-3"
    >
      <AlertCircle size={17} strokeWidth={2} color={surface.danger.tint} />
      <Text
        style={{ color: surface.danger.text }}
        className={`flex-1 leading-5 ${T.secondary}`}
      >
        {text}
      </Text>
    </View>
  );
}

function ActionRow({ row, disabled }: { row: Row; disabled: boolean }) {
  const { c } = useTheme();
  const Icon = row.icon;

  return (
    <Pressable
      onPress={row.run}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityState={{ disabled, busy: row.busy }}
      style={({ pressed }) => ({
        backgroundColor: c.fill,
        borderRadius: radius.well,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
      className="flex-row items-center gap-3 px-4 py-3.5"
    >
      <View
        style={{ backgroundColor: row.tone.tint, borderRadius: radius.well - 4 }}
        className="h-10 w-10 items-center justify-center"
      >
        {row.busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon size={20} strokeWidth={2.2} color="#FFFFFF" />
        )}
      </View>

      <View className="flex-1">
        <Text style={{ color: c.text }} className={T.cardTitleSm}>
          {row.label}
        </Text>
        <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.caption}`}>
          {row.hint}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Every punch, in one place, opened from the bottom bar's centre button.
 *
 * The actions used to live on the attendance card, which meant they only
 * existed on the home screen — an employee on the Leave tab had to navigate
 * back just to clock out. Here they are one tap from anywhere, and the sheet
 * owns the mutations itself, so no screen has to wire it up.
 *
 * **Clock-out confirmation is a STEP, not a second sheet.** Opening a confirm
 * sheet while this one was still running its 210ms exit put two `<Modal>`s on
 * screen at once, and Android hands the touches to the wrong one — the confirm
 * appeared and its buttons did nothing. One modal, two steps, no stacking.
 */
export function PunchSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c, brand } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const { data: record } = useGetMyTodayQuery();

  const [clockIn, clockInState] = useClockInMutation();
  const [clockOut, clockOutState] = useClockOutMutation();
  const [breakOut, breakOutState] = useBreakOutMutation();
  const [breakIn, breakInState] = useBreakInMutation();

  const [step, setStep] = useState<Step>('actions');
  const [error, setError] = useState('');

  // Always reopen on the action list. Coming back to a half-finished confirm
  // from a previous session is nobody's expectation.
  useEffect(() => {
    if (visible) {
      setStep('actions');
      setError('');
    }
  }, [visible]);

  const state = record?.state;
  const onBreak = state === 'on_break';
  // The sheet is short-lived, so a snapshot on open is enough — no ticker.
  const now = Date.now();
  const worked = workedMinutes(record, now);
  const breakNow = currentBreakMinutes(record, now);
  const breakOverrun = onBreak && breakNow > LONG_BREAK_MIN;
  const remaining = Math.max(0, shiftMinutes(record) - worked);

  // One break a day — see the same rule on the attendance card.
  const breakTaken = (record?.breaks ?? []).some(
    (b) => b.break_out?.at && b.break_in?.at,
  );

  const busy =
    clockInState.isLoading ||
    clockOutState.isLoading ||
    breakOutState.isLoading ||
    breakInState.isLoading;

  const punch = async (
    fn: (body: PunchBody) => { unwrap: () => Promise<unknown> },
    okMessage: string,
  ) => {
    setError('');
    try {
      await fn(undefined).unwrap();
      toast.success(okMessage);
      onClose();
    } catch (e) {
      // Stay exactly where the tap happened and say what went wrong INLINE.
      // Bouncing back to the action list on failure is what made "Yes" look
      // like it did nothing: the sheet simply reverted, and a toast is easy to
      // miss when your eyes are on the button you just pressed.
      setError(describeApiError(e).title);
    }
  };

  const rows: Row[] = [];

  if (!state) {
    rows.push({
      key: 'in',
      label: 'Clock In',
      hint: 'Start your day',
      icon: LogIn,
      tone: surface.success,
      busy: clockInState.isLoading,
      run: () => punch(clockIn, 'Clocked in'),
    });
  } else if (state !== 'clocked_out') {
    if (state === 'clocked_in' && !breakTaken) {
      rows.push({
        key: 'break',
        label: 'Start Break',
        hint: 'Pauses the clock',
        icon: Coffee,
        tone: surface.warning,
        busy: breakOutState.isLoading,
        run: () => punch(breakOut, 'Break started'),
      });
    }
    if (onBreak) {
      rows.push({
        key: 'resume',
        label: 'Resume Work',
        hint: 'Restarts the clock',
        icon: Play,
        tone: surface.info,
        busy: breakInState.isLoading,
        run: () => punch(breakIn, 'Welcome back'),
      });
    }
    rows.push({
      key: 'out',
      label: 'Clock Out',
      hint: 'Ends your shift',
      icon: LogOut,
      tone: surface.danger,
      busy: clockOutState.isLoading,
      run: () => setStep('confirmOut'),
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.66}>
      {/* `flexShrink: 1`, NOT a maxHeight of its own.

          This used to be `maxHeight: screenHeight * 0.58`, and that number is
          not the space this ScrollView actually gets: the panel caps at 0.66 ×
          screen and then spends part of it on the grab handle (~22px) and on
          `paddingBottom: insets.bottom + 8` (up to ~56px with a 3-button nav
          bar). On anything but a tall phone with slim insets, 0.58 × screen is
          MORE than what is left — and because RN defaults to `flexShrink: 0`,
          the ScrollView was not shrunk to fit. It overflowed the panel, the
          overflow was clipped, and it still believed its viewport was the full
          0.58 so it never became scrollable. The clipped part is the bottom,
          which is exactly where "Yes, Clock Out" sat.

          Shrinking instead means the panel decides, and anything that no longer
          fits scrolls rather than disappears. */}
      <ScrollView
        // `flexGrow: 0` alongside it, so a short action list does not stretch
        // the sheet to its cap — the panel stays as tall as its content.
        style={{ flexShrink: 1, flexGrow: 0 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingTop: space.sm,
          paddingBottom: step === 'confirmOut' ? space.sm : space.screen,
        }}
      >
        {step === 'confirmOut' ? (
          /* ── Confirm ──────────────────────────────────────────────────── */
          <>
            <View
              style={{ backgroundColor: surface.danger.bg, borderRadius: radius.pill }}
              className="h-14 w-14 items-center justify-center self-center"
            >
              <LogOut size={26} strokeWidth={2} color={surface.danger.tint} />
            </View>

            <Text
              style={{ color: c.text }}
              className={`mt-4 text-center ${T.cardTitle}`}
            >
              Clock out for today?
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-2 text-center leading-5 ${T.secondary}`}
            >
              This ends your shift. You will need an admin to reopen the day.
            </Text>

            <View
              style={{
                backgroundColor: c.fill,
                borderRadius: radius.well,
                paddingVertical: space.md,
                marginTop: space.lg,
              }}
              className="flex-row items-center"
            >
              <Stat label="Clocked in" value={fmtTime(record?.clock_in?.at) ?? '--:--'} />
              <View style={{ backgroundColor: c.border }} className="h-8 w-px" />
              <Stat label="Worked" value={fmtDuration(worked)} />
              <View style={{ backgroundColor: c.border }} className="h-8 w-px" />
              <Stat label="Break" value={fmtDuration(record?.total_break_minutes ?? 0)} />
            </View>

          </>
        ) : (
          /* ── Actions ──────────────────────────────────────────────────── */
          <View style={{ gap: space.sm }}>
            <Text style={{ color: c.text }} className={T.section}>
              Attendance
            </Text>

            {/* The numbers first — you decide what to punch based on where the
                day currently stands. */}
            <View
              style={{
                backgroundColor: c.fill,
                borderRadius: radius.well,
                paddingVertical: space.md,
                marginBottom: space.xs,
              }}
              className="flex-row items-center"
            >
              <Stat label="Clocked in" value={fmtTime(record?.clock_in?.at) ?? '--:--'} />
              <View style={{ backgroundColor: c.border }} className="h-8 w-px" />
              <Stat label="Worked" value={fmtDuration(worked)} />
              <View style={{ backgroundColor: c.border }} className="h-8 w-px" />
              {/* Mid-break the number worth showing is the break, not the shift
                  remainder — that is the one being spent right now. */}
              <Stat
                label={onBreak ? 'On break' : 'Remaining'}
                value={fmtDuration(onBreak ? breakNow : remaining)}
                tone={breakOverrun ? surface.warning.text : undefined}
              />
            </View>

            {error ? <ErrorNote text={error} /> : null}

            {rows.length === 0 ? (
              <Text
                style={{ color: c.textMuted }}
                className={`py-4 text-center ${T.secondary}`}
              >
                Day complete — nothing left to punch.
              </Text>
            ) : (
              rows.map((r) => <ActionRow key={r.key} row={r} disabled={busy} />)
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Decision footer ──────────────────────────────────────────────
          Pinned OUTSIDE the ScrollView on purpose. A confirm sheet whose only
          two buttons live at the bottom of a scrolling area is one short screen
          away from having no visible way to say yes — and a user who cannot see
          "Yes" does not conclude "I should scroll", they conclude the app is
          broken. The summary above may scroll; the decision never does.

          The error sits here too, for the same reason: a failed clock-out has
          to be readable next to the button that failed. */}
      {step === 'confirmOut' ? (
        <View
          style={{
            paddingHorizontal: space.screen,
            paddingTop: space.md,
            paddingBottom: space.xs,
            // Its own surface with a hairline above it, so the pair reads as a
            // decision BAR rather than as two shapes floating at the bottom of
            // a white sheet.
            backgroundColor: c.card,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {error ? <ErrorNote text={error} /> : null}

          {/* No `className` on this row — a function-free plain style keeps it
              clear of the one NativeWind merge that has already cost this app a
              button (see the note in `ui.tsx`). */}
          <View
            style={{
              flexDirection: 'row',
              gap: space.md,
              marginTop: space.lg,
            }}
          >
            {/* `secondary`, not `ghost`. Ghost is transparent with a hairline —
                on a white sheet that is a button you have to hunt for, and the
                way out of a confirm should never be the hard one to find. */}
            <Button
              label="No, not yet"
              variant="secondary"
              full={false}
              disabled={clockOutState.isLoading}
              onPress={() => setStep('actions')}
              style={{ flex: 1 }}
            />
            {/* `primary` = solid brand fill, white type. The most contrast the
                system has, which is what the committing action needs. */}
            <Button
              label="Yes, Clock Out"
              variant="primary"
              full={false}
              loading={clockOutState.isLoading}
              onPress={() => punch(clockOut, 'Clocked out')}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}
