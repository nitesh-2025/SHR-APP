import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDrawer } from "../components/AppDrawer";
import { Avatar, fullNameOf } from "../components/Avatar";
import { MenuButton } from "../components/MenuButton";
import { selectCurrentUser, useAppSelector } from "../store";
import { useGetDashboardQuery } from "../store/dashboardApi";

/** "Good Morning" / "Good Afternoon" / "Good Evening" for the header. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning,";
  if (h < 17) return "Good Afternoon,";
  return "Good Evening,";
}

/**
 * First real screen off the ported data layer. Renders the live KPI cards from
 * `GET /dashboard` so the whole chain — SecureStore session → bearer header →
 * RTK Query → cache → UI — is provably wired. The remaining modules follow this
 * same shape.
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectCurrentUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, isLoading, isFetching, error, refetch } =
    useGetDashboardQuery();

  const kpis = data?.kpis ?? [];
  const [hero, ...rest] = kpis;

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 12 }} className="px-5 pb-3">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
              className="flex-1 flex-row items-center gap-3 pr-3"
            >
              <Avatar user={user} size={46} />
              <View className="flex-1">
                <Text className="text-xs text-slate-500">{greeting()}</Text>
                <Text
                  className="text-lg font-bold tracking-tight text-slate-900"
                  numberOfLines={1}
                >
                  {fullNameOf(user)}
                </Text>
              </View>
            </Pressable>

            <MenuButton onPress={() => setMenuOpen(true)} />
          </View>
        </View>

        {isLoading ? (
          <View className="mt-24 items-center">
            <ActivityIndicator color="#2f8f2c" />
          </View>
        ) : error ? (
          <View className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <Text className="text-sm font-semibold text-rose-800">
              Failed to load dashboard
            </Text>
            <Text className="mt-1 text-xs text-rose-700">
              Check that EXPO_PUBLIC_BASE_URL points at a reachable backend.
            </Text>
            <Pressable
              onPress={refetch}
              className="mt-2 self-start"
              accessibilityRole="button"
            >
              <Text className="text-xs font-bold text-rose-900">RETRY</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Hero KPI, styled like the wallet card ──────────────────── */}
            {hero ? (
              <View className="mx-5 mt-2 overflow-hidden rounded-3xl shadow-lg">
                <LinearGradient
                  colors={["#1f6b1f", "#2f8f2c"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 20 }}
                >
                  <Text className="text-xs font-medium uppercase tracking-wide text-brand-200">
                    {hero.label}
                  </Text>
                  <Text className="mt-3 text-4xl font-bold tracking-tight text-white">
                    {hero.value}
                  </Text>
                  {hero.sub ? (
                    <Text className="mt-1.5 text-xs text-brand-200">
                      {hero.sub}
                    </Text>
                  ) : null}
                </LinearGradient>
              </View>
            ) : null}

            {/* ── Remaining KPIs ────────────────────────────────────────── */}
            <View className="mt-4 flex-row flex-wrap px-3.5">
              {rest.map((k) => (
                <View key={k.label} className="w-1/2 px-1.5 pb-3">
                  <View className="rounded-2xl border border-slate-100 bg-white p-4">
                    <Text
                      className="text-xs font-medium text-slate-500"
                      numberOfLines={1}
                    >
                      {k.label}
                    </Text>
                    <Text className="mt-1 text-2xl font-bold text-slate-900">
                      {k.value}
                    </Text>
                    {k.sub ? (
                      <Text
                        className="mt-0.5 text-[11px] text-slate-400"
                        numberOfLines={1}
                      >
                        {k.sub}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <AppDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
