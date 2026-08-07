import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  BadgeCheck,
  Cake,
  ChevronLeft,
  Crown,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
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
import { Badge, EmptyState, IconWell, Skeleton } from "../components/ui";
import { usePresence } from "../hooks/usePresence";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
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

/* ── Person row ───────────────────────────────────────────────────────────── */

function PersonRow({
  person,
  isMe,
  birthday,
  online,
  onPress,
}: {
  person: Employee;
  isMe: boolean;
  /** Their birthday is TODAY — the one fact worth interrupting a list for. */
  birthday: boolean;
  /** Live, off the presence socket. */
  online: boolean;
  onPress: () => void;
}) {
  const { c, dark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        person.name ?? "Teammate",
        person.designation,
        person.employee_id,
        online ? "online" : null,
        birthday ? "birthday today" : null,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Opens contact details"
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
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
          The employee id gets its own chip, right-aligned. It is the field a
          directory is actually scanned for — a column of chips can be read
          straight down, where the same string buried mid-sentence cannot. */}
      <View className="items-end gap-1">
        {person.employee_id ? (
          <View
            style={{ backgroundColor: c.fill, borderRadius: radius.pill }}
            className="px-2.5 py-1"
          >
            <Text
              style={{ color: c.textMuted }}
              className={T.count}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {person.employee_id}
            </Text>
          </View>
        ) : null}

        {/* Presence of a number, not a second way to dial: the sheet owns every
            action, so one tap target does one thing. */}
        {person.phone ? (
          <Phone size={13} strokeWidth={2} color={c.textFaint} />
        ) : null}
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
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Surface;
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
        <Text
          style={{ color: c.text }}
          className={`mt-0.5 ${T.cardTitleSm}`}
          numberOfLines={1}
        >
          {value}
        </Text>
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

  const profile = useGetMyProfileQuery();
  const dept = refOf<DepartmentRef>(profile.data?.department_id);
  const departmentId = dept?._id ?? me?.department_id;
  const departmentName = dept?.department_name ?? me?.department_name;

  const team = useGetEmployeesQuery(
    { department_id: departmentId, status: "active", limit: PAGE },
    { skip: !departmentId },
  );
  const birthdays = useGetUpcomingBirthdaysQuery({ days: 30 });

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
    const rest = people.filter((p) => p._id !== managerRecord?._id);
    if (!q) return rest;
    return rest.filter((p) =>
      [p.name, p.designation, p.employee_id, p.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [people, managerRecord, query]);

  const myEmployeeId = me?.employee_id;
  const total = team.data?.meta?.total ?? people.length;
  const loading = team.isLoading || profile.isLoading;

  const birthdayToday = useMemo(
    () => people.filter((p) => p.employee_id && todayCodes.has(p.employee_id)),
    [people, todayCodes],
  );

  const refreshAll = () => {
    profile.refetch();
    if (departmentId) team.refetch();
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
              borderRadius: radius.card - 4,
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
                  borderRadius: radius.card - 4,
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
                <Badge
                  label="Manager"
                  tone={primary}
                  icon={
                    <Crown size={11} strokeWidth={2.6} color={primary.tint} />
                  }
                />
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
                <Skeleton height={74} radius={radius.card - 4} />
                <Skeleton height={74} radius={radius.card - 4} />
                <Skeleton height={74} radius={radius.card - 4} />
                <Skeleton height={74} radius={radius.card - 4} />
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
                title={query ? "No one matches that" : "No teammates yet"}
                message={
                  query
                    ? `Nothing in ${departmentName ?? "your department"} matches "${query.trim()}".`
                    : "You are the only active person in this department right now."
                }
                actionLabel={query ? "Clear search" : undefined}
                onAction={query ? () => setQuery("") : undefined}
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
                  });
                }}
              />
            ) : null}

            {phone ? (
              <ContactRow
                icon={Phone}
                label="Call"
                value={phone}
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
