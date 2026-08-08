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
  const { brand, tint, dark, c } = useTheme();

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
              backgroundColor: tint.bg,
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
            fill={active ? tint.bg : "none"}
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
   * Highlighted tab.
   *
   * Use null for screens that do not belong
   * to a bottom navigation tab.
   */
  active?: NavKey | null;

  onSelect: (key: NavKey | "apply") => void;
}) {
  const insets = useSafeAreaInsets();

  const { c, brand, dark } = useTheme();

  const [punchOpen, setPunchOpen] = useState(false);

  /*
   * ─────────────────────────────────────────────
   * CHAT UNREAD BADGE
   * ─────────────────────────────────────────────
   *
   * Uses the same cached threads query used by
   * the chat screens.
   */
  const { data: threads } = useGetThreadsQuery();

  const chatBadge = (() => {
    const list = threads ?? [];

    const total = list.reduce(
      (count, thread) => count + (thread.unread || 0),
      0,
    );

    if (total <= 0) {
      return "";
    }

    return total > 99 ? "99+" : String(total);
  })();

  /*
   * ─────────────────────────────────────────────
   * FAB PRESS ANIMATION
   * ─────────────────────────────────────────────
   */

  const press = useSharedValue(0);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1 - press.value * 0.08,
      },
    ],
  }));

  const springTo = (value: number) =>
    withSpring(value, {
      damping: 18,
      stiffness: 320,
    });

  return (
    <>
      {/* ============================================================
          BOTTOM NAV
          ============================================================ */}

      <View
        className="absolute inset-x-0 bottom-0"
        style={{
          /*
           * Important:
           * Don't use transparent background here.
           * White surface is what makes the nav clearly visible
           * against a light screen.
           */
          backgroundColor: dark ? c.card : "#FFFFFF",

          paddingBottom: insets.bottom,

          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,

          /*
           * Light mode needs an actual boundary.
           */
          borderTopWidth: 1,
          borderTopColor: dark ? c.border : "#E5E7EB",

          /*
           * Small side boundary makes the floating surface
           * more obvious on white screens.
           */
          borderLeftWidth: dark ? 0 : 1,
          borderRightWidth: dark ? 0 : 1,

          /*
           * Shadow
           */
          shadowColor: dark ? "#000000" : "#64748B",

          shadowOpacity: dark ? 0.35 : 0.16,

          shadowRadius: dark ? 14 : 18,

          shadowOffset: {
            width: 0,
            height: -7,
          },

          elevation: dark ? 12 : 14,

          /*
           * Make sure nav stays above page content.
           */
          zIndex: 50,
        }}
      >
        {/* ========================================================
            NAV ITEMS
            ======================================================== */}

        <View
          style={{
            height: BOTTOM_NAV_HEIGHT,

            flexDirection: "row",

            alignItems: "center",
          }}
        >
          {/* LEFT ITEMS */}

          {LEFT.map((tab) => (
            <Item
              key={tab.key}
              tab={tab}
              active={tab.key === active}
              onPress={() => onSelect(tab.key)}
            />
          ))}

          {/* ======================================================
              FAB RESERVED SPACE

              Prevents the tabs from getting squeezed beneath
              the center button.
              ====================================================== */}

          <View
            style={{
              width: FAB_SIZE + 14,
            }}
          />

          {/* RIGHT ITEMS */}

          {RIGHT.map((tab) => (
            <Item
              key={tab.key}
              tab={tab}
              active={tab.key === active}
              badge={tab.key === "chat" ? chatBadge : null}
              onPress={() => onSelect(tab.key)}
            />
          ))}
        </View>

        {/* ========================================================
            CENTER FAB
            ======================================================== */}

        <Animated.View
          style={[
            {
              position: "absolute",

              alignSelf: "center",

              top: -FAB_LIFT,

              /*
               * Keep FAB above nav.
               */
              zIndex: 100,
              elevation: 20,
            },

            fabStyle,
          ]}
        >
          <Pressable
            onPress={() => setPunchOpen(true)}
            onPressIn={() => {
              press.value = springTo(1);
            }}
            onPressOut={() => {
              press.value = springTo(0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Attendance actions"
            style={{
              width: FAB_SIZE,
              height: FAB_SIZE,

              borderRadius: FAB_SIZE / 2,

              backgroundColor: brand[600],

              /*
               * White ring in light mode.
               * Card color in dark mode.
               */
              borderWidth: 5,

              borderColor: dark ? c.card : "#FFFFFF",

              /*
               * FAB shadow
               */
              shadowColor: dark ? "#000000" : brand[600],

              shadowOpacity: dark ? 0.35 : 0.28,

              shadowRadius: 10,

              shadowOffset: {
                width: 0,
                height: 5,
              },

              elevation: 10,

              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={25} strokeWidth={2.7} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      {/* ==========================================================
          PUNCH SHEET
          ========================================================== */}

      <PunchSheet visible={punchOpen} onClose={() => setPunchOpen(false)} />
    </>
  );
}
