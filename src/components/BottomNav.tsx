import {
  CalendarDays,
  ClipboardList,
  Home,
  LifeBuoy,
  Menu,

  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, shadow } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

export type NavKey = "home" | "attendance" | "leaves" | "tickets" | "more";

interface Tab {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  /** Screen not built yet — rendered muted and inert. */
  soon?: boolean;
}

const TABS: Tab[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "attendance", label: "Attendance", icon: CalendarDays },
  { key: "leaves", label: "Leave", icon: ClipboardList },
  { key: "tickets", label: "Tickets", icon: LifeBuoy, soon: true },
  { key: "more", label: "More", icon: Menu },
];

/** Bar height, excluding the home-indicator inset. */
export const BOTTOM_NAV_HEIGHT = 64;

/** Total space a screen must leave clear at the bottom. */
export const BOTTOM_NAV_CLEARANCE = BOTTOM_NAV_HEIGHT + 12;

function Item({
  tab,
  active,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  onPress: () => void;
}) {
  const Icon = tab.icon;
  const { brand, c, primary } = useTheme();

  // The pill grows in behind the icon on selection — a colour swap alone is
  // easy to miss on a five-tab bar.
  const grow = useSharedValue(active ? 1 : 0);
  grow.value = withSpring(active ? 1 : 0, { damping: 16, stiffness: 220, mass: 0.5 });

  const pillStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ scale: 0.7 + grow.value * 0.3 }],
  }));

  const color = tab.soon ? c.textFaint : active ? brand[600] : c.textMuted;

  return (
    <Pressable
      onPress={tab.soon ? undefined : onPress}
      disabled={tab.soon}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active, disabled: Boolean(tab.soon) }}
      accessibilityHint={tab.soon ? "Coming soon" : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : tab.soon ? 0.5 : 1 })}
      className="flex-1 items-center justify-center gap-1"
    >
      <View className="h-8 w-14 items-center justify-center">
        <Animated.View
          style={[
            {
              position: "absolute",
              inset: 0,
              backgroundColor: primary.bg,
              borderRadius: radius.pill,
            },
            pillStyle,
          ]}
        />
        <Icon size={22} strokeWidth={2} color={color} />
      </View>
      <Text
        style={{ color }}
        className={`text-[11px] ${active ? "font-ui-semibold" : "font-ui-regular"}`}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

/**
 * Floating bottom bar. Presentational on purpose — it reports taps upward
 * instead of pretending to be a tab navigator over screens that do not all
 * exist yet; swapping it for `createBottomTabNavigator` later is a drop-in
 * change at the call site.
 */
export function BottomNav({
  active = "home",
  onSelect,
}: {
  active?: NavKey;
  onSelect: (key: NavKey | "apply") => void;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <View
      className="absolute inset-x-0 bottom-0"
      style={{
        paddingBottom: insets.bottom,
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.border,
        ...shadow.floating,
      }}
    >
      <View style={{ height: BOTTOM_NAV_HEIGHT }} className="flex-row items-center">
        {TABS.map((t) => (
          <Item key={t.key} tab={t} active={t.key === active} onPress={() => onSelect(t.key)} />
        ))}
      </View>
    </View>
  );
}
