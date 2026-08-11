import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import type * as ImagePickerTypes from "expo-image-picker";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  CornerUpLeft,
  Image as ImageIcon,
  Plus,
  Send,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, personUser } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { EmptyState, Skeleton } from "../components/ui";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { TYPING_EVENT } from "../hooks/useRealtime";
import { usePresence } from "../hooks/usePresence";
import { describeApiError, toastApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { selectCurrentUser, useAppSelector } from "../store";
import {
  useGetConversationQuery,
  useGetThreadsQuery,
  useLazyGetConversationQuery,
  useMarkConversationReadMutation,
  useReactMessageMutation,
  useSendMessageMutation,
  useUploadAttachmentsMutation,
  type Attachment,
  type ChatUser,
  type Message,
} from "../store/chatApi";
import { getSocket } from "../store/socket";
import { radius, shadow, space, surface, type Scheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import type { Ramp } from "../theme/themes";
import { T } from "../theme/type";
import { fmtDate, fmtTime, parseYmd } from "../utils/date";

/** The reactions offered on long-press. Six fits one row on a 360dp screen. */
const EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "😮"];

/**
 * The multipart field `POST /messages/upload` reads the file from.
 *
 * The chat backend lives outside this workspace, so this name could NOT be
 * verified against it — it is the one thing to change if uploads come back
 * empty or 400. Kept as a constant precisely so that is a one-line fix.
 */
const UPLOAD_FIELD = "files";

/**
 * The picker is a NATIVE module, loaded only when someone actually attaches
 * something. A top-level import would make the whole screen fail to load on a
 * dev build that predates the dependency — the chat itself does not need it.
 */
function imagePicker(): typeof ImagePickerTypes {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-image-picker") as typeof ImagePickerTypes;
}

const idOf = (v: unknown): string =>
  typeof v === "string" ? v : String((v as { _id?: string } | null)?._id ?? "");

/** `YYYY-MM-DD` of an ISO timestamp, in LOCAL time. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** `Today` / `Yesterday` / `26 Jul 2026`. */
function dayLabel(key: string): string {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  if (key === t) return "Today";
  const y = new Date(today.getTime() - 86400000);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(
    y.getDate(),
  ).padStart(2, "0")}`;
  if (key === yk) return "Yesterday";
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
  | { kind: "day"; key: string; label: string }
  | {
      kind: "msg";
      key: string;
      message: Message;
      mine: boolean;
      /** First of a run — the one that carries the tail and the space above. */
      first: boolean;
    };

/* ── Bubble colours ───────────────────────────────────────────────────────
   The two-tone contract every messenger is read with: YOUR side is a tinted
   card, THEIRS is the plain surface, and both sit on a canvas darker than
   either — so a bubble always reads as an object ON something, never as a
   panel the same colour as the page. The tint is the brand ramp, not a
   borrowed green: on the default theme `brand[100]` already lands where a
   chat app's own-message tint lives. */
function bubbleColors(mine: boolean, dark: boolean, brand: Ramp, c: Scheme) {
  if (!mine) {
    return { bg: c.card, ink: c.text, faint: c.textFaint };
  }
  return dark
    ? { bg: brand[800], ink: "#FFFFFF", faint: "rgba(255,255,255,0.62)" }
    : { bg: brand[100], ink: c.text, faint: "rgba(15,23,42,0.45)" };
}

/* ── Bubble ───────────────────────────────────────────────────────────────── */

function Bubble({
  message,
  mine,
  quoteName,
  onLongPress,
}: {
  message: Message;
  mine: boolean;
  /** Who wrote the quoted message, when this one is a reply. */
  quoteName?: string;
  onLongPress: () => void;
}) {
  const { c, brand, dark } = useTheme();

  const { bg, ink, faint } = bubbleColors(mine, dark, brand, c);

  const reply =
    message.reply_to && typeof message.reply_to !== "string"
      ? message.reply_to
      : null;
  const images = (message.attachments ?? []).filter((a) =>
    (a.type ?? "").startsWith("image"),
  );
  const files = (message.attachments ?? []).filter(
    (a) => !(a.type ?? "").startsWith("image"),
  );

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityLabel={`${mine ? "You" : "They"} said: ${message.content || "attachment"}`}
      accessibilityHint="Long press to react or reply"
      // A PLAIN style object, never `({ pressed }) => …`. Under NativeWind
      // 4.2 on RN 0.86 a function style handed to Pressable is dropped
      // entirely — the bubble rendered as bare text on the canvas, with no
      // fill, no padding and no radius. Anything visual has to be static;
      // press feedback comes from the ripple instead.
      style={{
        flexShrink: 1,
        // Uniform corners, no tail. The flare was doing work that side and
        // fill already do, and it cost a joint that Android renders a seam
        // through (the bubble carries elevation, a sibling triangle cannot).
        borderRadius: radius.card,
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 8,
        overflow: "hidden",
        ...(dark ? shadow.none : shadow.soft),
      }}
      android_ripple={{
        color: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
      }}
    >
      {/* Quoted message — dimmed, one line. The point is which message, not
          re-reading it. */}
      {reply ? (
        <View
          style={{
            backgroundColor: dark
              ? "rgba(255,255,255,0.10)"
              : "rgba(15,23,42,0.05)",
            borderLeftWidth: 3,
            borderLeftColor: brand[600],
            borderRadius: radius.card,
            paddingHorizontal: space.sm,
            paddingVertical: 6,
            marginBottom: 5,
          }}
        >
          {/* Who you are answering, then what they said — a quote without a
              name only tells you half of what a reply is for. */}
          <Text
            style={{ color: brand[dark ? 400 : 700], fontSize: 12 }}
            className="font-ui-semibold"
            numberOfLines={1}
          >
            {quoteName ?? "Message"}
          </Text>
          <Text
            style={{ color: faint, fontSize: 12.5 }}
            className="font-ui-regular"
            numberOfLines={1}
          >
            {reply.content || "Attachment"}
          </Text>
        </View>
      ) : null}

      {/* A photo fills the bubble edge to edge — an image inset by the text
          padding looks like a thumbnail someone forgot to size. */}
      {images.map((a) => (
        <Image
          key={a.url}
          source={{ uri: a.url }}
          style={{
            width: 232,
            height: 168,
            borderRadius: radius.card,
            marginTop: -2,
            marginHorizontal: -4,
            marginBottom: message.content ? 6 : 2,
            backgroundColor: dark
              ? "rgba(255,255,255,0.06)"
              : "rgba(15,23,42,0.05)",
          }}
          resizeMode="cover"
          accessibilityLabel={a.name ?? "Image attachment"}
        />
      ))}

      {files.map((a) => (
        <Text
          key={a.url}
          style={{ color: ink }}
          className={`${T.secondary} underline`}
        >
          {a.name ?? "Attachment"}
        </Text>
      ))}

      {/* Text and meta share one wrapping row: a short message keeps the stamp
          on the same line, a long one lets it fall to the right of the last
          line. Every message carries its own time — hunting up the thread for
          the last one is what made the old grouping unreadable. */}
      <View className="flex-row flex-wrap items-end">
        {message.content ? (
          <Text
            style={{ color: ink, fontSize: 15, lineHeight: 20, flexShrink: 1 }}
            className="font-ui-regular"
          >
            {message.content}
          </Text>
        ) : null}

        <View
          className="flex-row items-center"
          style={{ marginLeft: "auto", paddingLeft: 8, gap: 3 }}
        >
          <Text
            style={{ color: faint, fontSize: 10.5 }}
            className="font-ui-regular"
            allowFontScaling={false}
          >
            {fmtTime(message.createdAt)}
          </Text>
          {/* Faint single tick = sent, brand double = read. Shape AND colour
              both change, so the state survives a colour-blind reading. */}
          {mine ? (
            message.is_read ? (
              <CheckCheck
                size={15}
                strokeWidth={2.8}
                color={dark ? brand[300] : brand[600]}
              />
            ) : (
              <Check size={15} strokeWidth={2.8} color={faint} />
            )
          ) : null}
        </View>
      </View>

      {/* Reactions ride the bottom of the bubble — a separate row under it made
          every reacted message two rows tall. */}
      {message.reactions && message.reactions.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap" style={{ gap: 4 }}>
          {message.reactions.map((r) => (
            <View
              key={`${r.user_id}-${r.emoji}`}
              style={{
                backgroundColor: dark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(15,23,42,0.06)",
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
    </Pressable>
  );
}

/* ── Typing indicator ─────────────────────────────────────────────────────── */

function TypingDot({ index }: { index: number }) {
  const { c } = useTheme();
  const v = useSharedValue(0.3);

  useEffect(() => {
    // Staggered so the three dots read as a wave, not a blink.
    v.value = withDelay(
      index * 160,
      withRepeat(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [index, v]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: -2 * v.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: c.textMuted },
        style,
      ]}
    />
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
  const route = useRoute<RouteProp<RootStackParamList, "Chat">>();
  const insets = useSafeAreaInsets();
  const { c, brand, primary, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);
  const partnerTyping = useAppSelector(
    (s) => !!s.presence.typing[String(route.params.userId)],
  );
  const { isUserOnline } = usePresence();

  const { userId, name, photo, designation, department } = route.params;

  /**
   * Who this person is, from whichever source actually knows.
   *
   * The route params are filled in by whoever pushed this screen — and they
   * only carry what THAT screen had. A thread opened from the chat list has a
   * partner whose `department_id` may have arrived unpopulated (a bare id, not
   * an object), so the header said "Offline" and nothing else about a colleague
   * you may not recognise by name.
   *
   * The thread list is already cached from the Chats screen, so reading the
   * partner back out of it costs nothing and fills the gap. Params still win
   * where they have an answer: they came from the row that was actually tapped.
   */
  const threads = useGetThreadsQuery();
  const partnerRecord: ChatUser | undefined = threads.data?.find(
    (t) => String(t._id) === String(userId),
  )?.partner;

  const partnerDept = ((): string | undefined => {
    const d = partnerRecord?.department_id;
    if (!d || typeof d === "string") return undefined;
    return d.department_name?.trim() || undefined;
  })();

  const role = designation?.trim() || partnerRecord?.designation?.trim();
  const dept = department?.trim() || partnerDept;

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  /** The message whose action sheet is open. */
  const [acting, setActing] = useState<Message | null>(null);
  /** Staged photo — chosen but NOT sent. Nothing uploads until Send. */
  const [pending, setPending] =
    useState<ImagePickerTypes.ImagePickerAsset | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** The "+" attachment sheet. */
  const [attachOpen, setAttachOpen] = useState(false);

  const { data, isLoading, error } = useGetConversationQuery({ userId });
  const [fetchOlder] = useLazyGetConversationQuery();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [uploadAttachments, { isLoading: uploading }] =
    useUploadAttachmentsMutation();
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

  /* ── Typing relay ─────────────────────────────────────────────────────
     Only the OUTGOING half lives here. Incoming typing is subscribed once,
     app-wide, in `useRealtime` — a listener attached on this screen's mount
     missed every relay that arrived before the socket had connected, which is
     why the indicator never appeared. */
  const lastSent = useRef(0);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** `{ to, typing }` is the shape the relay reads; anything else is dropped. */
  const emitTyping = useCallback(
    (typing: boolean) => {
      getSocket()?.emit(TYPING_EVENT, { to: userId, typing });
    },
    [userId],
  );

  // Leaving the screen must retract the relay, or the other side is left
  // watching three dots from someone who has closed the chat.
  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      emitTyping(false);
    },
    [emitTyping],
  );

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);

      // Pausing is its own signal: 1.5s after the last keystroke the relay is
      // retracted, so the dots clear when someone stops rather than lingering
      // until the receiver's own timeout gives up on them.
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => emitTyping(false), 1500);

      // Throttled to one emit a second — a socket write per keystroke is a lot
      // of traffic to say something the receiver already knows.
      const now = Date.now();
      if (now - lastSent.current < 1000) return;
      lastSent.current = now;
      emitTyping(true);
    },
    [userId, emitTyping],
  );

  /* ── Rows ───────────────────────────────────────────────────────────────
     Built newest-first because the list is inverted. `first` marks the OPENING
     message of a same-sender run — the one that gets the tail and the gap that
     separates one turn from the next. */
  const rows = useMemo(() => {
    const out: Row[] = [];
    const myId = String(me?._id ?? "");

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const m = items[i];
      const mine = idOf(m.sender_id) === myId;
      const prevMsg = items[i - 1];
      // "First of a run" is decided against the message BEFORE it in time —
      // the list is built backwards, but the grouping is not.
      const first =
        !prevMsg ||
        idOf(prevMsg.sender_id) !== idOf(m.sender_id) ||
        dayKey(prevMsg.createdAt) !== dayKey(m.createdAt);

      out.push({ kind: "msg", key: m._id, message: m, mine, first });

      const prev = items[i - 1];
      const key = dayKey(m.createdAt);
      if (!prev || dayKey(prev.createdAt) !== key) {
        out.push({
          kind: "day",
          key: `day-${key}-${m._id}`,
          label: dayLabel(key),
        });
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

  /**
   * Send whatever the composer is holding: text, a staged photo, or both.
   *
   * Picking a photo does NOT send it — it stages a preview, and nothing leaves
   * the phone until this runs. Uploading on pick meant a mis-tap in the gallery
   * was already in the other person's thread, and there was nowhere to write a
   * caption. The upload happens here, first, so the message itself carries URLs
   * rather than bytes and a failed upload never leaves half a message behind.
   */
  const send = async () => {
    const content = draft.trim();
    const asset = pending;
    if ((!content && !asset) || sending || uploading) return;

    const reply = replyTo?._id;
    setDraft("");
    setReplyTo(null);
    setPending(null);

    try {
      let attachments: Attachment[] | undefined;

      if (asset) {
        const form = new FormData();
        form.append(UPLOAD_FIELD, {
          uri: asset.uri,
          name: asset.fileName ?? `photo-${asset.assetId ?? "upload"}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
          // RN's FormData takes this shape for a file; the DOM typings do not
          // describe it, hence the cast.
        } as unknown as Blob);

        attachments = await uploadAttachments(form).unwrap();
        if (!attachments.length) throw new Error("upload returned nothing");
      }

      await sendMessage({
        receiver_id: userId,
        content: content || undefined,
        attachments,
        reply_to: reply,
      }).unwrap();

      emitTyping(false);
    } catch (e) {
      // Put it ALL back — losing what someone typed, or the photo they chose,
      // is the worst possible failure mode for a composer.
      setDraft(content);
      setPending(asset);
      toast.error(...toastApiError(e));
    }
  };

  const pickFrom = async (source: "library" | "camera") => {
    setAttachOpen(false);
    try {
      const picker = imagePicker();
      const permission =
        source === "camera"
          ? await picker.requestCameraPermissionsAsync()
          : await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error(
          source === "camera"
            ? "Camera permission is needed to take a photo."
            : "Photo permission is needed to attach an image.",
        );
        return;
      }

      const options: ImagePickerTypes.ImagePickerOptions = {
        mediaTypes: ["images"],
        // Re-encoded at 0.7 — a 12MP phone photo is ~5MB of upload for a
        // 200px bubble, and the thread is read on mobile data.
        quality: 0.7,
      };
      const result =
        source === "camera"
          ? await picker.launchCameraAsync(options)
          : await picker.launchImageLibraryAsync(options);

      // Staged, not sent. The composer shows it and waits.
      const asset = result.canceled ? null : result.assets?.[0];
      if (asset) setPending(asset);
    } catch {
      // A dev build made before this dependency has no native picker — say so
      // instead of surfacing a "cannot find native module" stack.
      toast.error("Photo picker needs a fresh build of the app.");
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!acting) return;
    const message_id = acting._id;
    setActing(null);
    try {
      await react({ message_id, emoji, partner_id: userId }).unwrap();
    } catch (e) {
      toast.error(...toastApiError(e));
    }
  };

  const partner = personUser({ _id: userId, name, profile_image: photo });
  const firstName = (name ?? "").trim().split(" ")[0] || "They";
  const myId = String(me?._id ?? "");

  /** Who wrote the message a reply quotes — "You", or the partner's name. */
  const quoteNameOf = (m: Message): string | undefined => {
    const r = m.reply_to;
    if (!r || typeof r === "string") return undefined;
    return idOf(r.sender_id) === myId ? "You" : name || "Them";
  };

  /* ── Chat surfaces ──────────────────────────────────────────────────────
     The message area gets its OWN canvas: the faintest step of the brand ramp,
     not the app's grey page. White (theirs) and `brand[100]` (yours) both read
     as objects sitting ON it, and the whole screen stays in one hue instead of
     putting green bubbles on a slate background. */
  const canvas = dark ? c.bg : brand[50];
  const dayChip = dark ? c.fill : c.card;
  const theirBubble = bubbleColors(false, dark, brand, c).bg;

  /* ── Keyboard ───────────────────────────────────────────────────────────
     Android is edge-to-edge from SDK 53 on, which kills `adjustResize` — the
     window does not shrink for the IME, so nothing moves the composer off the
     keyboard unless we do it.

     The lift is the composer's own bottom PADDING rather than a margin on the
     screen: the card then keeps filling the space behind the keyboard (which
     the keyboard covers anyway) instead of leaving a strip of page colour
     under it, and the message list shrinks by exactly the same amount because
     both live in one flex column. Closed, that padding is just the safe-area
     inset — which is why it is a max(), not a sum. */
  const { height: kbHeight, duration: kbDuration } = useKeyboardHeight();
  const composerPad = useSharedValue(insets.bottom + space.sm + 2);

  useEffect(() => {
    composerPad.value = withTiming(
      Math.max(kbHeight, insets.bottom) + space.sm + 2,
      { duration: kbDuration, easing: Easing.out(Easing.quad) },
    );
  }, [kbHeight, kbDuration, insets.bottom, composerPad]);

  const composerPadStyle = useAnimatedStyle(() => ({
    paddingBottom: composerPad.value,
  }));

  const canSend = Boolean(draft.trim() || pending) && !sending && !uploading;

  return (
    <View style={{ backgroundColor: canvas }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          ...(dark ? shadow.none : shadow.soft),
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

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className={T.cardTitle}
            numberOfLines={1}
          >
            {name || "Chat"}
          </Text>

          {/* Presence is the volatile line and gets the accent when it changes;
              who they are is the stable one and sits under it. They used to
              share a line, so a colleague going online replaced their job title
              — the two facts were competing for one row. */}
          <Text
            style={{ color: partnerTyping ? brand[600] : c.textMuted }}
            className={T.micro}
            numberOfLines={1}
          >
            {partnerTyping ? "typing…" : online ? "Online" : "Offline"}
          </Text>

          {/* Designation AND department: "Dolly Khan · Offline" says nothing
              about who you are messaging in a company where two people share a
              first name. Rendered only when the route actually carried them —
              an empty line is worse than a shorter header. */}
          {role || dept ? (
            <Text
              style={{ color: c.textFaint }}
              className={T.nano}
              numberOfLines={1}
            >
              {[role, dept].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-1">
        {/* ── Messages ───────────────────────────────────────────────────── */}
        {isLoading ? (
          /* The placeholder is bubble-shaped and alternates sides — a skeleton
             that does not predict the layout is just a grey flash. */
          <View style={{ padding: space.lg, gap: 10 }}>
            <Skeleton height={40} width="58%" radius={4} />
            <Skeleton
              height={40}
              width="46%"
              radius={4}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton height={62} width="72%" radius={4} />
            <Skeleton
              height={40}
              width="38%"
              radius={4}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton height={40} width="58%" radius={4} />
            <Skeleton
              height={40}
              width="46%"
              radius={4}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton height={62} width="72%" radius={4} />
            <Skeleton
              height={40}
              width="38%"
              radius={4}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton height={40} width="58%" radius={4} />
            <Skeleton
              height={40}
              width="46%"
              radius={4}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton height={62} width="72%" radius={4} />
          </View>
        ) : error ? (
          <EmptyState
            icon={<Send size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load this chat"
            message={describeApiError(error).title}
          />
        ) : rows.length === 0 ? (
          /* Outside the list, not `ListEmptyComponent`: an inverted FlatList
             turns its whole content 180°, and the counter-rotation that is
             supposed to undo that left the copy mirrored on screen. Nothing
             here needs to scroll, so nothing here needs to be in the list. */
          <View className="flex-1 justify-center">
            <EmptyState
              icon={<Send size={32} strokeWidth={1.6} color={brand[600]} />}
              title={`Say hello to ${firstName}`}
              message="Messages are delivered live — no refresh needed on either side."
            />
          </View>
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            contentContainerStyle={{
              paddingHorizontal: space.lg,
              paddingTop: space.sm,
              paddingBottom: space.lg,
              // A short thread starts at the TOP.
              //
              // The list is `inverted` — it is drawn upside down so that new
              // messages arrive at the bottom without any scrolling maths. The
              // side effect is that a thread with three messages in it hangs
              // off the bottom of the screen with half a page of empty canvas
              // above it, which reads as a loading state that never finished.
              //
              // Inside a flipped container `flex-end` IS the visual top, so
              // this pins short content up there and leaves the empty space
              // below it. Once the thread is longer than the viewport,
              // `flexGrow` has nothing left to grow into and the list behaves
              // exactly as before.
              flexGrow: 1,
              justifyContent: "flex-end",
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingOlder ? (
                <View className="py-3">
                  <ActivityIndicator size="small" color={c.textFaint} />
                </View>
              ) : null
            }
            renderItem={({ item }) =>
              item.kind === "day" ? (
                <View className="items-center py-3">
                  <View
                    style={{
                      backgroundColor: dayChip,
                      borderRadius: radius.pill,
                      ...(dark ? shadow.none : shadow.soft),
                    }}
                    className="px-3 py-1"
                  >
                    <Text
                      style={{ color: c.textMuted, fontSize: 11 }}
                      className="font-ui-semibold"
                    >
                      {item.label}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Ownership is side + fill, and nothing else: a 1:1 thread has
                   no room for an avatar on every row — who the other person is
                   is written once, in the header. */
                <View
                  style={{
                    paddingTop: item.first ? 10 : 2,
                    flexDirection: "row",
                    justifyContent: item.mine ? "flex-end" : "flex-start",
                    // A bubble stops well short of the far edge, so which side
                    // it hangs off is readable without measuring.
                    paddingLeft: item.mine ? "16%" : 0,
                    paddingRight: item.mine ? 0 : "16%",
                  }}
                >
                  <Bubble
                    message={item.message}
                    mine={item.mine}
                    quoteName={quoteNameOf(item.message)}
                    onLongPress={() => setActing(item.message)}
                  />
                </View>
              )
            }
          />
        )}

        {/* ── Typing ─────────────────────────────────────────────────────
            A bubble where their next message will appear, not just a word in
            the header — it belongs to the conversation, so it lives here. */}
        {partnerTyping ? (
          <View
            style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}
            className="flex-row items-start"
          >
            <View
              style={{
                backgroundColor: theirBubble,
                borderRadius: radius.card,
                paddingHorizontal: 12,
                paddingVertical: 8,
                ...(dark ? shadow.none : shadow.soft),
              }}
              className="flex-row items-center gap-1.5"
              accessibilityLabel={`${firstName} is typing`}
            >
              <TypingDot index={0} />
              <TypingDot index={1} />
              <TypingDot index={2} />
              <Text
                style={{ color: c.textMuted, fontSize: 12, marginLeft: 4 }}
                className="font-ui-regular"
              >
                {firstName} is typing…
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Composer ─────────────────────────────────────────────────────
            One surface holding the reply preview AND the input: a reply that
            floats on its own reads as part of the conversation instead of
            part of what you are about to send. */}
        <Animated.View
          style={[
            {
              paddingHorizontal: space.md,
              paddingTop: space.md,
              // A bar, matching the header at the other end of the screen.
              //
              // It used to be a white pill floating on the tinted canvas, which
              // left a strip of green between the pill and the screen edge and
              // made the bottom of the app read as unfinished next to the solid
              // header. Chrome at both ends now: same fill, same hairline, same
              // soft lift — the conversation is the only thing on the canvas.
              backgroundColor: c.card,
              borderTopWidth: 1,
              borderTopColor: c.border,
              ...(dark ? shadow.none : shadow.soft),
            },
            composerPadStyle,
          ]}
        >
          {/* ── Staged photo ────────────────────────────────────────────
              Picked, not sent. It waits here — with room to write a caption —
              until Send, so a mis-tap in the gallery is one X away instead of
              already sitting in someone else's thread. */}
          {pending ? (
            <View
              style={{
                marginBottom: space.xs + 2,
                backgroundColor: c.fill,
                borderRadius: radius.well,
                padding: space.sm,
              }}
              className="flex-row items-center gap-3"
            >
              <Image
                source={{ uri: pending.uri }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.well,
                  backgroundColor: c.fill,
                }}
                resizeMode="cover"
                accessibilityLabel="Photo to send"
              />
              <View className="flex-1">
                <Text style={{ color: c.text }} className={T.cardTitleSm}>
                  {uploading ? "Sending photo…" : "Photo ready"}
                </Text>
                <Text
                  style={{ color: c.textMuted }}
                  className={T.micro}
                  numberOfLines={1}
                >
                  {uploading
                    ? "Uploading, hang on."
                    : "Add a caption, or just send it."}
                </Text>
              </View>
              {uploading ? (
                <ActivityIndicator size="small" color={brand[600]} />
              ) : (
                <Pressable
                  onPress={() => setPending(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <X size={18} strokeWidth={2.4} color={c.textFaint} />
                </Pressable>
              )}
            </View>
          ) : null}

          {/* The reply preview is the same surface as the pill below it and sits
              flush on top — one composer, two rows, not a floating card. */}
          {replyTo ? (
            <View
              style={{
                marginBottom: space.xs + 2,
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
                <Text
                  style={{ color: c.textMuted }}
                  className={T.micro}
                  numberOfLines={1}
                >
                  {replyTo.content || "Attachment"}
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

          <View className="flex-row items-end gap-2">
            {/* One white pill holds everything you can do to a message —
                attach, type, snap — and only SENDING lives outside it, as its
                own brand disc. That split is what makes the primary action
                findable without reading a single icon. */}
            <View
              style={{
                flex: 1,
                // Recessed against the bar, not raised off the canvas. On a
                // white bar a white pill with a soft shadow is a shape you can
                // only see by its shadow; `fill` + a hairline is the same field
                // treatment every other form in the app uses.
                backgroundColor: c.fill,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.card,
                paddingLeft: 5,
                paddingRight: space.md,
                minHeight: 48,
                // Grows with the text, then stops — a composer that can eat the
                // whole screen hides the conversation it belongs to.
                maxHeight: 132,
              }}
              className="flex-row items-center gap-2"
            >
              <Pressable
                onPress={() => setAttachOpen(true)}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Attach a photo"
                style={{
                  height: 38,
                  width: 38,
                  borderRadius: 19,
                  backgroundColor: dark ? brand[800] : primary.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
                android_ripple={{ color: brand[200], borderless: false }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={brand[600]} />
                ) : (
                  <Plus
                    size={20}
                    strokeWidth={2.6}
                    color={dark ? brand[300] : brand[600]}
                  />
                )}
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder="Type a message…"
                placeholderTextColor={c.textFaint}
                multiline
                style={{
                  flex: 1,
                  color: c.text,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 15,
                  lineHeight: 20,
                  paddingTop: Platform.OS === "ios" ? 12 : 9,
                  paddingBottom: Platform.OS === "ios" ? 12 : 9,
                }}
                accessibilityLabel="Message"
              />

              <Pressable
                onPress={() => pickFrom("camera")}
                disabled={uploading}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Camera size={21} strokeWidth={2} color={c.textFaint} />
              </Pressable>
            </View>

            {/* Always the brand disc, never a grey ghost: an empty draft dims
                it, it does not disguise it as part of the background. */}
            <Pressable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              style={{
                height: 48,
                width: 48,
                borderRadius: 24,
                backgroundColor: brand[600],
                opacity: canSend ? 1 : 0.45,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                ...(dark ? shadow.none : shadow.soft),
              }}
              android_ripple={{ color: "rgba(255,255,255,0.28)" }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={20} strokeWidth={2.4} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>

      {/* ── Message actions ──────────────────────────────────────────────── */}
      <BottomSheet
        visible={Boolean(acting)}
        onClose={() => setActing(null)}
        maxHeightRatio={0.45}
      >
        <View style={{ padding: space.screen }}>
          <View
            className="flex-row items-center justify-between"
            style={{ gap: space.sm }}
          >
            {EMOJI.map((e) => (
              <Pressable
                key={e}
                onPress={() => toggleReaction(e)}
                accessibilityRole="button"
                accessibilityLabel={`React ${e}`}
                style={{
                  backgroundColor: c.fill,
                  borderRadius: radius.pill,
                  overflow: "hidden",
                }}
                android_ripple={{ color: brand[200] }}
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
            style={{
              marginTop: space.lg,
              backgroundColor: c.fill,
              borderRadius: radius.well,
              overflow: "hidden",
            }}
            android_ripple={{ color: brand[200] }}
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
            {acting?.content || "Attachment"}
          </Text>
        </View>
      </BottomSheet>

      {/* ── Attach ───────────────────────────────────────────────────────
          Two doors to the same thing, which is what "+" means everywhere. */}
      <BottomSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        maxHeightRatio={0.4}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text
            style={{ color: c.text, marginBottom: space.xs }}
            className={T.section}
          >
            Send a photo
          </Text>

          {[
            {
              key: "library" as const,
              icon: ImageIcon,
              title: "Photo library",
              hint: "Pick an image already on this phone",
            },
            {
              key: "camera" as const,
              icon: Camera,
              title: "Camera",
              hint: "Take a new photo and send it",
            },
          ].map(({ key, icon: Icon, title, hint }) => (
            <Pressable
              key={key}
              onPress={() => pickFrom(key)}
              accessibilityRole="button"
              accessibilityLabel={title}
              style={{
                backgroundColor: c.fill,
                borderRadius: radius.well,
                paddingHorizontal: space.md,
                paddingVertical: space.md,
                overflow: "hidden",
              }}
              android_ripple={{ color: brand[200] }}
              className="flex-row items-center gap-3"
            >
              <View
                style={{
                  height: 42,
                  width: 42,
                  borderRadius: radius.pill,
                  backgroundColor: dark ? brand[800] : brand[50],
                }}
                className="items-center justify-center"
              >
                <Icon
                  size={20}
                  strokeWidth={2.2}
                  color={dark ? brand[300] : brand[600]}
                />
              </View>
              <View className="flex-1">
                <Text style={{ color: c.text }} className={T.cardTitleSm}>
                  {title}
                </Text>
                <Text style={{ color: c.textMuted }} className={T.micro}>
                  {hint}
                </Text>
              </View>
            </Pressable>
          ))}

          {/* Whatever is typed goes with the photo — the same contract as the
              caption field every messenger has trained people on. */}
          {draft.trim() ? (
            <Text
              style={{ color: c.textFaint, marginTop: space.xs }}
              className={`text-center ${T.micro}`}
              numberOfLines={1}
            >
              Sends with your caption: “{draft.trim()}”
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}
