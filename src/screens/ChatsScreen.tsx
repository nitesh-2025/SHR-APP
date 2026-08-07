import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  ChevronLeft,
  Mail,
  MessageCircle,
  MoreVertical,
  Search,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, personUser } from "../components/Avatar";
import { EmptyState, Skeleton } from "../components/ui";
import { usePresence } from "../hooks/usePresence";
import { describeApiError } from "../lib/apiError";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import { selectTypingMap } from "../store/presenceSlice";
import {
  useGetContactsQuery,
  useGetThreadsQuery,
  type ChatUser,
  type Thread,
} from "../store/chatApi";
import { radius, space, surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDayShort, fmtTime } from "../utils/date";

/** A name for a contact whichever fields the server filled in. */
function nameOf(u?: ChatUser | null): string {
  if (!u) return "Unknown";
  return (
    u.name?.trim() ||
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.email ||
    u.employee_id ||
    "Unknown"
  );
}

/** Today → time, otherwise the date. A chat list is scanned, not read. */
function whenOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay ? (fmtTime(iso) ?? "") : fmtDayShort(iso);
}

/** Case-insensitive "any of these fields contains the query". */
function hits(q: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => !!f && f.toLowerCase().includes(q));
}

/**
 * Below this the directory is not queried at all. One letter matches most of
 * the company, which is the whole-list download this search exists to avoid.
 */
const MIN_QUERY = 2;

/** One size for every row on the screen — a conversation and a colleague are
 *  the same kind of thing, and two avatar sizes read as two lists. */
const AVATAR = 44;

/** The unread count pill. Its slot is held open on read rows too, so the
 *  timestamp above it keeps the same baseline down the whole list. */
const BADGE = 20;

/* ── Presence avatar ──────────────────────────────────────────────────────── */

function PresenceAvatar({ user, online }: { user: ChatUser; online: boolean }) {
  const { c } = useTheme();
  return (
    <View>
      <Avatar
        user={personUser({ ...user, name: nameOf(user) })}
        size={AVATAR}
      />
      {online ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            backgroundColor: surface.success.tint,
            borderWidth: 2,
            borderColor: c.card,
          }}
          className="h-3.5 w-3.5 rounded-full"
        />
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Chats — every conversation, newest first.
 *
 * The list never polls. `useRealtime` invalidates the `Threads` tag on every
 * `MESSAGE_CREATED` / `MESSAGES_READ` the socket delivers, so a new message
 * moves its thread to the top and drops the unread badge while this screen is
 * open, on whichever device did the reading.
 */
export default function ChatsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, tint } = useTheme();
  const { isUserOnline } = usePresence();

  const searchRef = useRef<TextInput>(null);
  /** Both strips are closed until their header icon asks for them. */
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState(""); // debounced — this is what hits the API
  /** All vs Unread. Two filters, because two is all this app has to filter by:
   *  there are no groups and no mentions yet, and a chip that filters nothing
   *  is a promise the screen cannot keep. */
  const [onlyUnread, setOnlyUnread] = useState(false);

  const me = useAppSelector(selectCurrentUser);
  const typingMap = useAppSelector(selectTypingMap);
  const threads = useGetThreadsQuery();

  // A keystroke is not a request. Only the settled term is fetched, so typing
  // "priya" costs one round trip instead of five.
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // `typed` drives everything already in memory (instant, every keystroke);
  // `q` is the debounced term the network sees.
  const typed = query.trim().toLowerCase();
  const q = term.toLowerCase();
  const searching = typed.length > 0;

  /**
   * The directory is fetched ONLY for what was typed — never the whole company
   * on mount. `search` goes to the server; the same predicate re-runs on the
   * client so the list stays correct even if the endpoint ignores the param.
   */
  const contacts = useGetContactsQuery(term, { skip: q.length < MIN_QUERY });

  const sorted = useMemo(
    () =>
      [...(threads.data ?? [])].sort((a, b) =>
        (b.last_at ?? "").localeCompare(a.last_at ?? ""),
      ),
    [threads.data],
  );

  /** What the plain (unsearched) list shows — the Unread chip narrows it. */
  const visible = useMemo(
    () => (onlyUnread ? sorted.filter((t) => t.unread > 0) : sorted),
    [sorted, onlyUnread],
  );

  // Existing conversations match locally — they are already in memory, and a
  // round trip per keystroke would make typing feel slower than reading.
  const matchedThreads = useMemo(() => {
    if (!searching) return visible;
    // Search looks at EVERY conversation, not just the filtered ones — a chip
    // you forgot you tapped must not hide the person you are searching for.
    return sorted.filter((t) =>
      hits(
        typed,
        nameOf(t.partner),
        t.partner?.designation,
        t.partner?.employee_id,
        t.last_content,
      ),
    );
  }, [sorted, visible, typed, searching]);

  // Colleagues you have no thread with yet — the "new chat" half of the search.
  const colleagues = useMemo(() => {
    if (!searching || q.length < MIN_QUERY) return [];
    const known = new Set(sorted.map((t) => t._id));
    return (contacts.data ?? []).filter(
      (u) =>
        !known.has(u._id) &&
        hits(q, nameOf(u), u.designation, u.employee_id, u.email),
    );
  }, [contacts.data, sorted, q, searching]);

  const closeSearch = () => {
    setQuery("");
    setTerm("");
  };

  /** Closing the field also drops the query — a hidden filter is a bug report
   *  waiting to happen ("half my chats disappeared"). */
  const toggleSearch = () => {
    setShowSearch((open) => {
      if (open) closeSearch();
      return !open;
    });
  };

  const openChat = (user: ChatUser) => {
    closeSearch();
    navigation.navigate("Chat", {
      userId: user._id,
      name: nameOf(user),
      photo: user.profile_image ?? null,
      designation: user.designation,
    });
  };

  const myId = String(me?._id ?? "");
  const unreadTotal = sorted.reduce((n, t) => n + (t.unread || 0), 0);

  const openThread = (t: Thread) => {
    closeSearch();
    navigation.navigate("Chat", {
      userId: t._id,
      name: nameOf(t.partner),
      photo: t.partner?.profile_image ?? null,
      designation: t.partner?.designation,
    });
  };

  /**
   * One conversation row.
   *
   * Flat, not a card. Forty conversations drawn as forty bordered, shadowed
   * cards is forty objects to parse; a hairline between rows says "same list,
   * next item" for a fraction of the ink.
   */
  const renderThread = (t: Thread) => {
    const unread = t.unread > 0;
    const fromMe = Boolean(myId) && String(t.last_sender ?? "") === myId;
    return (
      <Pressable
        key={t._id}
        onPress={() => openThread(t)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${nameOf(t.partner)}${
          unread ? `, ${t.unread} unread` : ""
        }`}
        // A PLAIN object, never `({ pressed }) => …`: NativeWind 4.2 on RN 0.86
        // drops a function style handed to Pressable, and the row rendered with
        // no fill, no padding and no separator. Press feedback is the ripple.
        style={{
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
        android_ripple={{ color: c.fill }}
        className="flex-row items-center gap-3"
      >
        <PresenceAvatar user={t.partner} online={isUserOnline(t._id)} />

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.cardTitle}
            numberOfLines={1}
          >
            {nameOf(t.partner)}
          </Text>
          {/* An unread preview reads at full strength; a read one steps back,
              so the eye finds what is waiting without a badge hunt. The "You:"
              prefix answers the question a chat list always raises — am I
              waiting on them, or are they waiting on me? */}
          {/* A live "typing…" outranks the last message: it is the only thing
              on this row that is true right now. */}
          {typingMap[t._id] ? (
            <Text
              style={{ color: brand[600] }}
              className={`mt-0.5 font-ui-semibold ${T.secondary}`}
              numberOfLines={1}
            >
              typing…
            </Text>
          ) : (
            <Text
              style={{ color: unread ? c.text : c.textMuted }}
              className={`mt-0.5 ${T.secondary}`}
              numberOfLines={1}
            >
              {fromMe ? (
                <Text style={{ color: brand[600] }} className="font-ui-semibold">
                  You:{" "}
                </Text>
              ) : null}
              {t.last_content || "Attachment"}
            </Text>
          )}
        </View>

        <View className="items-end gap-1.5">
          {/* `T.count` is the same 11px, only semibold — stacking
              `font-ui-semibold` onto `T.micro` does nothing, because both are
              fontFamily utilities and the regular one is emitted last. */}
          <Text
            style={{ color: unread ? brand[600] : c.textFaint }}
            className={unread ? T.count : T.micro}
            allowFontScaling={false}
          >
            {whenOf(t.last_at)}
          </Text>
          <View style={{ height: BADGE }} className="items-end justify-center">
            {unread ? (
              <View
                style={{
                  backgroundColor: brand[600],
                  borderRadius: radius.pill,
                  minWidth: BADGE,
                  height: BADGE,
                  paddingHorizontal: space.xs + 1,
                }}
                className="items-center justify-center"
              >
                <Text
                  className={`text-white ${T.count}`}
                  allowFontScaling={false}
                >
                  {t.unread > 99 ? "99+" : t.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  /** A colleague with no thread yet — same row shape as a conversation. */
  const renderPerson = (u: ChatUser) => (
    <Pressable
      key={u._id}
      onPress={() => openChat(u)}
      accessibilityRole="button"
      accessibilityLabel={`Start a chat with ${nameOf(u)}`}
      style={{
        backgroundColor: c.card,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
      android_ripple={{ color: c.fill }}
      className="flex-row items-center gap-3"
    >
      <PresenceAvatar user={u} online={isUserOnline(u._id)} />
      <View className="flex-1">
        <Text
          style={{ color: c.text }}
          className={T.cardTitle}
          numberOfLines={1}
        >
          {nameOf(u)}
        </Text>
        <Text
          style={{ color: c.textMuted }}
          className={`mt-0.5 ${T.secondary}`}
          numberOfLines={1}
        >
          {u.designation || u.employee_id || "—"}
        </Text>
      </View>
    </Pressable>
  );

  const sectionLabel = (text: string) => (
    <Text
      key={`section-${text}`}
      style={{
        color: c.textFaint,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.xs,
      }}
      className={T.label}
    >
      {text}
    </Text>
  );

  const hint = (text: string) => (
    <Text
      style={{ color: c.textMuted, paddingHorizontal: space.lg }}
      className={`py-6 text-center ${T.secondary}`}
    >
      {text}
    </Text>
  );

  /** All / Unread. */
  const chip = (
    label: string,
    Icon: LucideIcon,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label.toLowerCase()} chats`}
      style={{
        backgroundColor: active ? brand[600] : c.card,
        borderWidth: 1,
        borderColor: active ? brand[600] : c.border,
        borderRadius: radius.pill,
        paddingHorizontal: space.md + 2,
        overflow: "hidden",
      }}
      android_ripple={{ color: active ? "rgba(255,255,255,0.25)" : c.fill }}
      className="h-9 flex-row items-center gap-1.5"
    >
      {/* White ink, not `c.card`: the accent stays green in dark mode, so the
          fill this sits on does not follow the scheme. */}
      <Icon
        size={14}
        strokeWidth={2.4}
        color={active ? "#FFFFFF" : c.textMuted}
      />
      <Text
        style={active ? undefined : { color: c.textMuted }}
        className={active ? `text-white ${T.buttonSm}` : T.buttonSm}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: c.card }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
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
            Chats
          </Text>
          <Text
            numberOfLines={1}
            className={T.micro}
            style={{ color: c.textMuted, marginTop: 0 }}
          >
            Stay connected with team
          </Text>
        </View>

        {/* Two switches, not two destinations: each icon opens the strip it
            owns and closes it again, so a header of five rows is only ever as
            tall as what you asked for. */}
        <Pressable
          onPress={toggleSearch}
          accessibilityRole="button"
          accessibilityState={{ expanded: showSearch }}
          accessibilityLabel="Search chats or colleagues"
          style={{
            backgroundColor: showSearch ? tint.bg : "transparent",
            borderRadius: radius.pill,
            overflow: "hidden",
          }}
          android_ripple={{ color: brand[200] }}
          className="h-10 w-10 items-center justify-center"
        >
          <Search
            size={20}
            strokeWidth={2.2}
            color={showSearch ? brand[600] : c.text}
          />
        </Pressable>

        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          accessibilityLabel="Filter conversations"
          style={{
            backgroundColor: showFilters ? tint.bg : "transparent",
            borderRadius: radius.pill,
            overflow: "hidden",
          }}
          android_ripple={{ color: brand[200] }}
          className="h-10 w-10 items-center justify-center"
        >
          <MoreVertical
            size={20}
            strokeWidth={2.2}
            color={showFilters ? brand[600] : c.text}
          />
        </Pressable>
      </View>

      {/* ── Search ─────────────────────────────────────────────────────────
          Same control Team uses, so the two directories in this app are
          searched the same way — just folded away until it is asked for. */}
      {showSearch ? (
        <View
          style={{
            marginHorizontal: space.lg,
            marginBottom: space.md,
            backgroundColor: c.card,
            borderRadius: radius.input,
            borderWidth: 1,
            borderColor: c.border,
          }}
          className="h-12 flex-row items-center gap-2.5 px-3.5"
        >
          <Search size={17} strokeWidth={2} color={c.textFaint} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search chats or colleagues"
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
            accessibilityLabel="Search chats or colleagues"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} strokeWidth={2.4} color={c.textFaint} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Filters step aside while the search is in use — a chip that quietly
          excludes results is how a search comes back empty for someone who is
          right there. */}
      {!showFilters || searching ? null : (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingBottom: space.md,
            gap: space.sm,
          }}
          className="flex-row items-center"
        >
          {chip("All", MessageCircle, !onlyUnread, () => setOnlyUnread(false))}
          {chip(
            unreadTotal ? `Unread (${unreadTotal})` : "Unread",
            Mail,
            onlyUnread,
            () => setOnlyUnread(true),
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + space.xxxl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={threads.isFetching && !threads.isLoading}
            onRefresh={() => threads.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {searching ? (
          /* ── Search results ─────────────────────────────────────────────
             Two halves of the same question: conversations you already have
             (matched in memory) and colleagues you don't (fetched for THIS
             term only). */
          <>
            {matchedThreads.length > 0 ? (
              <>
                {sectionLabel("Chats")}
                {matchedThreads.map(renderThread)}
              </>
            ) : null}

            {sectionLabel("Colleagues")}
            {typed.length < MIN_QUERY ? (
              hint(`Type at least ${MIN_QUERY} letters to search colleagues.`)
            ) : contacts.isFetching || q !== typed ? (
              /* `q !== typed` = the debounce is still running, so the request
                 for what is on screen has not gone out yet. Skeletons, not a
                 premature "nobody matches". */
              <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
                <Skeleton height={56} radius={radius.well} />
                <Skeleton height={56} radius={radius.well} />
              </View>
            ) : contacts.error ? (
              hint(describeApiError(contacts.error).title)
            ) : colleagues.length === 0 ? (
              hint(
                matchedThreads.length > 0
                  ? "Nobody else matches."
                  : `Nobody matches "${term}".`,
              )
            ) : (
              colleagues.map(renderPerson)
            )}
          </>
        ) : threads.isLoading ? (
          <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
            <Skeleton height={56} radius={radius.well} />
            <Skeleton height={56} radius={radius.well} />
            <Skeleton height={56} radius={radius.well} />
            <Skeleton height={56} radius={radius.well} />
          </View>
        ) : threads.error ? (
          <EmptyState
            icon={
              <MessageCircle size={32} strokeWidth={1.6} color={brand[600]} />
            }
            title="Could not load chats"
            message={describeApiError(threads.error).title}
            actionLabel="Try again"
            onAction={() => threads.refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={
              <MessageCircle size={32} strokeWidth={1.6} color={brand[600]} />
            }
            title={onlyUnread ? "Nothing unread" : "No conversations yet"}
            message={
              onlyUnread
                ? "Every conversation is caught up. Switch to All to see them."
                : "Start one with anyone in the company — search a name above and the chat opens on both sides."
            }
            actionLabel={onlyUnread ? "Show all chats" : "Find a colleague"}
            onAction={() =>
              onlyUnread ? setOnlyUnread(false) : setShowSearch(true)
            }
          />
        ) : (
          visible.map(renderThread)
        )}
      </ScrollView>
    </View>
  );
}
