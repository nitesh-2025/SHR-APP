import {
  Boxes,
  CalendarDays,
  ClipboardList,
  LifeBuoy,
  MoreHorizontal,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { IconWell } from './ui';
import { radius, shadow, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

interface Action {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Omit to follow the selected accent. */
  tone?: Surface;
  soon?: boolean;
}

// Two rows of four. Live destinations lead so the grid doesn't open with
// greyed-out tiles.
const ACTIONS: Action[] = [
  { key: 'attendance', label: 'Attendance', icon: CalendarDays },
  { key: 'leaves', label: 'Leave', icon: ClipboardList, tone: surface.warning },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays, tone: surface.purple, soon: true },
  { key: 'meeting', label: 'Meetings', icon: Users, tone: surface.info, soon: true },
  { key: 'tickets', label: 'Tickets', icon: LifeBuoy, tone: surface.danger, soon: true },
  { key: 'asset', label: 'Assets', icon: Boxes, soon: true },
  { key: 'payslip', label: 'Payslip', icon: Receipt, tone: surface.warning, soon: true },
  { key: 'more', label: 'More', icon: MoreHorizontal, tone: surface.neutral },
];

function Tile({ action, onPress }: { action: Action; onPress: () => void }) {
  const { c, primary, dark } = useTheme();
  const Icon = action.icon;
  const soon = Boolean(action.soon);
  const tone = soon ? surface.muted : (action.tone ?? primary);

  return (
    <View style={{ width: '25%', padding: space.xs + 2 }}>
      <Pressable
        onPress={soon ? undefined : onPress}
        disabled={soon}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityState={{ disabled: soon }}
        accessibilityHint={soon ? 'Coming soon' : undefined}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : soon ? 0.55 : 1,
          backgroundColor: c.card,
          borderRadius: radius.well,
          borderWidth: dark ? 1 : 0,
          borderColor: c.border,
          paddingVertical: space.md,
          ...(dark ? shadow.none : shadow.card),
        })}
        className="items-center gap-1.5"
      >
        <IconWell tone={tone} size={38}>
          <Icon size={18} strokeWidth={2} color={tone.tint} />
        </IconWell>
        <Text
          style={{ color: soon ? c.textFaint : c.text }}
          className="font-ui text-[11px]"
          numberOfLines={1}
        >
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}

/** Four-column shortcut grid. */
export function QuickActions({
  onOpen,
  onMore,
}: {
  onOpen?: (key: string) => void;
  onMore?: () => void;
}) {
  return (
    <View
      className="flex-row flex-wrap"
      style={{ paddingHorizontal: space.screen - (space.xs + 2) }}
    >
      {ACTIONS.map((a) => (
        <Tile
          key={a.key}
          action={a}
          onPress={() => (a.key === 'more' ? onMore?.() : onOpen?.(a.key))}
        />
      ))}
    </View>
  );
}
