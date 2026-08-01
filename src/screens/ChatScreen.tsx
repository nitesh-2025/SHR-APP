import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { Check, CheckCheck, ChevronLeft, CornerUpLeft, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, personUser } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { EmptyState, Skeleton } from '../components/ui';
import { usePresence } from '../hooks/usePresence';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { selectCurrentUser, useAppSelector } from '../store';
import {
  useGetConversationQuery,
  useLazyGetConversationQuery,
  useMarkConversationReadMutation,
  useReactMessageMutation,
  useSendMessageMutation,
  type Message,
} from '../store/chatApi';
import { getSocket } from '../store/socket';
import { radius, shadow, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDate, fmtTime, parseYmd } from '../utils/date';

/** The reactions offered on long-press. Six fits one row on a 360dp screen. */
const EMOJI = ['👍', '❤️', '😂', '🎉', '🙏', '😮'];

/** How long a "typing…" relay stays alive without another keystroke. */
const TYPING_TTL = 2600;

/**
 * Socket event names, tried in every casing the backend might use.
 *
 * Same defensive approach as presence in `useRealtime`: the typing relay has no
 * pinned contract, and listening to a name the server never emits costs
 * nothing, while guessing one name and being wrong kills the feature silently.
 */
const TYPING_EVENTS = ['TYPING', 'typing', 'chat:typing'];
const STOP_TYPING_EVENTS = ['STOP_TYPING', 'stop_typing', 'chat:stop_typing'];

const idOf = (v: unknown): string =>
  typeof v === 'string' ? v : String((v as { _id?: string } | null)?._id ?? '');

/** `YYYY-MM-DD` of an ISO timestamp, in LOCAL time. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** `Today` / `Yesterday` / `26 Jul 2026`. */
function dayLabel(key: string): string {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  if (key === t) return 'Today';
  const y = new Date(today.getTime() - 86400000);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(
    y.getDate(),
  ).padStart(2, '0')}`;
  if (key === yk) return 'Yesterday';
  return parseYmd(key) ? fmtDate(key) : key;
}

/* ── Row model ────────────────────────────────────────────────────────────── */

/**
 * The list carries day separators as ROWS rather than as section headers.
 *
 * An inverted FlatList has no sticky sections worth the name, and a separator
 * that is just another row scrolls with the messages it belongs to — which is
 * what a chat actually reads like.
 */
type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; message: Message; mine: boolean; tail: boolean };

/* ── Bubble ───────────────────────────────────────────────────────────────── */

function Bubble({
  message,
  mine,
  tail,
  onLongPress,
}: {
  message: Message;
  mine: boolean;
  /** Last of a run from the same sender — only the tail carries the timestamp. */
  tail: boolean;
  onLongPress: () => void;
}) {
  const { c, brand, dark } = useTheme();

  const bg = mine ? brand[600] : c.card;
  const ink = mine ? '#FFFFFF' : c.text;
  const faint = mine ? 'rgba(255,255,255,0.72)' : c.textFaint;

  const reply = message.reply_to && typeof message.reply_to !== 'string' ? message.reply_to : null;
  const images = (message.attachments ?? []).filter((a) =>
    (a.type ?? '').startsWith('image'),
  );
  const files = (message.attachments ?? []).filter(
    (a) => !(a.type ?? '').startsWith('image'),
  );

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityLabel={`${mine ? 'You' : 'They'} said: ${message.content || 'attachment'}`}
      accessibilityHint="Long press to react or reply"
      style={({ pressed }) => ({
        maxWidth: '82%',
        alignSelf: mine ? 'flex-end' : 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.well + 2,
        // The corner nearest the sender is squared off — it is what makes a
        // bubble point at whoever said it without drawing a tail.
        borderBottomRightRadius: mine ? 6 : radius.well + 2,
        borderBottomLeftRadius: mine ? radius.well + 2 : 6,
        borderWidth: mine || dark ? 0 : 1,
        borderColor: c.border,
        paddingHorizontal: space.md,
        paddingVertical: space.sm + 2,
        opacity: pressed ? 0.9 : 1,
        ...(mine || dark ? shadow.none : shadow.soft),
      })}
    >
      {/* Quoted message — dimmed, one line. The point is which message, not
          re-reading it. */}
      {reply ? (
        <View
          style={{
            backgroundColor: mine ? 'rgba(255,255,255,0.16)' : c.fill,
            borderLeftWidth: 3,
            borderLeftColor: mine ? 'rgba(255,255,255,0.6)' : brand[600],
            borderRadius: 8,
            paddingHorizontal: space.sm,
            paddingVertical: 6,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: faint }} className={T.nano} numberOfLines={1}>
            {reply.content || 'Attachment'}
          </Text>
        </View>
      ) : null}

      {images.map((a) => (
        <Image
          key={a.url}
          source={{ uri: a.url }}
          style={{
            width: 200,
            height: 150,
            borderRadius: 12,
            marginBottom: message.content ? 6 : 0,
            backgroundColor: c.fill,
          }}
          resizeMode="cover"
          accessibilityLabel={a.name ?? 'Image attachment'}
        />
      ))}

      {files.map((a) => (
        <Text key={a.url} style={{ color: ink }} className={`${T.secondary} underline`}>
          {a.name ?? 'Attachment'}
        </Text>
      ))}

      {message.content ? (
        <Text style={{ color: ink }} className={`leading-5 ${T.body}`}>
          {message.content}
        </Text>
      ) : null}

      {/* Reactions ride the bottom of the bubble — a separate row under it made
          every reacted message two rows tall. */}
      {message.reactions && message.reactions.length > 0 ? (
        <View className="mt-1.5 flex-row flex-wrap" style={{ gap: 4 }}>
          {message.reactions.map((r) => (
            <View
              key={`${r.user_id}-${r.emoji}`}
              style={{
                backgroundColor: mine ? 'rgba(255,255,255,0.2)' : c.fill,
                borderRadius: radius.pill,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {tail ? (
        <View className="mt-1 flex-row items-center justify-end gap-1">
          <Text style={{ color: faint }} className={T.nano} allowFontScaling={false}>
            {fmtTime(message.createdAt)}
          </Text>
          {mine ? (
            message.is_read ? (
              <CheckCheck size={13} strokeWidth={2.4} color="rgba(255,255,255,0.95)" />
            ) : (
              <Check size={13} strokeWidth={2.4} color={faint} />
            )
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * One conversation, live.
 *
 * Nothing here polls. `useRealtime` already owns the socket app-wide and
 * patches `MESSAGE_CREATED` / `MESSAGE_UPDATED` straight into this query's
 * cache, so an incoming message appears without this screen asking for it —
 * and without a refetch that would throw away the scroll position.
 *
 * The list is INVERTED: a chat is read from the newest backwards, and an
 * inverted list keeps the newest pinned to the bottom for free, makes
 * "load older" a plain `onEndReached`, and never fights the keyboard.
 */
export default function ChatScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);
  const { isUserOnline } = usePresence();

  const { userId, name, photo, designation } = route.params;

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  /** The message whose action sheet is open. */
  const [acting, setActing] = useState<Message | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const { data, isLoading, error } = useGetConversationQuery({ userId });
  const [fetchOlder] = useLazyGetConversationQuery();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [react] = useReactMessageMutation();

  const items = useMemo(() => data?.items ?? [], [data]);
  const online = isUserOnline(userId);

  /* ── Read receipts ──────────────────────────────────────────────────────
     On open, and again whenever a new message lands while the screen is up.
     Cheap and idempotent — the server clears flags that are already clear. */
  useEffect(() => {
    if (items.length) markRead(userId);
  }, [userId, items.length, markRead]);

  /* ── Typing relay ───────────────────────────────────────────────────── */
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onTyping = (p: unknown) => {
      const from = idOf((p as { userId?: string; from?: string })?.from ?? p);
      if (from === userId) {
        setPartnerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_TTL);
      }
    };
    const onStop = (p: unknown) => {
      const from = idOf((p as { userId?: string; from?: string })?.from ?? p);
      if (from === userId) setPartnerTyping(false);
    };

    TYPING_EVENTS.forEach((e) => socket.on(e, onTyping));
    STOP_TYPING_EVENTS.forEach((e) => socket.on(e, onStop));

    return () => {
      TYPING_EVENTS.forEach((e) => socket.off(e, onTyping));
      STOP_TYPING_EVENTS.forEach((e) => socket.off(e, onStop));
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [userId]);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      // Throttled to one emit a second — a socket write per keystroke is a lot
      // of traffic to say something the receiver already knows.
      const now = Date.now();
      if (now - lastSent.current < 1000) return;
      lastSent.current = now;
      const socket = getSocket();
      TYPING_EVENTS.forEach((e) => socket?.emit(e, { to: userId, receiver_id: userId }));
    },
    [userId],
  );

  /* ── Rows ───────────────────────────────────────────────────────────────
     Built newest-first because the list is inverted. `tail` marks the LAST
     message of a same-sender run, which in inverted order is the one that
     comes FIRST — so the timestamp sits at the bottom of each run on screen. */
  const rows = useMemo(() => {
    const out: Row[] = [];
    const myId = String(me?._id ?? '');

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const m = items[i];
      const mine = idOf(m.sender_id) === myId;
      const next = items[i + 1];
      const tail = !next || idOf(next.sender_id) !== idOf(m.sender_id);

      out.push({ kind: 'msg', key: m._id, message: m, mine, tail });

      const prev = items[i - 1];
      const key = dayKey(m.createdAt);
      if (!prev || dayKey(prev.createdAt) !== key) {
        out.push({ kind: 'day', key: `day-${key}-${m._id}`, label: dayLabel(key) });
      }
    }
    return out;
  }, [items, me]);

  const loadOlder = async () => {
    if (loadingOlder || !data?.hasMore || items.length === 0) return;
    setLoadingOlder(true);
    try {
      await fetchOlder({ userId, before: items[0].createdAt }).unwrap();
    } catch {
      // Silent: the user did not ask for this, scrolling did. A toast here
      // would interrupt reading to report a page they never requested.
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft('');
    const reply = replyTo?._id;
    setReplyTo(null);
    try {
      await sendMessage({ receiver_id: userId, content, reply_to: reply }).unwrap();
      const socket = getSocket();
      STOP_TYPING_EVENTS.forEach((e) => socket?.emit(e, { to: userId, receiver_id: userId }));
    } catch (e) {
      // Put the text back — losing what someone typed is the worst possible
      // failure mode for a composer.
      setDraft(content);
      toast.error(describeApiError(e).title);
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!acting) return;
    const message_id = acting._id;
    setActing(null);
    try {
      await react({ message_id, emoji, partner_id: userId }).unwrap();
    } catch (e) {
      toast.error(describeApiError(e).title);
    }
  };

  const partner = personUser({ _id: userId, name, profile_image: photo });

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.md,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
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

        <View>
          <Avatar user={partner} size={40} />
          {/* Live presence, straight off the socket snapshot. */}
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

        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitle} numberOfLines={1}>
            {name || 'Chat'}
          </Text>
          <Text
            style={{ color: partnerTyping ? brand[600] : c.textMuted }}
            className={T.micro}
            numberOfLines={1}
          >
            {partnerTyping ? 'typing…' : online ? 'Online' : designation || 'Offline'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <View style={{ padding: space.screen, gap: space.md }}>
            <Skeleton height={44} width="60%" radius={radius.well} />
            <Skeleton height={44} width="45%" radius={radius.well} style={{ alignSelf: 'flex-end' }} />
            <Skeleton height={64} width="70%" radius={radius.well} />
          </View>
        ) : error ? (
          <EmptyState
            icon={<Send size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load this chat"
            message={describeApiError(error).title}
          />
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            contentContainerStyle={{
              paddingHorizontal: space.screen,
              paddingVertical: space.lg,
              gap: 6,
              // An inverted list with no items would otherwise pin the empty
              // state to the bottom edge.
              flexGrow: rows.length ? undefined : 1,
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <EmptyState
                  icon={<Send size={32} strokeWidth={1.6} color={brand[600]} />}
                  title={`Say hello to ${(name ?? '').split(' ')[0] || 'them'}`}
                  message="Messages are delivered live — no refresh needed on either side."
                />
              </View>
            }
            ListFooterComponent={
              loadingOlder ? (
                <View className="py-3">
                  <ActivityIndicator size="small" color={c.textFaint} />
                </View>
              ) : null
            }
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <View className="items-center py-2">
                  <View
                    style={{ backgroundColor: c.fill, borderRadius: radius.pill }}
                    className="px-3 py-1"
                  >
                    <Text style={{ color: c.textMuted }} className={T.nano}>
                      {item.label}
                    </Text>
                  </View>
                </View>
              ) : (
                <Bubble
                  message={item.message}
                  mine={item.mine}
                  tail={item.tail}
                  onLongPress={() => setActing(item.message)}
                />
              )
            }
          />
        )}

        {/* ── Reply preview ──────────────────────────────────────────────── */}
        {replyTo ? (
          <View
            style={{
              marginHorizontal: space.screen,
              backgroundColor: c.fill,
              borderRadius: radius.well,
              borderLeftWidth: 3,
              borderLeftColor: brand[600],
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
            }}
            className="flex-row items-center gap-2"
          >
            <View className="flex-1">
              <Text style={{ color: brand[600] }} className={T.nano}>
                Replying to
              </Text>
              <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
                {replyTo.content || 'Attachment'}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyTo(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <X size={16} strokeWidth={2.4} color={c.textFaint} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Composer ───────────────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: space.screen,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            backgroundColor: c.card,
            borderTopWidth: dark ? 1 : 0,
            borderTopColor: c.border,
            ...(dark ? shadow.none : shadow.sheet),
          }}
          className="flex-row items-end gap-2"
        >
          <View
            style={{
              flex: 1,
              backgroundColor: c.fill,
              borderRadius: radius.input,
              paddingHorizontal: space.md,
              // Grows with the text, then stops — a composer that can eat the
              // whole screen hides the conversation it belongs to.
              maxHeight: 120,
            }}
            className="justify-center"
          >
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Message"
              placeholderTextColor={c.textFaint}
              multiline
              style={{
                color: c.text,
                fontFamily: 'Outfit_400Regular',
                fontSize: 14.5,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
              }}
              accessibilityLabel="Message"
            />
          </View>

          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
            style={({ pressed }) => ({
              height: 46,
              width: 46,
              borderRadius: 23,
              backgroundColor: brand[600],
              opacity: !draft.trim() || sending ? 0.45 : pressed ? 0.85 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={19} strokeWidth={2.4} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Message actions ──────────────────────────────────────────────── */}
      <BottomSheet
        visible={Boolean(acting)}
        onClose={() => setActing(null)}
        maxHeightRatio={0.45}
      >
        <View style={{ padding: space.screen }}>
          <View className="flex-row items-center justify-between" style={{ gap: space.sm }}>
            {EMOJI.map((e) => (
              <Pressable
                key={e}
                onPress={() => toggleReaction(e)}
                accessibilityRole="button"
                accessibilityLabel={`React ${e}`}
                style={({ pressed }) => ({
                  backgroundColor: c.fill,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
                className="h-12 w-12 items-center justify-center"
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => {
              setReplyTo(acting);
              setActing(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Reply to this message"
            style={({ pressed }) => ({
              marginTop: space.lg,
              backgroundColor: c.fill,
              borderRadius: radius.well,
              opacity: pressed ? 0.7 : 1,
            })}
            className="h-12 flex-row items-center gap-3 px-4"
          >
            <CornerUpLeft size={18} strokeWidth={2.2} color={c.textMuted} />
            <Text style={{ color: c.text }} className={T.cardTitleSm}>
              Reply
            </Text>
          </Pressable>

          <Text
            style={{ color: c.textFaint, marginTop: space.md }}
            className={`text-center ${T.micro}`}
            numberOfLines={2}
          >
            {acting?.content || 'Attachment'}
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}
