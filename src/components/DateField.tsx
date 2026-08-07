import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
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
export function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (next: string) => void;
  /** Earliest selectable day, `YYYY-MM-DD`. Days before it render inert. */
  min?: string;
}) {
  // `tint`, not `primary` — the latter is the as-authored light recipe, whose
  // 50-step fill is a near-white slab on a dark canvas.
  const { brand, c, tint } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = parseYmd(value) ?? new Date();
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const minDate = parseYmd(min);
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
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${fmtDate(value)}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          backgroundColor: c.card,
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
          style={{ color: c.text }}
          className="flex-1 font-ui text-[13.5px]"
          numberOfLines={1}
        >
          {fmtDate(value)}
        </Text>
      </Pressable>

      {open ? (
        <View
          style={{ backgroundColor: c.card, borderColor: c.border }}
          className="mt-2 rounded-2xl border p-3"
        >
          {/* Month nav */}
          <View className="flex-row items-center justify-between pb-2">
            <Pressable
              onPress={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: tint.bg }}
            >
              <ChevronLeft size={15} strokeWidth={2.2} color={brand[600]} />
            </Pressable>

            <Text style={{ color: c.text }} className="font-ui-semibold text-[13px]">
              {MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>

            <Pressable
              onPress={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: tint.bg }}
            >
              <ChevronRight size={15} strokeWidth={2.2} color={brand[600]} />
            </Pressable>
          </View>

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
              const disabled = Boolean(minDate && parseYmd(cellYmd)! < minDate);

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
        </View>
      ) : null}
    </View>
  );
}
