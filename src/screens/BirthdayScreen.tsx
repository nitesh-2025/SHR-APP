import { useNavigation, type NavigationProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Cake,
  ChevronLeft,
  Gift,
  PartyPopper,
  Send,
  UsersRound,
} from "lucide-react-native";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, fullNameOf, personUser } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { Badge, Button, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import {
  useGetUpcomingBirthdaysQuery,
  type UpcomingBirthday,
} from "../store/employeesApi";
import { radius, shadow, space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDayShort } from "../utils/date";

/** How far ahead to look. A month is far enough to plan, near enough to care. */
const WINDOW_DAYS = 30;

/** Ready-made wishes. Picked, not typed — nobody composes prose on a phone. */
const MESSAGES = [
  (first: string) =>
    `Happy birthday, ${first}! 🎉 Wishing you a fantastic year ahead.`,
  (first: string) =>
    `Many happy returns of the day, ${first}! 🎂 Hope your day is as brilliant as you are.`,
  (first: string) =>
    `Happy birthday ${first}! 🥳 Thanks for everything you do for the team — have a great one.`,
];

const firstNameOf = (name?: string) =>
  (name ?? "").trim().split(/\s+/)[0] || "there";

/** `0 → Today`, `1 → Tomorrow`, `n → in n days`. */
function whenLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

/* ── Celebrating glyph ────────────────────────────────────────────────────── */

/**
 * A slow float on the hero glyph.
 *
 * Four seconds a cycle and six pixels of travel — enough to read as alive on a
 * screen that is otherwise still, quiet enough that it never competes with the
 * name it sits next to.
 */
function FloatingGift() {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [lift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * 6 },
      { rotate: `${-4 + lift.value * 8}deg` },
    ],
  }));

  return (
    <Animated.View style={style}>
      <PartyPopper size={30} strokeWidth={2} color="#FFFFFF" />
    </Animated.View>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

/**
 * The signed-in user's own birthday, when today is it.
 *
 * Deliberately the loudest thing the app ever renders — a full-bleed accent
 * card, once a year. Everything else on this screen is about wishing OTHER
 * people, and it would be a strange app that listed you among them without
 * saying anything to you first.
 */
function MyBirthdayHero({ name }: { name: string }) {
  const { brand } = useTheme();

  return (
    <LinearGradient
      colors={[brand[800], brand[900]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: space.screen,
        borderRadius: 4,
        padding: space.xl,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          className="h-14 w-14 items-center justify-center rounded-full"
        >
          <FloatingGift />
        </View>

        <View className="flex-1">
          <Text
            style={{ color: "rgba(255,255,255,0.82)" }}
            className={T.label}
            allowFontScaling={false}
          >
            HAPPY BIRTHDAY
          </Text>
          <Text className={`mt-0.5 text-white ${T.kpi}`} numberOfLines={1}>
            {name} 🎉
          </Text>
        </View>
      </View>

      <Text
        style={{ color: "rgba(255,255,255,0.88)" }}
        className={`mt-3 leading-5 ${T.secondary}`}
      >
        Everyone at SHR wishes you a brilliant year ahead. Have a wonderful day
        — the clock can wait a few minutes today.
      </Text>
    </LinearGradient>
  );
}

/* ── Today's card ─────────────────────────────────────────────────────────── */

function TodayCard({
  person,
  onWish,
}: {
  person: UpcomingBirthday;
  onWish: () => void;
}) {
  const { c, dark, brand } = useTheme();

  const cake = toneFor(surface.warning, dark);

  // Floating animation
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);
  const float3 = useSharedValue(0);

  useEffect(() => {
    const animate = (
      value: { value: number },
      duration: number,
      distance: number,
    ) => {
      value.value = withRepeat(
        withTiming(-distance, {
          duration,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    };

    animate(float1, 1500, 7);
    animate(float2, 1800, 10);
    animate(float3, 1300, 6);
  }, [float1, float2, float3]);

  return (
    <View
      style={{
        position: "relative",
        overflow: "visible",
        backgroundColor: cake.bg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: cake.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      {/* ================= BALLOONS ================= */}

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: 10,
          bottom: -22,
          width: 105,
          height: 105,
          overflow: "visible",
        }}
      >
        {/* Back balloon */}
        <Animated.View
          style={{
            position: "absolute",
            right: 4,
            bottom: 30,
            transform: [{ translateY: float2 }, { rotate: "12deg" }],
          }}
        >
          <View
            style={{
              width: 30,
              height: 39,
              borderRadius: 20,
              backgroundColor: "#8B5CF6",
              borderWidth: 1.5,
              borderColor: "#7C3AED",
            }}
          />

          {/* knot */}
          <View
            style={{
              alignSelf: "center",
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 6,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#7C3AED",
            }}
          />

          {/* string */}
          <View
            style={{
              width: 1,
              height: 35,
              backgroundColor: "#A78BFA",
              alignSelf: "center",
              transform: [{ rotate: "-8deg" }],
            }}
          />
        </Animated.View>

        {/* Main pink balloon */}
        <Animated.View
          style={{
            position: "absolute",
            right: 32,
            bottom: 34,
            transform: [{ translateY: float1 }, { rotate: "-7deg" }],
          }}
        >
          <View
            style={{
              width: 39,
              height: 50,
              borderRadius: 25,
              backgroundColor: "#F43F5E",
              borderWidth: 1.5,
              borderColor: "#E11D48",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Highlight */}
            <View
              style={{
                position: "absolute",
                top: 9,
                left: 9,
                width: 7,
                height: 13,
                borderRadius: 5,
                backgroundColor: "rgba(255,255,255,0.35)",
                transform: [{ rotate: "-20deg" }],
              }}
            />
          </View>

          {/* knot */}
          <View
            style={{
              alignSelf: "center",
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderTopWidth: 7,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#E11D48",
            }}
          />

          {/* string */}
          <View
            style={{
              width: 1.2,
              height: 38,
              backgroundColor: "#FB7185",
              alignSelf: "center",
              transform: [{ rotate: "5deg" }],
            }}
          />
        </Animated.View>

        {/* Yellow balloon */}
        <Animated.View
          style={{
            position: "absolute",
            right: 62,
            bottom: 29,
            transform: [{ translateY: float3 }, { rotate: "-16deg" }],
          }}
        >
          <View
            style={{
              width: 27,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#F59E0B",
              borderWidth: 1.5,
              borderColor: "#D97706",
            }}
          />

          {/* knot */}
          <View
            style={{
              alignSelf: "center",
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 6,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#D97706",
            }}
          />

          {/* string */}
          <View
            style={{
              width: 1,
              height: 30,
              backgroundColor: "#FBBF24",
              alignSelf: "center",
              transform: [{ rotate: "-10deg" }],
            }}
          />
        </Animated.View>
      </View>

      {/* ================= CONTENT ================= */}

      <View className="flex-row items-center">
        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.cardTitle}
            numberOfLines={1}
          >
            {person.name || person.employee_id}
          </Text>

          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {person.designation || "—"}
            {person.department_name ? ` · ${person.department_name}` : ""}
          </Text>
        </View>
      </View>

      {/* ================= ACTION ================= */}

      <Pressable
        onPress={onWish}
        accessibilityRole="button"
        accessibilityLabel={`Send birthday wishes to ${person.name ?? "them"}`}
        style={({ pressed }) => ({
          marginTop: space.md,
          backgroundColor: brand[600],
          borderRadius: radius.pill,
          opacity: pressed ? 0.85 : 1,
        })}
        className="h-10 flex-row items-center justify-center gap-2"
      >
        <Send size={15} strokeWidth={2.4} color="#FFFFFF" />

        <Text className="font-ui-semibold text-[13.5px] text-white">
          Send wishes
        </Text>
      </Pressable>
    </View>
  );
}

/* ── Upcoming row ─────────────────────────────────────────────────────────── */

function UpcomingRow({ person }: { person: UpcomingBirthday }) {
  const { c, dark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 4,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
      className="flex-row items-center gap-3"
    >
      <Avatar user={personUser(person)} size={42} />

      <View className="flex-1">
        <Text
          style={{ color: c.text }}
          className={T.cardTitleSm}
          numberOfLines={1}
        >
          {person.name || person.employee_id}
        </Text>
        <Text
          style={{ color: c.textMuted }}
          className={`mt-0.5 ${T.micro}`}
          numberOfLines={1}
        >
          {person.designation || "—"}
          {person.department_name ? ` · ${person.department_name}` : ""}
        </Text>
      </View>

      <View className="items-end">
        <Text
          style={{ color: c.text }}
          className={T.cardTitleSm}
          allowFontScaling={false}
        >
          {fmtDayShort(person.date_of_birth)}
        </Text>
        <Text style={{ color: c.textFaint }} className={`mt-0.5 ${T.nano}`}>
          {whenLabel(person.days_until)}
        </Text>
      </View>
    </View>
  );
}

/* ── Section ──────────────────────────────────────────────────────────────── */

function Section({ label, count }: { label: string; count: number }) {
  const { c } = useTheme();
  return (
    <View
      className="flex-row items-center gap-2"
      style={{ paddingHorizontal: space.screen, marginBottom: space.md }}
    >
      <Text style={{ color: c.textFaint }} className={`uppercase ${T.micro}`}>
        {label}
      </Text>
      <Text style={{ color: c.textFaint }} className={T.micro}>
        · {count}
      </Text>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Birthdays — today's, then the month ahead.
 *
 * The server computes `days_until` and `is_today`, so the grouping here is
 * timezone-correct without the client ever doing date maths on a birth date.
 *
 * Whether today is the signed-in user's OWN birthday is matched on
 * `employee_id`: the session user's `_id` is a USER id while this list carries
 * EMPLOYEE ids, and the employee CODE is the one key both sides agree on.
 */
export default function BirthdayScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, tint } = useTheme();
  const me = useAppSelector(selectCurrentUser);

  /** The person being wished, plus which preset is selected. */
  const [wishing, setWishing] = useState<UpcomingBirthday | null>(null);
  const [pick, setPick] = useState(0);

  const { data, isLoading, isFetching, error, refetch } =
    useGetUpcomingBirthdaysQuery({
      days: WINDOW_DAYS,
    });

  const list = useMemo(() => data ?? [], [data]);

  /** Today is mine when the employee CODE matches — see the doc comment. */
  const mine = useMemo(
    () =>
      list.find(
        (b) =>
          b.is_today && me?.employee_id && b.employee_id === me.employee_id,
      ) ?? null,
    [list, me],
  );

  const today = useMemo(
    () => list.filter((b) => b.is_today && b.employee_id !== me?.employee_id),
    [list, me],
  );
  const week = useMemo(
    () => list.filter((b) => !b.is_today && b.days_until <= 7),
    [list],
  );
  const later = useMemo(
    () => list.filter((b) => !b.is_today && b.days_until > 7),
    [list],
  );

  const share = async (person: UpcomingBirthday) => {
    const message = MESSAGES[pick](firstNameOf(person.name));
    try {
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setWishing(null);
        toast.success("Wishes sent 🎉");
      }
    } catch {
      toast.error("Share nahi ho paya.");
    }
  };

  const empty = !isLoading && !error && list.length === 0;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.lg,
        }}
        className="flex-row items-center gap-3"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} strokeWidth={2.2} color={c.text} />
        </Pressable>

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.section}
            numberOfLines={1}
          >
            Birthdays
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate("Team")}
          accessibilityRole="button"
          accessibilityLabel="Team"
          style={({ pressed }) => ({
            backgroundColor: tint.bg,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          })}
          className="h-10 w-10 items-center justify-center"
        >
          <UsersRound size={19} strokeWidth={2.2} color={brand[600]} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Your day ───────────────────────────────────────────────────── */}
        {mine ? (
          <View style={{ marginBottom: space.xxl }}>
            <MyBirthdayHero
              name={me?.first_name?.trim() || fullNameOf(me).split(" ")[0]}
            />
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
            <Skeleton height={140} radius={radius.card - 4} />
            <Skeleton height={70} radius={radius.card - 4} />
            <Skeleton height={70} radius={radius.card - 4} />
          </View>
        ) : error ? (
          <EmptyState
            icon={<Cake size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load birthdays"
            message={describeApiError(error).title}
            actionLabel="Try again"
            onAction={refetch}
          />
        ) : empty ? (
          <EmptyState
            icon={<Gift size={32} strokeWidth={1.6} color={brand[600]} />}
            title="No birthdays coming up"
            message={`Nobody has a birthday in the next ${WINDOW_DAYS} days. Check back later in the month.`}
          />
        ) : (
          <>
            {today.length > 0 ? (
              <View style={{ marginBottom: space.xxl }}>
                <Section label="Celebrating today" count={today.length} />
                <View
                  style={{ paddingHorizontal: space.screen, gap: space.md }}
                >
                  {today.map((p) => (
                    <TodayCard
                      key={p._id}
                      person={p}
                      onWish={() => {
                        setPick(0);
                        setWishing(p);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {week.length > 0 ? (
              <View style={{ marginBottom: space.xxl }}>
                <Section label="This week" count={week.length} />
                <View
                  style={{ paddingHorizontal: space.screen, gap: space.md }}
                >
                  {week.map((p) => (
                    <UpcomingRow key={p._id} person={p} />
                  ))}
                </View>
              </View>
            ) : null}

            {later.length > 0 ? (
              <View>
                {/* Just "Later" — a 30-day window spills into next month, and
                    a header that names the wrong month is worse than none. */}
                <Section label="Later" count={later.length} />
                <View
                  style={{ paddingHorizontal: space.screen, gap: space.md }}
                >
                  {later.map((p) => (
                    <UpcomingRow key={p._id} person={p} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* ── Wish sheet ───────────────────────────────────────────────────
          Three ready-made lines, then Share. The app has no way to deliver a
          message on someone's behalf, and a "Sent!" toast over an API that does
          not exist would be a lie — the system share sheet hands it to whatever
          the sender actually uses. */}
      <BottomSheet
        visible={Boolean(wishing)}
        onClose={() => setWishing(null)}
        maxHeightRatio={0.75}
      >
        <View style={{ padding: space.screen }}>
          <View className="items-center">
            <Avatar user={personUser(wishing ?? {})} size={64} />
            <Text
              style={{ color: c.text }}
              className={`mt-3 text-center ${T.cardTitle}`}
            >
              Wish {firstNameOf(wishing?.name)}
            </Text>
            {wishing?.designation ? (
              <View className="mt-2">
                <Badge label={wishing.designation} tone={surface.warning} />
              </View>
            ) : null}
          </View>

          <Text
            style={{ color: c.textFaint, marginTop: space.xl }}
            className={`uppercase ${T.micro}`}
          >
            Pick a message
          </Text>

          <View style={{ marginTop: space.md, gap: space.sm }}>
            {MESSAGES.map((build, i) => {
              const active = i === pick;
              const text = build(firstNameOf(wishing?.name));
              return (
                <Pressable
                  key={text}
                  onPress={() => setPick(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={text}
                  style={({ pressed }) => ({
                    backgroundColor: active ? tint.bg : c.fill,
                    borderRadius: radius.well,
                    borderWidth: 1,
                    borderColor: active ? brand[600] : "transparent",
                    padding: space.md,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={{ color: active ? c.text : c.textMuted }}
                    className={`leading-5 ${T.secondary}`}
                  >
                    {text}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: space.xl }}>
            <Button
              label="Share wishes"
              icon={<Send size={18} strokeWidth={2.2} color="#FFFFFF" />}
              onPress={() => (wishing ? share(wishing) : undefined)}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
