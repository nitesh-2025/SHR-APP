import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDrawer } from "../components/AppDrawer";
import { AttendanceCard } from "../components/AttendanceCard";
import { fullNameOf } from "../components/Avatar";
import { BirthdayBanner } from "../components/BirthdayBanner";
import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { LeaveBalanceCard } from "../components/LeaveBalanceCard";
import { NotificationButton } from "../components/NotificationButton";
import { NotificationSheet } from "../components/NotificationSheet";
import { ProfileButton } from "../components/ProfileButton";
import { QuickActions } from "../components/QuickActions";
import { WeekSummary } from "../components/WeekSummary";
import { SectionHeader } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import { useGetMyTodayQuery } from "../store/attendanceApi";
import { useGetMyBalanceQuery } from "../store/leaveApi";
import { space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/**
 * Time-of-day greeting. Two lines only — the lead-in and the name.
 *
 * The third line ("Have a great day at work") was cut: it said nothing the app
 * did not already know, and it pushed the attendance card down by a full row of
 * type to do it.
 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
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
    (today.isFetching && !today.isLoading) ||
    (balance.isFetching && !balance.isLoading);

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
    else if (key === "profile") navigation.navigate("Profile");
    else if (key === "chat") navigation.navigate("Chats");
    else if (key === "refer") navigation.navigate("Referrals");
    else if (key === "team") navigation.navigate("Team");
    else if (key === "birthday") navigation.navigate("Birthdays");
    else if (key === "more") setMenuOpen(true);
  };

  const hello = greeting();
  // First name only — the full name pushes the line to two rows on a narrow
  // phone, and the greeting is meant to read as one glance.
  const firstName = user?.first_name?.trim() || fullNameOf(user).split(" ")[0];

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
        }}
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
        {/* The greeting owns the whole left side. There is no menu button here
            on purpose — the drawer already has a home in the bottom bar's
            "More" tab, and a hamburger competing with the name made the top of
            the screen read as chrome instead of as a welcome. */}
        <View
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.screen,
            paddingBottom: space.xl,
          }}
          className="flex-row items-start justify-between"
        >
          <View className="flex-1 pr-3">
            <Text style={{ color: c.textMuted }} className={T.body}>
              {hello}
            </Text>
            <Text
              style={{ color: c.text }}
              className={`mt-0.5 ${T.screenTitle}`}
              numberOfLines={1}
            >
              {firstName} 👋
            </Text>
          </View>

          {/* Nudged down so the pair sits level with the name, not the lead-in. */}
          <View
            style={{ marginTop: space.sm }}
            className="flex-row items-center gap-2.5"
          >
            <NotificationButton onPress={() => setNotificationsOpen(true)} />
            <ProfileButton
              user={user}
              onDuty={today.data?.state === "clocked_in"}
              onPress={() => navigation.navigate("Profile")}
            />
          </View>
        </View>

        {/* ── Your birthday ────────────────────────────────────────────────
            Above the punch card, and only on the one day a year it applies:
            being wished is the first thing you should see, not something to
            scroll to past your own timesheet. */}
        <BirthdayBanner
          scope="mine"
          onPress={() => navigation.navigate("Birthdays")}
        />

        {/* ── Today's attendance (the punch lives here) ─────────────────── */}
        <AttendanceCard />

        {/* ── Someone else's birthday ──────────────────────────────────────
            Below the punch card — wishing a teammate is a nudge, not the
            reason anyone opened the app. Renders nothing on a day with no
            birthdays. */}
        <BirthdayBanner
          scope="others"
          onPress={() => navigation.navigate("Birthdays")}
        />

        {/* ── Shortcuts ────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader title="Quick Actions" onPress={() => setMenuOpen(true)} />
          <QuickActions onOpen={open} onMore={() => setMenuOpen(true)} />
        </View>

        {/* ── This week ────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader
            title="This Week Summary"
            onPress={() => navigation.navigate("Attendance")}
          />
          <WeekSummary />
        </View>

        {/* ── Leave balance ────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl }}>
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
