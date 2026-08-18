import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  BadgeCheck,
  Cake,
  ChevronLeft,
  Clock3,
  Crown,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  UserCheck,
  UserRoundX,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, personUser } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { MaskedValue } from "../components/MaskedValue";
import { Badge, EmptyState, IconWell, Skeleton } from "../components/ui";
import { usePresence } from "../hooks/usePresence";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import {
  useGetRosterQuery,
  type RosterEntry,
} from "../store/attendanceApi";
import {
  useGetEmployeesQuery,
  useGetMyProfileQuery,
  useGetUpcomingBirthdaysQuery,
  type DepartmentRef,
  type Employee,
  type ManagerRef,
} from "../store/employeesApi";
import {
  radius,
  shadow,
  space,
  surface,
  toneFor,
  type Surface,
} from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDate, fmtTime, ymd } from "../utils/date";

/**
 * A department is rarely more than this, and the endpoint pages server-side —
 * asking for one big page is one round trip instead of five, and the screen
 * says so out loud if a department ever outgrows it.
 */
const PAGE = 200;

/* ── Ref helpers ──────────────────────────────────────────────────────────── */

/** `"64ab…"` or `{ _id: "64ab…", … }` → the object form, or undefined. */
function refOf<T extends { _id: string }>(
  value?: T | string,
): Partial<T> | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? ({ _id: value } as Partial<T>) : value;
}

/** Digits only. A stored number may carry spaces, dashes or a `+`. */
function digitsOf(phone?: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** WhatsApp wants a country code; a bare 10-digit Indian number has none. */
function waNumber(phone?: string): string | null {
  const d = digitsOf(phone);
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 ? d : null;
}

async function open(url: string, failure: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast.error(failure);
  }
}

/* ── Today, per person ────────────────────────────────────────────────────── */

/**
 * What the roster knows about one person TODAY.
 *
 * Deliberately not called "absent". The roster is punch-derived: it knows
 * whether somebody clocked in, and nothing about approved leave — so labelling
 * a colleague on sanctioned leave as "Absent" in front of the whole department
 * would be the app inventing an accusation out of a missing row. "No punch yet"
 * is the entire truth of what is known, and it stops being a judgement.
 */
type Today = { label: string; tone: Surface; icon: LucideIcon; at?: string };

function todayOf(entry?: RosterEntry): Today | null {
  if (!entry) return null;
  const at = fmtTime(entry.attendance?.clock_in?.at) ?? undefined;

  if (!entry.came) {
    return { label: "No punch yet", tone: surface.neutral, icon: Clock3 };
  }
  if (entry.attendance?.is_late) {
    return { label: at ? `Late · ${at}` : "Late", tone: surface.warning, icon: Clock3, at };
  }
  return { label: at ? `In · ${at}` : "Present", tone: surface.success, icon: LogIn, at };
}

/* ── Person row ───────────────────────────────────────────────────────────── */

function PersonRow({
  person,
  isMe,
  birthday,
  online,
  today,
  onPress,
}: {
  person: Employee;
  isMe: boolean;
  /** Their birthday is TODAY — the one fact worth interrupting a list for. */
  birthday: boolean;
  /** Live, off the presence socket. */
  online: boolean;
  /**
   * Today's punch, when the roster is readable. Null covers two different
   * cases on purpose — the roster has not loaded, and the caller is not allowed
   * to read it — because the row's answer to both is the same: say nothing
   * rather than guess.
   */
  today: Today | null;
  onPress: () => void;
}) {
  const { c, dark } = useTheme();
  const tone = today ? toneFor(today.tone, dark) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        person.name ?? "Teammate",
        person.designation,
        person.employee_id,
        today?.label ?? null,
        online ? "online" : null,
        birthday ? "birthday today" : null,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Opens contact details"
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        opacity: pressed ? 0.85 : 1,
        ...(dark ? shadow.none : shadow.soft),
      })}
      className="flex-row items-center gap-3"
    >
      <View>
        <Avatar user={personUser(person)} size={46} />
        {/* The cake rides the avatar rather than sitting in the row: it belongs
            to the PERSON, and at the far right it read as a row action. */}
        {birthday ? (
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              backgroundColor: surface.warning.tint,
              borderWidth: 2,
              borderColor: c.card,
            }}
            className="h-5 w-5 items-center justify-center rounded-full"
          >
            <Cake size={10} strokeWidth={2.6} color="#FFFFFF" />
          </View>
        ) : online ? (
          /* Cake wins the corner on the one day it applies — two dots stacked
             on one avatar is a puzzle, not a signal. */
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              backgroundColor: surface.success.tint,
              borderWidth: 2,
              borderColor: c.card,
            }}
            className="h-3.5 w-3.5 rounded-full"
          />
        ) : null}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            style={{ color: c.text }}
            className={T.cardTitleSm}
            numberOfLines={1}
          >
            {person.name || person.employee_id}
          </Text>
          {isMe ? (
            <Text style={{ color: c.textFaint }} className={T.micro}>
              (you)
            </Text>
          ) : null}
        </View>

        {/* Designation on its own line at reading size. It used to share an
            11px line with the employee id, which made the two facts compete
            and truncated both on a long title. */}
        <Text
          style={{ color: c.textMuted }}
          className={`mt-0.5 ${T.caption}`}
          numberOfLines={1}
        >
          {person.designation || "Designation not set"}
        </Text>
      </View>

      {/* ── Right column ───────────────────────────────────────────────────
          Today's punch on top, the employee id under it. The id used to sit
          alone up here, which made a directory of who EXISTS — the question
          people actually open this screen with in the morning is who is IN,
          and that answer has to be the one the eye lands on first. */}
      <View className="items-end gap-1">
        {today && tone ? (
          <View
            style={{
              backgroundColor: tone.bg,
              borderColor: tone.border,
              borderWidth: 1,
              borderRadius: radius.pill,
            }}
            className="flex-row items-center gap-1 px-2 py-1"
          >
            <today.icon size={11} strokeWidth={2.6} color={tone.tint} />
            <Text
              style={{ color: tone.text }}
              className={T.count}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {today.label}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-1.5">
          {/* Presence of a number, not a second way to dial: the sheet owns
              every action, so one tap target does one thing. */}
          {person.phone ? (
            <Phone size={12} strokeWidth={2} color={c.textFaint} />
          ) : null}
          {person.employee_id ? (
            <Text
              style={{ color: c.textFaint }}
              className={T.count}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {person.employee_id}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* ── Contact action ───────────────────────────────────────────────────────── */

function ContactRow({
  icon: Icon,
  label,
  value,
  tone,
  sensitive,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Surface;
  /**
   * A personal number or address — shown as `XXXXXX9518` with reveal and copy
   * rather than printed in full.
   *
   * The row still dials on tap, so nothing is taken away: what changes is that
   * a colleague's personal mobile is no longer sitting in the open the whole
   * time the sheet is up, which is when it ends up in a screenshot of "who do I
   * call about this". The reveal and the copy are both inside the row, and both
   * beat the row's own press because the inner Pressable wins the responder.
   */
  sensitive?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      style={({ pressed }) => ({
        backgroundColor: c.fill,
        borderRadius: radius.well,
        opacity: pressed ? 0.7 : 1,
      })}
      className="flex-row items-center gap-3 px-3.5 py-3"
    >
      <IconWell tone={tone} size={38} round>
        <Icon size={17} strokeWidth={2.2} color={tone.tint} />
      </IconWell>
      <View className="flex-1">
        <Text style={{ color: c.textMuted }} className={T.nano}>
          {label}
        </Text>
        {sensitive ? (
          <View className="mt-0.5">
            <MaskedValue
              value={value}
              label={label}
              style={{ color: c.text }}
              className={T.cardTitleSm}
            />
          </View>
        ) : (
          <Text
            style={{ color: c.text }}
            className={`mt-0.5 ${T.cardTitleSm}`}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Team — everyone in the signed-in employee's own department.
 *
 * The department comes from `GET /employees/me/profile`, with the session user
 * as an instant fallback so the list can start loading on the first frame
 * instead of after a round trip. Search runs on the client: a department is
 * tens of people, already in memory, and a server round trip per keystroke
 * would make typing feel slower than reading.
 */
export default function TeamScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, primary, tint, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);
  // Presence + the employee-code → chat-user-id map. This screen is the one
  // place that needs the whole directory (every teammate row is keyed by
  // employee code), so it explicitly opts into that fetch.
  const { empToUser, isEmpOnline } = usePresence({ directory: true });

  const [query, setQuery] = useState("");
  /** The teammate whose contact sheet is open. */
  const [selected, setSelected] = useState<Employee | null>(null);
  /** Narrow the list to who is in, or who has not punched. */
  const [only, setOnly] = useState<"all" | "in" | "out">("all");

  const profile = useGetMyProfileQuery();
  const dept = refOf<DepartmentRef>(profile.data?.department_id);
  const departmentId = dept?._id ?? me?.department_id;
  const departmentName = dept?.department_name ?? me?.department_name;

  const team = useGetEmployeesQuery(
    { department_id: departmentId, status: "active", limit: PAGE },
    { skip: !departmentId },
  );
  const birthdays = useGetUpcomingBirthdaysQuery({ days: 30 });

  /**
   * Who is actually in today.
   *
   * `/attendance/roster` is the one endpoint that joins the employee list to
   * the day's punches server-side — the alternative was a punch lookup per
   * teammate, which is a request per row for a boolean. It is a supervisor
   * read, so a plain employee may get a 403 back; that is not an error worth
   * showing, it just means this section is not theirs to see, and every part of
   * the screen that depends on it disappears rather than half-rendering.
   */
  const todayKey = ymd(new Date());
  const roster = useGetRosterQuery(
    { date: todayKey, department_id: departmentId, limit: PAGE },
    { skip: !departmentId },
  );

  /** Roster rows keyed by employee `_id` — the id both APIs agree on. */
  const rosterById = useMemo(() => {
    const map = new Map<string, RosterEntry>();
    for (const e of roster.data?.items ?? []) map.set(e._id, e);
    return map;
  }, [roster.data]);

  const rosterReadable = Boolean(departmentId) && !roster.error;

  /**
   * Counted from the ROWS, not from `meta.counts`.
   *
   * The server's counts describe the whole department; these rows are the page
   * the screen actually drew. A header that says "12 present" above eight
   * visible people is a bug report waiting to be filed.
   */
  const inToday = useMemo(() => {
    const items = roster.data?.items ?? [];
    let present = 0;
    let late = 0;
    for (const e of items) {
      if (!e.came) continue;
      present += 1;
      if (e.attendance?.is_late) late += 1;
    }
    return { present, late, pending: items.length - present, total: items.length };
  }, [roster.data]);

  /** Employee codes with a birthday TODAY — the join key both APIs agree on. */
  const todayCodes = useMemo(() => {
    const set = new Set<string>();
    for (const b of birthdays.data ?? []) {
      if (b.is_today && b.employee_id) set.add(b.employee_id);
    }
    return set;
  }, [birthdays.data]);

  const manager = refOf<ManagerRef>(profile.data?.manager_id);

  const people = useMemo(() => {
    const all = team.data?.items ?? [];
    return [...all].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [team.data]);

  /** The manager's full record when they are in this department too. */
  const managerRecord = useMemo(
    () =>
      manager?._id ? people.find((p) => p._id === manager._id) : undefined,
    [people, manager],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rest = people.filter((p) => p._id !== managerRecord?._id);

    // The punch filter runs before the text one: "who is in" is a smaller set
    // than "whose name contains an a", so narrowing by it first is both the
    // cheaper order and the one that matches how the two chips read together.
    if (only !== "all" && rosterReadable) {
      rest = rest.filter((p) => {
        const came = rosterById.get(p._id)?.came;
        return only === "in" ? came === true : came === false;
      });
    }

    if (!q) return rest;
    return rest.filter((p) =>
      [p.name, p.designation, p.employee_id, p.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [people, managerRecord, query, only, rosterReadable, rosterById]);

  const myEmployeeId = me?.employee_id;
  const total = team.data?.meta?.total ?? people.length;
  const loading = team.isLoading || profile.isLoading;

  const birthdayToday = useMemo(
    () => people.filter((p) => p.employee_id && todayCodes.has(p.employee_id)),
    [people, todayCodes],
  );

  const refreshAll = () => {
    profile.refetch();
    if (departmentId) {
      team.refetch();
      roster.refetch();
    }
    birthdays.refetch();
  };

  const phone = selected?.phone;
  const wa = waNumber(phone);
  /**
   * The chat account behind this employee.
   *
   * The messages API keys on USER ids while this screen holds EMPLOYEE records
   * — `usePresence` already builds the bridge from the cached contacts list, so
   * resolving it here costs no extra request.
   */
  const chatUserId = selected?.employee_id
    ? empToUser[selected.employee_id]
    : undefined;

  // Both of these strips are tinted panels, and a dark scheme that swaps them
  // for a plain card throws the tint away — the amber that says "birthday" and
  // the brand edge that says "this is your manager" are the only things marking
  // them out from the rows below. `toneFor` keeps the hue on a dark canvas.
  const cake = toneFor(surface.warning, dark);

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
            Team
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={T.caption}
            numberOfLines={1}
          >
            {departmentName ?? "Your department"}
            {loading ? "" : ` · ${total} ${total === 1 ? "person" : "people"}`}
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate("Birthdays")}
          accessibilityRole="button"
          accessibilityLabel="Birthdays"
          style={({ pressed }) => ({
            backgroundColor: tint.bg,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          })}
          className="h-10 w-10 items-center justify-center"
        >
          <Cake size={19} strokeWidth={2.2} color={brand[600]} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={team.isFetching && !team.isLoading}
            onRefresh={refreshAll}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Search ─────────────────────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: space.screen,
            backgroundColor: c.card,
            borderRadius: radius.input,
            borderWidth: 1,
            borderColor: c.border,
          }}
          className="h-12 flex-row items-center gap-2.5 px-3.5"
        >
          <Search size={17} strokeWidth={2} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, role or ID"
            placeholderTextColor={c.textFaint}
            style={{
              flex: 1,
              color: c.text,
              fontFamily: "Outfit_500Medium",
              fontSize: 14,
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search your team"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <X size={16} strokeWidth={2.4} color={c.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {/* ── In today ───────────────────────────────────────────────────
            The first question anyone opens Team with in the morning. It sits
            above the birthday strip and the manager card because both of those
            are things you look up occasionally, and this is the thing you came
            for.

            Absent from this panel on purpose: the word "absent". The roster is
            punch-derived and knows nothing about approved leave, so a person on
            sanctioned leave and a person who overslept arrive here identical.
            Calling both "absent" in front of their whole department would be
            the app inventing a fact — "yet to punch" is all that is known. */}
        {rosterReadable ? (
          <View
            style={{
              marginHorizontal: space.screen,
              marginTop: space.lg,
              backgroundColor: c.card,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: c.border,
              padding: space.lg,
              ...(dark ? shadow.none : shadow.soft),
            }}
          >
            <View className="flex-row items-center gap-3">
              <IconWell tone={surface.success} size={38} round>
                <UserCheck
                  size={18}
                  strokeWidth={2.2}
                  color={surface.success.tint}
                />
              </IconWell>

              <View className="flex-1">
                <Text style={{ color: c.text }} className={T.cardTitleSm}>
                  In today
                </Text>
                <Text
                  style={{ color: c.textMuted }}
                  className={`mt-0.5 ${T.micro}`}
                  numberOfLines={1}
                >
                  {fmtDate(todayKey)}
                  {inToday.late
                    ? ` · ${inToday.late} late`
                    : ""}
                </Text>
              </View>

              {roster.isLoading ? (
                <Skeleton width={54} height={26} radius={radius.well} />
              ) : (
                <View className="flex-row items-baseline">
                  <Text style={{ color: c.text }} className={T.kpiSm}>
                    {inToday.present}
                  </Text>
                  <Text style={{ color: c.textFaint }} className={T.micro}>
                    {" / "}
                    {inToday.total}
                  </Text>
                </View>
              )}
            </View>

            {/* One bar, three segments — on time, late, still out. A row of
                three numbers said the same thing but had to be read; the bar
                is understood before it is read. */}
            <View
              style={{
                height: 6,
                marginTop: space.md,
                borderRadius: radius.pill,
                backgroundColor: c.fill,
                overflow: "hidden",
              }}
              className="flex-row"
            >
              <View
                style={{
                  flexGrow: Math.max(0, inToday.present - inToday.late),
                  backgroundColor: surface.success.tint,
                }}
              />
              <View
                style={{
                  flexGrow: inToday.late,
                  backgroundColor: surface.warning.tint,
                }}
              />
              <View style={{ flexGrow: inToday.pending }} />
            </View>

            {/* ── Filter ───────────────────────────────────────────────
                Three chips rather than a toggle: "who is still out" is as
                real a question as "who is in", and a two-state switch would
                have made one of them the absence of the other. */}
            <View className="mt-3 flex-row" style={{ gap: space.sm }}>
              {(
                [
                  { key: "all", label: "Everyone", count: inToday.total },
                  { key: "in", label: "In", count: inToday.present },
                  { key: "out", label: "Yet to punch", count: inToday.pending },
                ] as const
              ).map((f) => {
                const active = only === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setOnly(f.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${f.label}, ${f.count}`}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: active ? tint.bg : c.fill,
                      borderRadius: radius.well,
                      borderWidth: 1,
                      borderColor: active ? brand[600] : "transparent",
                      opacity: pressed ? 0.75 : 1,
                    })}
                    className="items-center py-2"
                  >
                    <Text
                      style={{ color: active ? brand[700] : c.text }}
                      className={T.cardTitleSm}
                      allowFontScaling={false}
                    >
                      {f.count}
                    </Text>
                    <Text
                      style={{ color: active ? brand[600] : c.textMuted }}
                      className={T.micro}
                      numberOfLines={1}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Birthdays today ────────────────────────────────────────────
            Only when there ARE any. A permanent "no birthdays today" strip
            would cost a row of the screen every day of the year to say
            nothing. */}
        {birthdayToday.length > 0 ? (
          <Pressable
            onPress={() => navigation.navigate("Birthdays")}
            accessibilityRole="button"
            accessibilityLabel={`${birthdayToday.length} birthdays in your team today. Open birthdays`}
            style={({ pressed }) => ({
              marginHorizontal: space.screen,
              marginTop: space.lg,
              backgroundColor: cake.bg,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: cake.border,
              padding: space.md,
              opacity: pressed ? 0.85 : 1,
            })}
            className="flex-row items-center gap-3"
          >
            <IconWell tone={surface.warning} size={38} round>
              <Cake size={18} strokeWidth={2.2} color={surface.warning.tint} />
            </IconWell>
            <View className="flex-1">
              <Text
                style={{ color: c.text }}
                className={T.cardTitleSm}
                numberOfLines={1}
              >
                {birthdayToday.length === 1
                  ? `${birthdayToday[0].name?.split(" ")[0] ?? "A teammate"}'s birthday today`
                  : `${birthdayToday.length} birthdays in your team today`}
              </Text>
              <Text
                style={{ color: c.textMuted }}
                className={`mt-0.5 ${T.micro}`}
              >
                Tap to send your wishes
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* ── Manager ────────────────────────────────────────────────────
            Above the list, not inside it. "Who do I report to" is a different
            question from "who else is here", and alphabetical order buries the
            answer somewhere in the M's. */}
        {manager?._id ? (
          <View style={{ marginTop: space.xl }}>
            <Text
              style={{ color: c.textFaint, paddingHorizontal: space.screen }}
              className={`uppercase ${T.micro}`}
            >
              Reporting to
            </Text>
            <View
              style={{ paddingHorizontal: space.screen, marginTop: space.md }}
            >
              <Pressable
                onPress={() =>
                  managerRecord ? setSelected(managerRecord) : undefined
                }
                disabled={!managerRecord}
                accessibilityRole="button"
                accessibilityLabel={`Manager ${manager.name ?? ""}`}
                style={({ pressed }) => ({
                  backgroundColor: c.card,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: tint.border,
                  padding: space.lg,
                  opacity: pressed && managerRecord ? 0.85 : 1,
                  ...(dark ? shadow.none : shadow.soft),
                })}
                className="flex-row items-center gap-3"
              >
                <Avatar
                  user={personUser({
                    _id: manager._id,
                    name: manager.name,
                    profile_image: managerRecord?.profile_image,
                  })}
                  size={48}
                />
                <View className="flex-1">
                  <Text
                    style={{ color: c.text }}
                    className={T.cardTitle}
                    numberOfLines={1}
                  >
                    {manager.name || manager.employee_id || "Your manager"}
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className={`mt-0.5 ${T.micro}`}
                    numberOfLines={1}
                  >
                    {manager.designation || "Reporting manager"}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Badge
                    label="Manager"
                    tone={primary}
                    icon={
                      <Crown size={11} strokeWidth={2.6} color={primary.tint} />
                    }
                  />
                  {(() => {
                    const t = rosterReadable
                      ? todayOf(
                          manager._id ? rosterById.get(manager._id) : undefined,
                        )
                      : null;
                    if (!t) return null;
                    return <Badge label={t.label} tone={t.tone} />;
                  })()}
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── The team ───────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xl }}>
          <Text
            style={{ color: c.textFaint, paddingHorizontal: space.screen }}
            className={`uppercase ${T.micro}`}
          >
            {query ? `${results.length} matching` : "Teammates"}
          </Text>

          <View
            style={{
              paddingHorizontal: space.screen,
              marginTop: space.md,
              gap: space.md,
            }}
          >
            {loading ? (
              <>
                <Skeleton height={74} radius={radius.card} />
                <Skeleton height={74} radius={radius.card} />
                <Skeleton height={74} radius={radius.card} />
                <Skeleton height={74} radius={radius.card} />
              </>
            ) : !departmentId ? (
              <EmptyState
                icon={
                  <UserRoundX size={32} strokeWidth={1.6} color={brand[600]} />
                }
                title="No department yet"
                message="Your record has not been mapped to a department, so there is no team to show. HR can set this on your profile."
              />
            ) : team.error ? (
              <EmptyState
                icon={
                  <UsersRound size={32} strokeWidth={1.6} color={brand[600]} />
                }
                title="Could not load your team"
                message={describeApiError(team.error).title}
                actionLabel="Try again"
                onAction={refreshAll}
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon={<Search size={32} strokeWidth={1.6} color={brand[600]} />}
                title={
                  query
                    ? "No one matches that"
                    : only === "in"
                      ? "Nobody has punched in yet"
                      : only === "out"
                        ? "Everyone is in"
                        : "No teammates yet"
                }
                message={
                  query
                    ? `Nothing in ${departmentName ?? "your department"} matches "${query.trim()}".`
                    : only === "in"
                      ? "No clock-in has come through for your department today."
                      : only === "out"
                        ? "Every active person in your department has clocked in."
                        : "You are the only active person in this department right now."
                }
                actionLabel={
                  query ? "Clear search" : only !== "all" ? "Show everyone" : undefined
                }
                onAction={
                  query
                    ? () => setQuery("")
                    : only !== "all"
                      ? () => setOnly("all")
                      : undefined
                }
              />
            ) : (
              results.map((p) => (
                <PersonRow
                  key={p._id}
                  person={p}
                  isMe={Boolean(myEmployeeId && p.employee_id === myEmployeeId)}
                  birthday={Boolean(
                    p.employee_id && todayCodes.has(p.employee_id),
                  )}
                  online={isEmpOnline(p.employee_id)}
                  today={
                    rosterReadable ? todayOf(rosterById.get(p._id)) : null
                  }
                  onPress={() => setSelected(p)}
                />
              ))
            )}
          </View>

          {/* Never a silent cap — if a department outgrows one page, say so
              rather than quietly showing the first 200 as if that were all. */}
          {!loading && total > people.length ? (
            <Text
              style={{
                color: c.textFaint,
                paddingHorizontal: space.screen,
                marginTop: space.md,
              }}
              className={T.micro}
            >
              Showing the first {people.length} of {total}. Use search to find
              someone specific.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Contact sheet ────────────────────────────────────────────────
          One place that owns every way to reach a person. A row of tiny icons
          on the list card meant four ~24px targets per row and no room left to
          say WHICH number the tap would dial. */}
      <BottomSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxHeightRatio={0.7}
      >
        <View style={{ padding: space.screen }}>
          <View className="items-center">
            <Avatar user={personUser(selected ?? {})} size={72} />
            <Text
              style={{ color: c.text }}
              className={`mt-3 text-center ${T.section}`}
            >
              {selected?.name || selected?.employee_id || "Teammate"}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-0.5 text-center ${T.secondary}`}
            >
              {selected?.designation || "—"}
            </Text>

            <View
              className="mt-3 flex-row flex-wrap justify-center"
              style={{ gap: space.sm }}
            >
              {departmentName ? (
                <Badge label={departmentName} tone={primary} />
              ) : null}
              {selected?.employee_id ? (
                <Badge
                  label={selected.employee_id}
                  tone={surface.neutral}
                  icon={
                    <BadgeCheck
                      size={11}
                      strokeWidth={2.6}
                      color={surface.neutral.tint}
                    />
                  }
                />
              ) : null}
              {selected?.employee_id && todayCodes.has(selected.employee_id) ? (
                <Badge
                  label="Birthday today"
                  tone={surface.warning}
                  icon={
                    <Cake
                      size={11}
                      strokeWidth={2.6}
                      color={surface.warning.tint}
                    />
                  }
                />
              ) : null}
            </View>
          </View>

          <View style={{ marginTop: space.xl, gap: space.sm }}>
            {/* In-app chat sits first: it is the only channel that stays inside
                the company, and it is live on both sides. Rendered only when
                the employee resolves to a chat account — a "Message" row that
                dead-ends is worse than no row. */}
            {chatUserId ? (
              <ContactRow
                icon={MessageSquare}
                label="Message"
                value={
                  selected?.employee_id && isEmpOnline(selected.employee_id)
                    ? "Online now"
                    : "Chat inside SHR"
                }
                tone={primary}
                onPress={() => {
                  const target = selected;
                  setSelected(null);
                  if (!target) return;
                  navigation.navigate("Chat", {
                    userId: chatUserId,
                    name: target.name,
                    photo: target.profile_image ?? null,
                    designation: target.designation,
                    // Everyone on this screen is in the signed-in employee's
                    // own department, so the name is already on hand — the chat
                    // header should not have to go and fetch it.
                    department: departmentName,
                  });
                }}
              />
            ) : null}

            {phone ? (
              <ContactRow
                icon={Phone}
                label="Call"
                value={phone}
                sensitive
                tone={surface.success}
                onPress={() =>
                  open(`tel:${digitsOf(phone)}`, "Dialer open nahi ho paya.")
                }
              />
            ) : null}

            {wa ? (
              <ContactRow
                icon={MessageCircle}
                label="WhatsApp"
                value={phone as string}
                sensitive
                tone={surface.success}
                onPress={() =>
                  open(`https://wa.me/${wa}`, "WhatsApp open nahi ho paya.")
                }
              />
            ) : null}

            {selected?.email ? (
              <ContactRow
                icon={Mail}
                label="Email"
                value={selected.email}
                sensitive
                tone={surface.info}
                onPress={() =>
                  open(
                    `mailto:${selected.email}`,
                    "Mail app open nahi ho paya.",
                  )
                }
              />
            ) : null}

            {!phone && !selected?.email ? (
              <Text
                style={{ color: c.textMuted }}
                className={`text-center ${T.secondary}`}
              >
                No contact details shared for this teammate.
              </Text>
            ) : null}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
