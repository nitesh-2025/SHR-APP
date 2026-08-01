import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronLeft, MessageCircle, PenSquare, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, personUser } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { EmptyState, Skeleton } from '../components/ui';
import { usePresence } from '../hooks/usePresence';
import { describeApiError } from '../lib/apiError';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useGetContactsQuery,
  useGetThreadsQuery,
  type ChatUser,
  type Thread,
} from '../store/chatApi';
import { radius, shadow, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDayShort, fmtTime } from '../utils/date';

/** A name for a contact whichever fields the server filled in. */
function nameOf(u?: ChatUser | null): string {
  if (!u) return 'Unknown';
  return (
    u.name?.trim() ||
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
    u.email ||
    u.employee_id ||
    'Unknown'
  );
}

/** Today → time, otherwise the date. A chat list is scanned, not read. */
function whenOf(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay ? (fmtTime(iso) ?? '') : fmtDayShort(iso);
}

/* ── Presence avatar ──────────────────────────────────────────────────────── */

function PresenceAvatar({
  user,
  online,
  size = 48,
}: {
  user: ChatUser;
  online: boolean;
  size?: number;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Avatar user={personUser({ ...user, name: nameOf(user) })} size={size} />
      {online ? (
        <View
          style={{
            position: 'absolute',
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
  const { c, brand, primary, dark } = useTheme();
  const { isUserOnline } = usePresence();

  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState('');

  const threads = useGetThreadsQuery();
  // Fetched once and cached — `usePresence` reads the same query, so opening
  // the "new chat" sheet costs nothing extra.
  const contacts = useGetContactsQuery();

  const sorted = useMemo(
    () => [...(threads.data ?? [])].sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? '')),
    [threads.data],
  );

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = contacts.data ?? [];
    if (!q) return all;
    return all.filter((u) =>
      [nameOf(u), u.designation, u.employee_id, u.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [contacts.data, query]);

  const openChat = (user: ChatUser) => {
    setNewOpen(false);
    setQuery('');
    navigation.navigate('Chat', {
      userId: user._id,
      name: nameOf(user),
      photo: user.profile_image ?? null,
      designation: user.designation,
    });
  };

  const openThread = (t: Thread) => {
    navigation.navigate('Chat', {
      userId: t._id,
      name: nameOf(t.partner),
      photo: t.partner?.profile_image ?? null,
      designation: t.partner?.designation,
    });
  };

  const unreadTotal = sorted.reduce((n, t) => n + (t.unread || 0), 0);

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
          <Text style={{ color: c.text }} className={T.section} numberOfLines={1}>
            Chats
          </Text>
          <Text style={{ color: c.textMuted }} className={T.caption} numberOfLines={1}>
            {threads.isLoading
              ? 'Loading…'
              : unreadTotal > 0
                ? `${unreadTotal} unread`
                : `${sorted.length} ${sorted.length === 1 ? 'conversation' : 'conversations'}`}
          </Text>
        </View>

        <Pressable
          onPress={() => setNewOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          style={({ pressed }) => ({
            backgroundColor: primary.bg,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          })}
          className="h-10 w-10 items-center justify-center"
        >
          <PenSquare size={18} strokeWidth={2.2} color={brand[600]} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + space.xxxl,
          gap: space.sm,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={threads.isFetching && !threads.isLoading}
            onRefresh={() => threads.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {threads.isLoading ? (
          <>
            <Skeleton height={72} radius={radius.card - 4} />
            <Skeleton height={72} radius={radius.card - 4} />
            <Skeleton height={72} radius={radius.card - 4} />
          </>
        ) : threads.error ? (
          <EmptyState
            icon={<MessageCircle size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load chats"
            message={describeApiError(threads.error).title}
            actionLabel="Try again"
            onAction={() => threads.refetch()}
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={32} strokeWidth={1.6} color={brand[600]} />}
            title="No conversations yet"
            message="Start one with anyone in the company — messages arrive live on both sides."
            actionLabel="New chat"
            onAction={() => setNewOpen(true)}
          />
        ) : (
          sorted.map((t) => {
            const unread = t.unread > 0;
            return (
              <Pressable
                key={t._id}
                onPress={() => openThread(t)}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${nameOf(t.partner)}${
                  unread ? `, ${t.unread} unread` : ''
                }`}
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
                <PresenceAvatar user={t.partner} online={isUserOnline(t._id)} />

                <View className="flex-1">
                  <Text
                    style={{ color: c.text }}
                    className={T.cardTitleSm}
                    numberOfLines={1}
                  >
                    {nameOf(t.partner)}
                  </Text>
                  {/* An unread preview reads at full strength; a read one steps
                      back, so the eye finds what is waiting without a badge
                      hunt. */}
                  <Text
                    style={{ color: unread ? c.text : c.textMuted }}
                    className={`mt-0.5 ${T.micro}`}
                    numberOfLines={1}
                  >
                    {t.last_content || 'Attachment'}
                  </Text>
                </View>

                <View className="items-end gap-1">
                  <Text style={{ color: c.textFaint }} className={T.nano} allowFontScaling={false}>
                    {whenOf(t.last_at)}
                  </Text>
                  {unread ? (
                    <View
                      style={{
                        backgroundColor: brand[600],
                        borderRadius: 999,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: 5,
                      }}
                      className="items-center justify-center"
                    >
                      <Text className={`text-white ${T.count}`} allowFontScaling={false}>
                        {t.unread > 99 ? '99+' : t.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* ── New chat ─────────────────────────────────────────────────────
          Contacts, not a blank "to:" field. Everyone here is a colleague, and
          a directory you can scan beats a name you have to spell. */}
      <BottomSheet
        visible={newOpen}
        onClose={() => {
          setNewOpen(false);
          setQuery('');
        }}
        maxHeightRatio={0.85}
      >
        <View style={{ padding: space.screen, paddingBottom: space.md }}>
          <Text style={{ color: c.text }} className={T.section}>
            New chat
          </Text>

          <View
            style={{
              marginTop: space.md,
              backgroundColor: c.fill,
              borderRadius: radius.input,
            }}
            className="h-12 flex-row items-center gap-2.5 px-3.5"
          >
            <Search size={17} strokeWidth={2} color={c.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search colleagues"
              placeholderTextColor={c.textFaint}
              style={{ flex: 1, color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14 }}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search colleagues"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <X size={16} strokeWidth={2.4} color={c.textFaint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          // Shrink to whatever the panel has left after the header above it —
          // a fixed 420 is taller than that on a short phone, and the overflow
          // is clipped silently instead of scrolling (same failure that hid the
          // clock-out button, see PunchSheet).
          style={{ flexShrink: 1, flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: space.screen,
            gap: space.sm,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {contacts.isLoading ? (
            <>
              <Skeleton height={60} radius={radius.well} />
              <Skeleton height={60} radius={radius.well} />
              <Skeleton height={60} radius={radius.well} />
            </>
          ) : people.length === 0 ? (
            <Text style={{ color: c.textMuted }} className={`py-6 text-center ${T.secondary}`}>
              {query ? `Nobody matches "${query.trim()}".` : 'No colleagues found.'}
            </Text>
          ) : (
            people.map((u) => (
              <Pressable
                key={u._id}
                onPress={() => openChat(u)}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${nameOf(u)}`}
                style={({ pressed }) => ({
                  backgroundColor: c.fill,
                  borderRadius: radius.well,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm + 2,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="flex-row items-center gap-3"
              >
                <PresenceAvatar user={u} online={isUserOnline(u._id)} size={40} />
                <View className="flex-1">
                  <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
                    {nameOf(u)}
                  </Text>
                  <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
                    {u.designation || u.employee_id || '—'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
