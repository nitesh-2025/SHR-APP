import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountCard } from "../components/AccountCard";
import { AppDrawer } from "../components/AppDrawer";
import { AttendanceCard } from "../components/AttendanceCard";
import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { LeaveBalanceCard } from "../components/LeaveBalanceCard";
import { NotificationButton } from "../components/NotificationButton";
import { NotificationSheet } from "../components/NotificationSheet";
import { QuickActions } from "../components/QuickActions";
import { SectionHeader } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import { useGetMyTodayQuery } from "../store/attendanceApi";
import { useGetMyBalanceQuery } from "../store/leaveApi";
import { space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { MONTHS, WEEKDAYS_LONG } from "../utils/date";

/** Greeting + the line under it. Time-of-day, not a random quote generator. */
function greeting(): { hello: string; sub: string } {
  const h = new Date().getHours();
  if (h < 12) return { hello: "Good Morning", sub: "Have a productive day ahead." };
  if (h < 17) return { hello: "Good Afternoon", sub: "Hope the day is going well." };
  return { hello: "Good Evening", sub: "Wrapping up for the day?" };
}

/**
 * Home. Ordered by what an employee opens the app to do: see where they stand,
 * punch in, jump to a module, check what leave is left.
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useAppSelector(selectCurrentUser);
  const { c, brand } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Only what this screen renders. The org-wide HR dashboard is deliberately
  // NOT fetched here — it is admin reporting, not a daily action.
  const today = useGetMyTodayQuery();
  const balance = useGetMyBalanceQuery();

  // Pull-to-refresh refreshes everything on screen, not just one card.
  const refreshing =
    (today.isFetching && !today.isLoading) || (balance.isFetching && !balance.isLoading);

  const refreshAll = () => {
    today.refetch();
    balance.refetch();
  };

  // One place that maps a key to a destination, so the drawer, the bottom bar
  // and the shortcut grid can never disagree about where a key goes.
  const open = (key: string) => {
    if (key === "attendance") navigation.navigate("Attendance");
    else if (key === "leaves") navigation.navigate("Leave");
    else if (key === "apply") navigation.navigate("LeaveApply");
    else if (key === "more") setMenuOpen(true);
  };

  const now = new Date();
  const dateLine = `${WEEKDAYS_LONG[now.getDay()]}, ${now.getDate()} ${
    MONTHS[now.getMonth()]
  } ${now.getFullYear()}`;
  const { hello, sub } = greeting();

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={brand[600]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <View
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.screen,
            paddingBottom: space.xl,
          }}
          className="flex-row items-start justify-between"
        >
          <View className="flex-1 pr-3">
            <Text style={{ color: c.text }} className="font-display text-[28px] leading-9">
              {hello} 👋
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className="mt-1 font-ui-regular text-[14px]"
              numberOfLines={1}
            >
              {sub}
            </Text>
            <Text style={{ color: c.textFaint }} className="mt-1 font-ui text-[12px]">
              {dateLine}
            </Text>
          </View>

          {/* Bell, not a hamburger: the drawer is one tap away on the profile
              card and the "More" tab, but an unread badge has nowhere else to
              live. */}
          <NotificationButton onPress={() => setNotificationsOpen(true)} />
        </View>

        {/* ── Who's signed in ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: space.screen }}>
          <AccountCard
            user={user}
            onDuty={today.data?.state === "clocked_in"}
            onPress={() => setMenuOpen(true)}
          />
        </View>

        {/* ── Today's attendance (the punch lives here) ─────────────────── */}
        <View style={{ marginTop: space.lg }}>
          <AttendanceCard onViewAll={() => navigation.navigate("Attendance")} />
        </View>

        {/* ── Shortcuts ────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader title="Quick Actions" onPress={() => setMenuOpen(true)} />
          <QuickActions onOpen={open} onMore={() => setMenuOpen(true)} />
        </View>

        {/* ── Leave balance ────────────────────────────────────────────── */}
        <View style={{ marginTop: space.lg }}>
          <SectionHeader
            title="Leave Balance"
            onPress={() => navigation.navigate("Leave")}
          />
          <LeaveBalanceCard />
        </View>
      </ScrollView>

      <BottomNav active="home" onSelect={open} />

      <NotificationSheet
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={open}
      />
    </View>
  );
}
