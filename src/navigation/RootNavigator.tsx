import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import DashboardScreen from "../screens/DashboardScreen";
import LoginScreen from "../screens/LoginScreen";
import { useAutoLogout } from "../hooks/useAutoLogout";
import { useRealtime } from "../hooks/useRealtime";
import {
  selectIsAuthenticated,
  selectIsBootstrapped,
  useAppDispatch,
  useAppSelector,
} from "../store";
import { hydrateFromSession } from "../store/authSlice";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const bootstrapped = useAppSelector(selectIsBootstrapped);

  // Restore the saved session once, before deciding which stack to show.
  useEffect(() => {
    dispatch(hydrateFromSession());
  }, [dispatch]);

  // App-wide side effects. Both no-op while logged out.
  useAutoLogout();
  useRealtime();

  // Splash until storage has been read — without this the Login screen flashes
  // for a frame on every cold start of an already-signed-in user.
  if (!bootstrapped) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-700">
        <ActivityIndicator color="#bce2b7" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
