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
import { useEffect, useMemo, useState } from "react";
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
      colors={[brand[500], brand[700]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: space.screen,
        borderRadius: radius.card,
        padding: space.xl,
        ...shadow.card,
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

  // The amber wash is what separates a card for TODAY from the plain rows of
  // upcoming birthdays below it. Falling back to the ordinary card colour in
  // dark mode erased that difference, so the tone is re-mixed for the scheme.
  const cake = toneFor(surface.warning, dark);

  return (
    <View
      style={{
        backgroundColor: cake.bg,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: cake.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-center gap-3">
        <View>
          <Avatar user={personUser(person)} size={52} />
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              backgroundColor: cake.tint,
              // The ring cuts the badge out of whatever it overlaps, so it has
              // to follow the card fill rather than name a colour of its own.
              borderWidth: 2,
              borderColor: cake.bg,
            }}
            className="h-6 w-6 items-center justify-center rounded-full"
          >
            <Cake size={12} strokeWidth={2.6} color="#FFFFFF" />
          </View>
        </View>

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
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        ...(dark ? shadow.none : shadow.soft),
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
  const { c, brand, primary } = useTheme();
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
            backgroundColor: primary.bg,
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
                    backgroundColor: active ? primary.bg : c.fill,
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
