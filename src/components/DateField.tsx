import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { fmtDate, parseYmd, WEEKDAYS, ymd, MONTHS_LONG } from '../utils/date';

/**
 * Date input with an inline month grid.
 *
 * Deliberately NOT a modal: this is used inside a form that itself sits on a
 * pushed screen, and a picker modal over a modal is the one combination that
 * misbehaves on Android. Expanding in place also keeps the rest of the form
 * visible while a date is chosen.
 *
 * No date-picker dependency either — the grid is ~40 lines and renders the same
 * on both platforms, which the native pickers famously do not.
 */
/** Years shown per page in the year grid — 4 columns × 6 rows. */
const YEAR_PAGE = 24;

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  fill,
}: {
  label: string;
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (next: string) => void;
  /** Earliest selectable day, `YYYY-MM-DD`. Days before it render inert. */
  min?: string;
  /** Latest selectable day, `YYYY-MM-DD`. A date of birth cannot be tomorrow. */
  max?: string;
  /** Shown when there is no value yet, in place of a formatted date. */
  placeholder?: string;
  /**
   * Trigger background. Defaults to `card`, which is right on a `bg` canvas —
   * a form that inverts that (white page, recessed fields) passes its own.
   */
  fill?: string;
}) {
  // `tint`, not `primary` — the latter is the as-authored light recipe, whose
  // 50-step fill is a near-white slab on a dark canvas.
  const { brand, c, tint } = useTheme();
  const [open, setOpen] = useState(false);

  /**
   * Which grid is showing.
   *
   * A date of birth is ~30 years back, and month-at-a-time navigation makes
   * that 360 taps. Tapping the title drops to years → months → days, which is
   * three taps to anywhere — the same flow as the platform pickers, so nobody
   * has to be taught it.
   */
  const [view, setView] = useState<"days" | "months" | "years">("days");

  const selected = parseYmd(value) ?? new Date();
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  /** First year of the visible year page. */
  const [yearPage, setYearPage] = useState(
    () => selected.getFullYear() - (selected.getFullYear() % YEAR_PAGE),
  );

  const minDate = parseYmd(min);
  const maxDate = parseYmd(max);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  // Leading blanks so the 1st lands under its weekday column.
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pick = (day: number) => {
    onChange(ymd(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
    setOpen(false);
  };

  return (
    <View className="flex-1">
      <Text style={{ color: c.textMuted }} className="mb-1.5 font-ui-semibold text-[12.5px]">
        {label}
      </Text>

      <Pressable
        onPress={() => {
          setOpen((o) => !o);
          setView("days");
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? fmtDate(value) : "not set"}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          backgroundColor: fill ?? c.card,
          borderColor: open ? brand[500] : c.border,
          opacity: pressed ? 0.8 : 1,
        })}
        className="h-12 flex-row items-center gap-2 rounded-2xl border px-3"
      >
        <View
          style={{ backgroundColor: tint.bg, borderColor: tint.border }}
          className="h-7 w-7 items-center justify-center rounded-lg border"
        >
          <CalendarDays size={14} strokeWidth={2.2} color={brand[600]} />
        </View>
        <Text
          style={{ color: value ? c.text : c.textFaint }}
          className="flex-1 font-ui text-[13.5px]"
          numberOfLines={1}
        >
          {value ? fmtDate(value) : (placeholder ?? "Select a date")}
        </Text>
      </Pressable>

      {open ? (
        <View
          style={{ backgroundColor: c.card, borderColor: c.border }}
          className="mt-2 rounded-2xl border p-3"
        >
          {/* Nav. The arrows step whatever is on screen — a month, or a page
              of years — so one control serves all three grids. */}
          <View className="flex-row items-center justify-between pb-2">
            <Pressable
              onPress={() =>
                view === "years"
                  ? setYearPage((p) => p - YEAR_PAGE)
                  : view === "months"
                    ? setCursor(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1))
                    : setCursor(
                        new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                      )
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous"
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: tint.bg }}
            >
              <ChevronLeft size={15} strokeWidth={2.2} color={brand[600]} />
            </Pressable>

            {/* The title is the way UP a level: days → months → years. */}
            <Pressable
              onPress={() => {
                if (view === "days") setView("months");
                else if (view === "months") {
                  setYearPage(
                    cursor.getFullYear() - (cursor.getFullYear() % YEAR_PAGE),
                  );
                  setView("years");
                } else setView("days");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                view === "days"
                  ? "Choose a month"
                  : view === "months"
                    ? "Choose a year"
                    : "Back to days"
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                backgroundColor: tint.bg,
              })}
              className="flex-row items-center gap-1 rounded-full px-3 py-1"
            >
              <Text style={{ color: c.text }} className="font-ui-semibold text-[13px]">
                {view === "years"
                  ? `${yearPage} – ${yearPage + YEAR_PAGE - 1}`
                  : view === "months"
                    ? cursor.getFullYear()
                    : `${MONTHS_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`}
              </Text>
              <ChevronDown size={13} strokeWidth={2.4} color={brand[600]} />
            </Pressable>

            <Pressable
              onPress={() =>
                view === "years"
                  ? setYearPage((p) => p + YEAR_PAGE)
                  : view === "months"
                    ? setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))
                    : setCursor(
                        new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                      )
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next"
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: tint.bg }}
            >
              <ChevronRight size={15} strokeWidth={2.2} color={brand[600]} />
            </Pressable>
          </View>

          {view === "years" ? (
            <View className="flex-row flex-wrap">
              {Array.from({ length: YEAR_PAGE }, (_, i) => yearPage + i).map(
                (year) => {
                  const active = year === cursor.getFullYear();
                  const outOfRange =
                    (minDate && year < minDate.getFullYear()) ||
                    (maxDate && year > maxDate.getFullYear());
                  return (
                    <Pressable
                      key={year}
                      onPress={() => {
                        if (outOfRange) return;
                        setCursor(new Date(year, cursor.getMonth(), 1));
                        setView("months");
                      }}
                      disabled={Boolean(outOfRange)}
                      accessibilityRole="button"
                      accessibilityLabel={String(year)}
                      accessibilityState={{ selected: active }}
                      className="h-10 w-1/4 items-center justify-center"
                    >
                      <View
                        style={{
                          backgroundColor: active ? brand[600] : "transparent",
                        }}
                        className="h-8 w-full items-center justify-center rounded-full"
                      >
                        <Text
                          style={{
                            color: active
                              ? "#FFFFFF"
                              : outOfRange
                                ? c.textFaint
                                : c.text,
                          }}
                          className="font-ui text-[12.5px]"
                        >
                          {year}
                        </Text>
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>
          ) : view === "months" ? (
            <View className="flex-row flex-wrap">
              {MONTHS_LONG.map((name, i) => {
                const active = i === cursor.getMonth();
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      setCursor(new Date(cursor.getFullYear(), i, 1));
                      setView("days");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${name} ${cursor.getFullYear()}`}
                    accessibilityState={{ selected: active }}
                    className="h-11 w-1/3 items-center justify-center"
                  >
                    <View
                      style={{
                        backgroundColor: active ? brand[600] : "transparent",
                      }}
                      className="h-9 w-[92%] items-center justify-center rounded-full"
                    >
                      <Text
                        style={{ color: active ? "#FFFFFF" : c.text }}
                        className="font-ui text-[12.5px]"
                      >
                        {name.slice(0, 3)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
          <View className="flex-row">
            {WEEKDAYS.map((d, i) => (
              <Text
                key={`${d}-${i}`}
                style={{ color: c.textFaint }}
                className="flex-1 text-center font-ui-semibold text-[10px]"
              >
                {d}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap pt-1">
            {cells.map((day, i) => {
              if (day === null) {
                return <View key={`blank-${i}`} className="h-9 w-[14.28%]" />;
              }
              const cellYmd = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), day));
              const isSelected = cellYmd === value;
              const cellDate = parseYmd(cellYmd)!;
              const disabled = Boolean(
                (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate),
              );

              return (
                <Pressable
                  key={cellYmd}
                  onPress={() => !disabled && pick(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={fmtDate(cellYmd)}
                  accessibilityState={{ selected: isSelected, disabled }}
                  className="h-9 w-[14.28%] items-center justify-center"
                >
                  <View
                    style={{
                      backgroundColor: isSelected ? brand[600] : 'transparent',
                    }}
                    className="h-8 w-8 items-center justify-center rounded-full"
                  >
                    <Text
                      style={{
                        color: isSelected
                          ? '#FFFFFF'
                          : disabled
                            ? c.textFaint
                            : c.text,
                      }}
                      className="font-ui text-[12.5px]"
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
