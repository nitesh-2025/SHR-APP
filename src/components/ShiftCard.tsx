import { CalendarClock, Clock3, Hourglass } from "lucide-react-native";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { shiftLabel, shiftMinutes } from "./AttendanceCard";
import { Skeleton } from "./ui";
import { useGetMyHistoryQuery } from "../store/attendanceApi";
import { radius, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDuration } from "../utils/date";

/** Enough recent days to be sure of finding one that carries a shift window. */
const LOOKBACK = 20;

function Fact({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone: Surface;
}) {
  const { c } = useTheme();
  return (
    <View className="flex-1 flex-row items-center gap-2.5">
      <Icon size={20} strokeWidth={2} color={tone.tint} />
      <View className="flex-1">
        <Text
          style={{ color: c.textMuted }}
          className={T.micro}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{ color: c.text }}
          className={`mt-0.5 ${T.cardTitleSm}`}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * Which shift this employee is on.
 *
 * It lives on the PROFILE, not on Attendance: a shift window is a fact about
 * the person, like their department or their employee id. Attendance is about
 * what happened on a given day, and putting a constant in among a month of
 * varying records made the constant look like one more reading.
 *
 * Derived from the shift the server stamps on every attendance record — there
 * is no endpoint for an employee's own schedule.
 */
export function ShiftCard() {
  const { c } = useTheme();
  const { data, isLoading } = useGetMyHistoryQuery({ limit: LOOKBACK });

  /** The most recent record that actually carries a shift window. */
  const source = useMemo(
    () =>
      [...(data?.items ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find((r) => r.shift_start && r.shift_end),
    [data],
  );

  if (isLoading) {
    return <Skeleton height={124} radius={radius.card} />;
  }

  const window = shiftLabel(source);
  const grace = source?.grace_minutes;

  return (
    <View
      style={{
        padding: space.lg,
      }}
    >
      <View className="flex-row items-center gap-2.5">
        <CalendarClock size={20} strokeWidth={2} color={surface.info.tint} />
        <View className="flex-1">
          <Text style={{ color: c.textMuted }} className={T.micro}>
            Shift window
          </Text>
          <Text
            style={{ color: c.text }}
            className={`mt-0.5 ${T.cardTitle}`}
            numberOfLines={1}
          >
            {window ?? "Not assigned"}
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: c.border }} className="my-4 h-px" />

      <View className="flex-row" style={{ gap: space.sm }}>
        <Fact
          icon={Hourglass}
          label="Shift length"
          value={fmtDuration(shiftMinutes(source))}
          tone={surface.purple}
        />
        <Fact
          icon={Clock3}
          label="Grace"
          value={grace ? `${grace} min` : "—"}
          tone={surface.warning}
        />
      </View>
    </View>
  );
}
