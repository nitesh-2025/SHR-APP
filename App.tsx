import "./global.css";

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import { BootSplash } from "./src/components/BootSplash";
import { Toaster } from "./src/components/Toaster";
import RootNavigator from "./src/navigation/RootNavigator";
import { store } from "./src/store";
import { ThemeProvider } from "./src/theme/ThemeProvider";

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemeProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            {/* Same splash on both sides of the font load, so a cold start is
                ONE continuous screen instead of blank → green → app. Without
                this the first ~300ms was the bare root view. */}
            {fontsLoaded ? (
              <>
                <RootNavigator />
                <Toaster />
              </>
            ) : (
              <BootSplash />
            )}
          </SafeAreaProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
