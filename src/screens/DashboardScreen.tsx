import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDrawer } from "../components/AppDrawer";
import { AttendanceCard } from "../components/AttendanceCard";
import { fullNameOf } from "../components/Avatar";
import { BirthdayBanner } from "../components/BirthdayBanner";
import {
  BirthdayBackdrop,
  BirthdayGreeting,
} from "../components/BirthdayGreeting";
import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { LeaveBalanceCard } from "../components/LeaveBalanceCard";
import { NotificationButton } from "../components/NotificationButton";
import { NotificationSheet } from "../components/NotificationSheet";
import { ProfileButton } from "../components/ProfileButton";
import { QuickActions } from "../components/QuickActions";
import { WeekSummary } from "../components/WeekSummary";
import { SectionHeader } from "../components/ui";
import { useTodaysBirthdays } from "../hooks/useTodaysBirthdays";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useMenuNav } from "../navigation/useMenuNav";
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
  // and the shortcut rail can never disagree about where a key goes. It lives
  // in `navigation/useMenuNav` — this used to be a per-screen copy of the same
  // chain, and adding a screen meant remembering every copy.
  const open = useMenuNav({
    onMore: () => setMenuOpen(true),
    email: user?.email,
  });

  const hello = greeting();
  // First name only — the full name pushes the line to two rows on a narrow
  // phone, and the greeting is meant to read as one glance.
  const firstName = user?.first_name?.trim() || fullNameOf(user).split(" ")[0];

  /** Set only on the user's own birthday; `undefined` the rest of the year. */
  const { mine: birthday } = useTodaysBirthdays();

  // Declared once and handed to whichever greeting renders — two copies of the
  // same pair is two places to forget when one of them changes.
  const headerActions = (
    <View className="flex-row items-center gap-2.5">
      <NotificationButton onPress={() => setNotificationsOpen(true)} />
      <ProfileButton
        user={user}
        onDuty={today.data?.state === "clocked_in"}
        celebrating={Boolean(birthday)}
        onPress={() => navigation.navigate("Profile")}
      />
    </View>
  );

  return (
    // The wash runs the whole page on a birthday, not just the header — the
    // colour stopping at the greeting's bottom edge read as a banner pasted
    // onto an ordinary screen rather than as the screen itself celebrating.
    <BirthdayBackdrop active={Boolean(birthday)}>
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
        {/* ── Greeting ─────────────────────────────────────────────────────
            On a birthday the whole band changes: the time-of-day lead-in is a
            polite nothing, and it is not what someone opening the app on their
            own birthday should be told first. Every other day it renders
            exactly as before. */}
        {birthday ? (
          <BirthdayGreeting
            // The EMPLOYEE record's name wins on this one line. A login called
            // "Super" belongs to a person the HR record knows by their real
            // name, and "Happy birthday, Super" is not a wish anybody wants.
            name={birthday.name?.trim().split(" ")[0] || firstName}
            dob={birthday.date_of_birth}
            paddingTop={insets.top + space.md}
            right={headerActions}
          />
        ) : (
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

            {/* Nudged down so the pair sits level with the name, not the
                lead-in. */}
            <View style={{ marginTop: space.sm }}>{headerActions}</View>
          </View>
        )}

        {/* ── Today's attendance (the punch lives here) ─────────────────────
            Today's birthdays ride along the bottom of the same card, behind a
            hairline. On its own it was a third card wedged between the status
            block and Quick Actions, and it read as an offcut of whichever one
            it was nearer. Inside, it is one more thing today happens to
            contain — and on the 364 other days the slot renders nothing. */}
        <AttendanceCard
          footer={
            <BirthdayBanner
              scope="others"
              variant="strip"
              onPress={() => navigation.navigate("Birthdays")}
            />
          }
        />

        {/* ── Shortcuts ────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader
            title="Quick Actions"
            onPress={() => setMenuOpen(true)}
          />
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
    </BirthdayBackdrop>
  );
}
