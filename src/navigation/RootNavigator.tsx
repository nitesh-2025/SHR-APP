import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import AttendanceScreen from "../screens/AttendanceScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LeaveApplyScreen from "../screens/LeaveApplyScreen";
import LeaveScreen from "../screens/LeaveScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
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
import { useTheme } from "../theme/ThemeProvider";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Attendance: undefined;
  Leave: undefined;
  LeaveApply: undefined;
  Profile: undefined;
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
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
