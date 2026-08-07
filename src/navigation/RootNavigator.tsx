import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import AssetsScreen from "../screens/AssetsScreen";
import AttendanceScreen from "../screens/AttendanceScreen";
import BirthdayScreen from "../screens/BirthdayScreen";
import ChatScreen from "../screens/ChatScreen";
import ChatsScreen from "../screens/ChatsScreen";
import DashboardScreen from "../screens/DashboardScreen";
import DocumentsScreen from "../screens/DocumentsScreen";
import LeaveApplyScreen from "../screens/LeaveApplyScreen";
import LeaveScreen from "../screens/LeaveScreen";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import PayslipScreen from "../screens/PayslipScreen";
import PerformanceScreen from "../screens/PerformanceScreen";
import PolicyScreen, { type PolicyKind } from "../screens/PolicyScreen";
import ProfileEditScreen from "../screens/ProfileEditScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReferralScreen from "../screens/ReferralScreen";
import TeamScreen from "../screens/TeamScreen";
import TicketDetailScreen from "../screens/TicketDetailScreen";
import TicketsScreen from "../screens/TicketsScreen";
import WorkCalendarScreen from "../screens/WorkCalendarScreen";
import { useAutoLogout } from "../hooks/useAutoLogout";
import { useCurrentUserSync } from "../hooks/useCurrentUserSync";
import { useRealtime } from "../hooks/useRealtime";
import {
  selectIsAuthenticated,
  selectIsBootstrapped,
  useAppDispatch,
  useAppSelector,
} from "../store";
import { hydrateFromSession } from "../store/authSlice";
import type { ProfileSection } from "../screens/ProfileEditScreen";
import { useTheme } from "../theme/ThemeProvider";

export type RootStackParamList = {
  Login: undefined;
  /** Email is carried over from the login form so nobody retypes it. */
  ForgotPassword: { email?: string } | undefined;
  Dashboard: undefined;
  Attendance: undefined;
  Leave: undefined;
  LeaveApply: undefined;
  Profile: undefined;
  /** Everyone in the signed-in employee's own department. */
  Team: undefined;
  Birthdays: undefined;
  Chats: undefined;
  Referrals: undefined;
  /** Issues the signed-in employee has raised. */
  Tickets: undefined;
  /**
   * One ticket and its reply thread. `title` is passed through only so the
   * header can paint before the detail response lands.
   */
  Ticket: { id: string; title?: string };
  /** The company year: declared holidays plus the working-week policy. */
  Holidays: undefined;
  /** Company property currently in this employee's custody. */
  Assets: undefined;
  /** Package on record plus every deduction raised against it. */
  Payslip: undefined;
  /** Every review cycle this employee has been through. */
  Performance: undefined;
  /** What HR holds on file for this employee. */
  Documents: undefined;
  /** Two documents, one layout — `hr` is the handbook, `privacy` the app's. */
  Policy: { kind: PolicyKind };
  /** Which block of my own record is being edited. */
  ProfileEdit: { section: ProfileSection };
  /**
   * One conversation. `userId` is the partner's USER id (what the messages API
   * keys on); the rest is passed through only so the header can paint before
   * the first response lands.
   */
  Chat: {
    userId: string;
    name?: string;
    photo?: string | null;
    designation?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const { brand } = useTheme();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const bootstrapped = useAppSelector(selectIsBootstrapped);

  // Restore the saved session once, before deciding which stack to show.
  useEffect(() => {
    dispatch(hydrateFromSession());
  }, [dispatch]);

  // App-wide side effects. All three no-op while logged out.
  useAutoLogout();
  useRealtime();
  useCurrentUserSync();

  // Splash until storage has been read — without this the Login screen flashes
  // for a frame on every cold start of an already-signed-in user.
  if (!bootstrapped) {
    return (
      <View
        style={{ backgroundColor: brand[700] }}
        className="flex-1 items-center justify-center"
      >
        <ActivityIndicator color={brand[200]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="Leave" component={LeaveScreen} />
            <Stack.Screen name="LeaveApply" component={LeaveApplyScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Team" component={TeamScreen} />
            <Stack.Screen name="Birthdays" component={BirthdayScreen} />
            <Stack.Screen name="Chats" component={ChatsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Referrals" component={ReferralScreen} />
            <Stack.Screen name="Tickets" component={TicketsScreen} />
            <Stack.Screen name="Ticket" component={TicketDetailScreen} />
            <Stack.Screen name="Holidays" component={WorkCalendarScreen} />
            <Stack.Screen name="Assets" component={AssetsScreen} />
            <Stack.Screen name="Payslip" component={PayslipScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Performance" component={PerformanceScreen} />
            <Stack.Screen name="Policy" component={PolicyScreen} />
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            {/*
              Also in the signed-IN stack, not only the signed-out one: "Change
              password" from Profile is the same OTP flow as "Forgot password"
              from Login, and the backend has no separate change endpoint. The
              two groups are mutually exclusive at runtime, so the duplicate
              name never collides.
            */}
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
