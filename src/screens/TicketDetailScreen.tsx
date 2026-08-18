import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { MessageSquare, Send, TriangleAlert } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, personUser } from '../components/Avatar';
import { MaskedText } from '../components/MaskedText';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, EmptyState, Skeleton } from '../components/ui';
import { describeApiError, toastApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { selectCurrentUser, useAppSelector } from '../store';
import {
  useAddTicketCommentMutation,
  useGetTicketCommentsQuery,
  useGetTicketQuery,
  type TicketComment,
  type TicketUserRef,
} from '../store/ticketsApi';
import { radius, shadow, space, surface, toneFor, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDate, fmtDayShort, fmtTime, timeAgo } from '../utils/date';

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/**
 * Same normalisation as the list screen: the backend is a shared ticket system
 * whose status spelling has drifted (`in_progress`, `in-progress`, `In Progress`
 * all sit in old rows), so an unknown value must degrade to a neutral chip
 * rather than crash the header.
 */
const STATUS_TONE: Record<string, { label: string; tone: Surface }> = {
  open: { label: 'Open', tone: surface.info },
  in_progress: { label: 'In progress', tone: surface.warning },
  resolved: { label: 'Resolved', tone: surface.success },
  closed: { label: 'Closed', tone: surface.neutral },
  rejected: { label: 'Rejected', tone: surface.purple },
};

/** Same table as the list screen — the raw enum never reaches a label. */
const PRIORITY_META: Record<string, { label: string; tone: Surface }> = {
  low: { label: 'Low', tone: surface.neutral },
  medium: { label: 'Medium', tone: surface.info },
  high: { label: 'High', tone: surface.warning },
  critical: { label: 'Critical', tone: surface.danger },
};

const statusKey = (raw?: string) =>
  String(raw ?? 'open').toLowerCase().replace(/[\s-]+/g, '_');

/** Terminal states. A closed ticket takes no more comments. */
const SETTLED = new Set(['resolved', 'closed', 'rejected']);

const refOf = (v?: TicketUserRef | string | null): TicketUserRef | null => {
  if (!v || typeof v === 'string') return null;
  return v;
};

const nameOfRef = (v?: TicketUserRef | string | null): string => {
  const u = refOf(v);
  if (!u) return 'Support';
  return (
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Support'
  );
};

/* ── Comment bubble ───────────────────────────────────────────────────────── */

/**
 * One message in the thread.
 *
 * Mine sits right and tinted, theirs sits left on a plain card — the same
 * left/right convention the chat screen uses, so the shape is already learned.
 * Deliberately NOT a flat list of identical rows: the whole reason to open this
 * screen is to see whether somebody answered, and an answer has to look
 * different from your own words at a glance.
 */
function CommentBubble({
  comment,
  mine,
  index,
}: {
  comment: TicketComment;
  mine: boolean;
  index: number;
}) {
  const { c, dark, tint } = useTheme();
  const still = useReducedMotion();
  const author = refOf(comment.user_id);
  const at = comment.createdAt ?? comment.created_at;

  return (
    <Animated.View
      // One orchestrated entry rather than twenty scattered effects: the thread
      // deals itself in from the top, 40ms apart, and stops. Capped at 6 so a
      // long thread does not spend a second and a half assembling itself.
      entering={
        still
          ? undefined
          : FadeInDown.delay(Math.min(index, 6) * 40)
              .duration(220)
              .easing(Easing.out(Easing.cubic))
      }
      className={`flex-row items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
    >
      {!mine ? (
        <Avatar user={personUser({ ...author, name: nameOfRef(comment.user_id) })} size={28} />
      ) : null}

      <View style={{ maxWidth: '82%' }}>
        {!mine ? (
          <Text style={{ color: c.textMuted }} className={`mb-1 ml-1 ${T.micro}`}>
            {nameOfRef(comment.user_id)}
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: mine ? tint.bg : c.card,
            borderRadius: radius.well,
            // The corner nearest the speaker is squared off, so a run of
            // messages from one person reads as one block.
            borderBottomRightRadius: mine ? 6 : radius.well,
            borderBottomLeftRadius: mine ? radius.well : 6,
            borderWidth: 1,
            borderColor: mine ? tint.border : c.border,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 2,
            ...(dark ? shadow.none : shadow.soft),
          }}
        >
          <MaskedText
            value={comment.content}
            style={{ color: c.text }}
            className={`leading-5 ${T.body}`}
          />
        </View>

        <Text
          style={{ color: c.textFaint }}
          className={`mt-1 ${T.nano} ${mine ? 'text-right mr-1' : 'ml-1'}`}
        >
          {at ? `${fmtDayShort(at)} · ${fmtTime(at) ?? ''}`.trim() : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

/* ── Composer ─────────────────────────────────────────────────────────────── */

function Composer({
  value,
  onChangeText,
  onSend,
  sending,
  disabled,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { c, brand } = useTheme();
  const press = useSharedValue(1);

  const canSend = Boolean(value.trim()) && !sending && !disabled;

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <View
      style={{
        paddingHorizontal: space.screen,
        paddingTop: space.md,
        paddingBottom: insets.bottom + space.md,
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
      className="flex-row items-end gap-2.5"
    >
      <View
        style={{
          flex: 1,
          minHeight: 46,
          maxHeight: 120,
          backgroundColor: c.fill,
          borderRadius: radius.input,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
        }}
        className="justify-center"
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={disabled ? 'This ticket is closed' : 'Write a reply…'}
          placeholderTextColor={c.textFaint}
          editable={!disabled}
          multiline
          style={{ color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14.5 }}
          accessibilityLabel="Write a reply"
        />
      </View>

      <Animated.View style={sendStyle}>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          onPressIn={() => {
            press.value = withSpring(0.9, { damping: 18, stiffness: 320 });
          }}
          onPressOut={() => {
            press.value = withSpring(1, { damping: 18, stiffness: 320 });
          }}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={{
            height: 46,
            width: 46,
            borderRadius: radius.pill,
            backgroundColor: brand[600],
            opacity: canSend ? 1 : 0.45,
          }}
          className="items-center justify-center"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={18} strokeWidth={2.4} color="#FFFFFF" />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * One ticket, and the conversation on it.
 *
 * This screen closes a loop that was open: the list could raise a ticket and
 * show its status chip, but `getTicket`, `getTicketComments` and
 * `addTicketComment` were never called anywhere, so an employee could file an
 * issue and had no way to read the reply. Support answered into a void.
 */
export default function TicketDetailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Ticket'>>();
  const { c, brand, dark } = useTheme();
  const still = useReducedMotion();
  const me = useAppSelector(selectCurrentUser);

  const { id, title } = route.params;
  const scroller = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');

  const ticket = useGetTicketQuery(id);
  const comments = useGetTicketCommentsQuery(id);
  const [addComment, { isLoading: sending }] = useAddTicketCommentMutation();

  const key = statusKey(ticket.data?.status);
  const status = STATUS_TONE[key] ?? {
    label: ticket.data?.status || 'Unknown',
    tone: surface.neutral,
  };
  const statusTone = toneFor(status.tone, dark);
  const priority = PRIORITY_META[String(ticket.data?.priority ?? '').toLowerCase()];
  const settled = SETTLED.has(key);
  const raised = ticket.data?.createdAt ?? ticket.data?.created_at;

  /**
   * Comments are filtered for `is_internal`.
   *
   * Support staff write private notes on the same thread. The list endpoint is
   * shared with the agent-facing portal, so those rows arrive here too — and
   * showing an employee an internal note is a data-exposure bug, not a feature.
   */
  const visible = useMemo(
    () => (comments.data ?? []).filter((x) => !x.is_internal),
    [comments.data],
  );

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await addComment({ ticketId: id, content }).unwrap();
      setDraft('');
      // Land on the newest message. A reply that posts off-screen reads as a
      // failed send.
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      toast.error(...toastApiError(e));
    }
  };

  const refreshing =
    (ticket.isFetching && !ticket.isLoading) ||
    (comments.isFetching && !comments.isLoading);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title={ticket.data?.ticket_no || title || 'Ticket'}
        subtitle={raised ? `Raised ${fmtDayShort(raised)}` : undefined}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroller}
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: space.xxl,
            gap: space.md,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                ticket.refetch();
                comments.refetch();
              }}
              tintColor={brand[600]}
            />
          }
        >
          {ticket.isLoading ? (
            <>
              <Skeleton height={150} radius={radius.card} />
              <Skeleton height={70} radius={radius.well} />
              <Skeleton height={70} radius={radius.well} />
            </>
          ) : ticket.error ? (
            <EmptyState
              icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
              title="Could not load this ticket"
              message={describeApiError(ticket.error).title}
              actionLabel="Try again"
              onAction={() => ticket.refetch()}
            />
          ) : (
            <>
              {/* ── The ticket itself ───────────────────────────────────────
                  A left edge in the status colour, so the state is legible
                  from the scroll position rather than only from the chip. */}
              <Animated.View
                entering={
                  still ? undefined : FadeInDown.duration(240).easing(Easing.out(Easing.cubic))
                }
                style={{
                  backgroundColor: c.card,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderLeftWidth: 4,
                  borderLeftColor: statusTone.tint,
                  padding: space.lg,
                  ...(dark ? shadow.none : shadow.card),
                }}
              >
                <Text style={{ color: c.text }} className={T.cardTitle}>
                  {ticket.data?.title || title}
                </Text>

                <View className="mt-2.5 flex-row flex-wrap items-center" style={{ gap: space.sm }}>
                  <Badge label={status.label} tone={status.tone} />
                  {priority ? (
                    <Badge label={`${priority.label} priority`} tone={priority.tone} />
                  ) : null}
                </View>

                {/* When it was raised, in both readings: the age answers "has
                    anyone looked at this yet", the date answers "which one was
                    this again". The header only carried the second. */}
                {raised ? (
                  <Text style={{ color: c.textFaint }} className={`mt-2 ${T.micro}`}>
                    Raised {timeAgo(raised)} · {fmtDate(raised.slice(0, 10))}
                  </Text>
                ) : null}

                {/* Masked: a ticket body is where the account number that did
                    not get credited gets pasted, and this screen is read in
                    the open more than any other. */}
                {ticket.data?.description ? (
                  <MaskedText
                    value={ticket.data.description}
                    style={{ color: c.textMuted }}
                    className={`mt-3 leading-5 ${T.secondary}`}
                  />
                ) : null}

                {refOf(ticket.data?.assigned_to) ? (
                  <View
                    style={{
                      marginTop: space.md,
                      paddingTop: space.md,
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                    }}
                    className="flex-row items-center gap-2"
                  >
                    <Avatar
                      user={personUser({
                        ...refOf(ticket.data?.assigned_to),
                        name: nameOfRef(ticket.data?.assigned_to),
                      })}
                      size={24}
                    />
                    <Text style={{ color: c.textMuted }} className={T.caption}>
                      Handled by {nameOfRef(ticket.data?.assigned_to)}
                    </Text>
                  </View>
                ) : null}
              </Animated.View>

              {/* ── Thread ─────────────────────────────────────────────── */}
              <Text
                style={{ color: c.textMuted, marginTop: space.sm }}
                className={T.label}
              >
                {visible.length > 0
                  ? `${visible.length} ${visible.length === 1 ? 'reply' : 'replies'}`
                  : 'Replies'}
              </Text>

              {comments.isLoading ? (
                <>
                  <Skeleton height={64} radius={radius.well} />
                  <Skeleton height={64} radius={radius.well} />
                </>
              ) : visible.length === 0 ? (
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    paddingVertical: space.xxl,
                    paddingHorizontal: space.lg,
                  }}
                  className="items-center"
                >
                  <MessageSquare size={26} strokeWidth={1.8} color={c.textFaint} />
                  <Text
                    style={{ color: c.text }}
                    className={`mt-2.5 text-center ${T.cardTitleSm}`}
                  >
                    {settled ? 'No replies on this one' : 'Nobody has replied yet'}
                  </Text>
                  <Text
                    style={{ color: c.textMuted }}
                    className={`mt-1 text-center leading-5 ${T.secondary}`}
                  >
                    {settled
                      ? 'This ticket was settled without a written reply.'
                      : 'Support will answer here. Add anything you forgot below.'}
                  </Text>
                </View>
              ) : (
                visible.map((comment, i) => (
                  <CommentBubble
                    key={comment._id}
                    comment={comment}
                    index={i}
                    mine={refOf(comment.user_id)?._id === me?._id}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>

        {!ticket.isLoading && !ticket.error ? (
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={send}
            sending={sending}
            // A settled ticket takes no more comments — an input that posts
            // into a closed thread is a promise the backend will not keep.
            disabled={settled}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
