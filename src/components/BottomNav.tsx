import {
  CalendarCheck,
  House,
  MessageCircle,
  Plus,
  TreePalm,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PunchSheet } from "./PunchSheet";
import { useGetThreadsQuery } from "../store/chatApi";
import { neutral, radius, shadow } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

export type NavKey = "home" | "attendance" | "chat" | "profile";

interface Tab {
  key: NavKey;
  label: string;
  icon: LucideIcon;
}

/**
 * Two either side of the centre button.
 *
 * Icons are chosen for what they MEAN, not for the module's name: a calendar
 * with a tick is days you showed up, a palm tree is days you did not. Two plain
 * calendars side by side would have been the same silhouette twice.
 */
const LEFT: Tab[] = [
  { key: "home", label: "Home", icon: House },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
];

const RIGHT: Tab[] = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "profile", label: "Profile", icon: UserRound },
];

/** Bar height, excluding the home-indicator inset. */
export const BOTTOM_NAV_HEIGHT = 66;

/** Diameter of the centre punch button. */
const FAB_SIZE = 58;

/**
 * How far the button breaks the bar's top edge.
 *
 * Small on purpose. A FAB hoisted half its height above the bar floats away
 * from it and starts looking like a dropped sticker; sitting mostly INSIDE the
 * bar, just cresting the edge, is what reads as part of the same object.
 */
const FAB_LIFT = 9;

/** Total space a screen must leave clear at the bottom. */
export const BOTTOM_NAV_CLEARANCE = BOTTOM_NAV_HEIGHT + 12;

function Item({
  tab,
  active,
  badge,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  /** Text for the corner badge — `null` when there is nothing waiting. */
  badge?: string | null;
  onPress: () => void;
}) {
  const Icon = tab.icon;
  const { brand, primary, dark, c } = useTheme();

  // A little bounce on the way in — a tab change should be felt, and a
  // critically damped spring here reads as a fade rather than a switch.
  const grow = useSharedValue(active ? 1 : 0);
  grow.value = withSpring(active ? 1 : 0, {
    damping: 12,
    stiffness: 260,
    mass: 0.6,
  });

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -grow.value * 3 },
      { scale: 1 + grow.value * 0.1 },
    ],
  }));

  // The tinted disc grows in behind the glyph. It is what carries the change
  // visually — colour alone, at 22px, is easy to miss on a four-tab bar.
  const discStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ scale: 0.6 + grow.value * 0.4 }],
  }));

  const color = active ? brand[600] : dark ? c.textMuted : neutral[400];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      className="flex-1 items-center justify-center gap-1"
    >
      <View className="h-8 w-12 items-center justify-center">
        <Animated.View
          style={[
            {
              position: "absolute",
              inset: 0,
              backgroundColor: primary.bg,
              borderRadius: radius.pill,
            },
            discStyle,
          ]}
        />

        <Animated.View style={iconStyle}>
          {/* Filled with the PALE tint, stroked with the accent — Lucide has no
              filled variants, and filling with the stroke colour would flatten
              the tick out of the calendar and the door out of the house. */}
          <Icon
            size={22}
            strokeWidth={active ? 2.2 : 1.8}
            color={color}
            fill={active ? primary.bg : "none"}
          />
        </Animated.View>

        {/* Ringed in the BAR's colour, not white — on a dark bar a white ring
            reads as a halo around the badge. */}
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: 2,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: radius.pill,
              backgroundColor: brand[600],
              borderWidth: 2,
              borderColor: c.card,
            }}
            className="items-center justify-center"
          >
            <Text
              className={`text-white ${T.count}`}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={{ color }}
        className={active ? T.navActive : T.navInactive}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

/**
 * Floating bottom bar with a centre punch button.
 *
 * The punch actions used to live on the attendance card, which meant they only
 * existed on the home screen — an employee on the Leave tab had to navigate
 * back just to clock out. As the centre button they are one tap from anywhere,
 * and the sheet behind it is owned here, so no screen has to wire it up.
 *
 * The tabs stay presentational: they report taps upward instead of pretending
 * to be a tab navigator over screens that do not all exist yet.
 */
export function BottomNav({
  active = "home",
  onSelect,
}: {
  /**
   * The highlighted tab, or `null` for a screen that has no tab of its own
   * (Leave, Team, Referrals…). Defaulting those to `home` lit the wrong tab and
   * made the bar say you were somewhere you were not.
   */
  active?: NavKey | null;
  onSelect: (key: NavKey | "apply") => void;
}) {
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const [punchOpen, setPunchOpen] = useState(false);

  /* ── Chat badge ─────────────────────────────────────────────────────────
     Off the same cached `Threads` query every chat screen reads, so the bar
     costs no extra request and `useRealtime` keeps it live: the badge drops
     the moment the conversation is opened on ANY device.

     A server that returns threads without per-thread counts still has to say
     something is waiting, hence "New" — a badge that silently disappears
     because the number was 0 is worse than an unnumbered one. */
  const { data: threads } = useGetThreadsQuery();
  const chatBadge = (() => {
    const list = threads ?? [];
    const total = list.reduce((n, t) => n + (t.unread || 0), 0);
    if (total > 0) return total > 99 ? "99+" : String(total);
    // No number to show is not the same as nothing to say — a server that
    // omits per-thread counts still has to surface that chat is live, so the
    // tab carries the word instead of a silent, empty corner.
    return "New";
  })();

  const press = useSharedValue(0);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.08 }],
  }));
  const to = (v: number) => withSpring(v, { damping: 18, stiffness: 320 });

  return (
    <>
      <View
        className="absolute inset-x-0 bottom-0"
        style={{
          paddingBottom: insets.bottom,
          backgroundColor: c.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          // No top border in light mode — the shadow already separates the bar
          // from the canvas, and a hairline under a 28px curve reads as a seam.
          borderTopWidth: dark ? 1 : 0,
          borderTopColor: c.border,
          ...shadow.floating,
        }}
      >
        <View
          style={{ height: BOTTOM_NAV_HEIGHT }}
          className="flex-row items-center"
        >
          {LEFT.map((t) => (
            <Item
              key={t.key}
              tab={t}
              active={t.key === active}
              onPress={() => onSelect(t.key)}
            />
          ))}

          {/* Reserves the slot the button straddles, so the four tabs stay
              evenly spaced instead of crowding under it. */}
          <View style={{ width: FAB_SIZE + 14 }} />

          {RIGHT.map((t) => (
            <Item
              key={t.key}
              tab={t}
              active={t.key === active}
              badge={t.key === "chat" ? chatBadge : null}
              onPress={() => onSelect(t.key)}
            />
          ))}
        </View>

        {/* ── Punch button ─────────────────────────────────────────────── */}
        <Animated.View
          style={[
            { position: "absolute", alignSelf: "center", top: -FAB_LIFT },
            fabStyle,
          ]}
        >
          <Pressable
            onPress={() => setPunchOpen(true)}
            onPressIn={() => {
              press.value = to(1);
            }}
            onPressOut={() => {
              press.value = to(0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Attendance actions"
            style={{
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_SIZE / 2,
              backgroundColor: brand[600],
              // Ring in the BAR's colour, so the circle reads as punched
              // through the bar rather than stuck on top of it.
              borderWidth: 5,
              borderColor: c.card,
              ...shadow.card,
            }}
            className="items-center justify-center"
          >
            <Plus size={26} strokeWidth={2.6} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      <PunchSheet visible={punchOpen} onClose={() => setPunchOpen(false)} />
    </>
  );
}
