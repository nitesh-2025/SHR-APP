import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import AttendanceScreen from "../screens/AttendanceScreen";
import BirthdayScreen from "../screens/BirthdayScreen";
import ChatScreen from "../screens/ChatScreen";
import ChatsScreen from "../screens/ChatsScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LeaveApplyScreen from "../screens/LeaveApplyScreen";
import LeaveScreen from "../screens/LeaveScreen";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ProfileEditScreen from "../screens/ProfileEditScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReferralScreen from "../screens/ReferralScreen";
import TeamScreen from "../screens/TeamScreen";
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
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
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
