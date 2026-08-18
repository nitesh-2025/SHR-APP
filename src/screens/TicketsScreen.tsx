import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  Hash,
  LifeBuoy,
  Plus,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, personUser } from "../components/Avatar";
import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { MaskedText } from "../components/MaskedText";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, Button, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useMenuNav } from "../navigation/useMenuNav";
import { useAppSelector, selectCurrentUser } from "../store";
import {
  useCreateTicketMutation,
  useGetTicketsQuery,
  type TicketItem,
  type TicketUserRef,
} from "../store/ticketsApi";
import { radius, shadow, space, surface, toneFor, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { timeAgo } from "../utils/date";

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/**
 * The backend is a shared ticket system and its status vocabulary has drifted
 * over the years (`in_progress`, `in-progress`, `In Progress` all exist in old
 * rows). Normalising to a key here means one unknown value shows up as a plain
 * neutral chip instead of crashing the row.
 */
const STATUS_TONE: Record<string, { label: string; tone: Surface }> = {
  open: { label: "Open", tone: surface.info },
  in_progress: { label: "In progress", tone: surface.warning },
  resolved: { label: "Resolved", tone: surface.success },
  closed: { label: "Closed", tone: surface.neutral },
  rejected: { label: "Rejected", tone: surface.purple },
};

/**
 * Priority carries a LABEL now, not just a colour.
 *
 * The row used to print the raw enum straight from the wire — "medium
 * priority", lower-case, mid-sentence — which is the single loudest tell that a
 * screen is rendering a database column rather than saying something. The value
 * is also the row's left edge, so a queue can be scanned for what is on fire
 * without reading a word of it.
 */
const PRIORITY_META: Record<string, { label: string; tone: Surface }> = {
  low: { label: "Low", tone: surface.neutral },
  medium: { label: "Medium", tone: surface.info },
  high: { label: "High", tone: surface.warning },
  critical: { label: "Critical", tone: surface.danger },
};

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const PRIORITY_LABEL: Record<(typeof PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** `{ first_name, last_name }` → a name, or null when the ref is just an id. */
const nameOfRef = (v?: TicketUserRef | string | null): string | null => {
  if (!v || typeof v === "string") return null;
  return [v.first_name, v.last_name].filter(Boolean).join(" ").trim() || v.email || null;
};

const statusKey = (raw?: string) =>
  String(raw ?? "open").toLowerCase().replace(/[\s-]+/g, "_");

/**
 * "All" is first and is the safe fallback for a reason.
 *
 * Each chip sends ONE canonical spelling to the server, but the backend is
 * shared and its history is not canonical — `statusKey` above exists precisely
 * because `in_progress`, `in-progress` and `In Progress` all sit in old rows.
 * A ticket stored under a variant renders fine under All and then vanishes
 * under its own chip. That is a backend normalisation job, not something the
 * client can fix without pulling the whole queue down and filtering locally,
 * so the empty state on a filtered view says "try another status" rather than
 * claiming nothing exists.
 *
 * Rejected is listed: it is a terminal state a person actively looks for, and
 * without a chip it was reachable only by scrolling All.
 */
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "rejected", label: "Rejected" },
  { key: "closed", label: "Closed" },
];

/* ── Row ──────────────────────────────────────────────────────────────────── */

/**
 * One ticket in the queue.
 *
 * The old row stacked four left-aligned blocks of the same weight — title,
 * meta, description, a lone priority chip on its own line — so nothing led and
 * the card was tall for what it said. It reads as a record now: the identity
 * line on top, the sentence in the middle, and the people-and-priority footer
 * under a rule, with the priority also carried by the left edge so a queue can
 * be skimmed vertically.
 *
 * The description runs through `MaskedText`. Ticket bodies are where people
 * paste the account number that did not get credited and the mobile the OTP
 * never reached, and this list is the most over-the-shoulder-readable surface
 * in the app.
 */
function TicketRow({ ticket, onPress }: { ticket: TicketItem; onPress: () => void }) {
  const { c, dark } = useTheme();

  const key = statusKey(ticket.status);
  const status = STATUS_TONE[key] ?? {
    label: ticket.status || "Unknown",
    tone: surface.neutral,
  };
  const priority = PRIORITY_META[String(ticket.priority).toLowerCase()];
  const raised = ticket.createdAt ?? ticket.created_at;
  const handler = nameOfRef(ticket.assigned_to);
  const rail = toneFor(priority?.tone ?? surface.neutral, dark);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        ticket.ticket_no,
        ticket.title,
        status.label,
        priority ? `${priority.label} priority` : null,
        raised ? `raised ${timeAgo(raised)}` : null,
      ]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint="Opens the ticket and its replies"
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        borderLeftWidth: 3,
        borderLeftColor: rail.tint,
        padding: space.lg,
        opacity: pressed ? 0.85 : 1,
        ...(dark ? shadow.none : shadow.soft),
      })}
    >
      {/* ── Identity line ─────────────────────────────────────────────────
          Ticket number and age, in the faintest ink on the card. Both are
          reference facts — you use them to talk about the ticket, never to
          decide which one to open — so they sit above the title at a size that
          stays out of its way. */}
      <View className="flex-row items-center gap-2">
        {ticket.ticket_no ? (
          <View className="flex-row items-center gap-0.5">
            <Hash size={11} strokeWidth={2.6} color={c.textFaint} />
            <Text
              style={{ color: c.textFaint }}
              className={T.count}
              allowFontScaling={false}
            >
              {ticket.ticket_no.replace(/^#/, "")}
            </Text>
          </View>
        ) : null}

        {ticket.ticket_no && raised ? (
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 2,
              backgroundColor: c.textFaint,
            }}
          />
        ) : null}

        {raised ? (
          <Text style={{ color: c.textFaint }} className={T.count}>
            {timeAgo(raised)}
          </Text>
        ) : null}

        <View className="flex-1" />
        <Badge label={status.label} tone={status.tone} />
      </View>

      <Text
        style={{ color: c.text }}
        className={`mt-1.5 ${T.cardTitle}`}
        numberOfLines={2}
      >
        {ticket.title}
      </Text>

      {ticket.description ? (
        <MaskedText
          value={ticket.description}
          style={{ color: c.textMuted }}
          className={`mt-1.5 leading-5 ${T.secondary}`}
          numberOfLines={2}
        />
      ) : null}

      {/* ── Footer ────────────────────────────────────────────────────────
          Priority and who has it. Under a rule rather than floating in the
          card's whitespace, so the row has a bottom edge to end on instead of
          trailing off. */}
      {priority || handler ? (
        <>
          <View
            style={{ backgroundColor: c.border }}
            className="mt-3 h-px"
          />
          <View className="mt-2.5 flex-row items-center gap-2">
            {priority ? (
              <View className="flex-row items-center gap-1.5">
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: priority.tone.tint,
                  }}
                />
                <Text style={{ color: c.textMuted }} className={T.micro}>
                  {priority.label} priority
                </Text>
              </View>
            ) : null}

            <View className="flex-1" />

            {handler ? (
              <View className="flex-row items-center gap-1.5">
                <Avatar
                  user={personUser({
                    ...(typeof ticket.assigned_to === "object"
                      ? ticket.assigned_to
                      : {}),
                    name: handler,
                  })}
                  size={18}
                />
                <Text
                  style={{ color: c.textMuted }}
                  className={T.micro}
                  numberOfLines={1}
                >
                  {handler}
                </Text>
              </View>
            ) : (
              <Text style={{ color: c.textFaint }} className={T.micro}>
                Unassigned
              </Text>
            )}
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Tickets — raise an issue with IT/HR/Admin and watch it move.
 *
 * Scoped to the signed-in user with `assignment: "created_by_me"`: this is the
 * employee app, and an employee seeing the whole company's ticket queue is a
 * data-exposure bug, not a feature.
 */
export default function TicketsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const user = useAppSelector(selectCurrentUser);
  const go = useMenuNav();

  const [status, setStatus] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [error, setError] = useState("");

  const list = useGetTicketsQuery({
    assignment: "created_by_me",
    status,
    limit: 50,
    sort_by: "createdAt",
    sort_order: "desc",
  });
  const [createTicket, { isLoading: creating }] = useCreateTicketMutation();

  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  /**
   * Per-status counts for the filter rail.
   *
   * The backend already returns `status_counts` alongside the page, so the
   * numbers cost nothing — and a rail without them made every chip look equally
   * worth tapping, which is how "Rejected" got opened to find it empty. Keys
   * run through `statusKey` because the same spelling drift that forced the
   * normaliser in the first place reaches the counts too.
   */
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(list.data?.meta?.status_counts ?? {})) {
      out[statusKey(k)] = (out[statusKey(k)] ?? 0) + (Number(v) || 0);
    }
    // "All" is whatever the server says the unfiltered total is; falling back
    // to the page length would under-report the moment a queue outgrows 50.
    out[""] = list.data?.meta?.total ?? Object.values(out).reduce((a, b) => a + b, 0);
    return out;
  }, [list.data]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!title.trim()) {
      setError("Give the ticket a one-line title.");
      return;
    }
    if (!description.trim()) {
      setError("Describe what went wrong — the desk cannot act on a title alone.");
      return;
    }

    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        // Routes to the employee's own department when the server has one on
        // file; omitted otherwise so the backend's default triage applies.
        ...(user?.department_id ? { department_id: user.department_id } : {}),
      }).unwrap();
      toast.success("Ticket raised", "You will be notified as it progresses.");
      setComposeOpen(false);
      reset();
      // Drop back to "All" so the new ticket is actually visible. Filtered to
      // Resolved, a successful submit landed the user on an empty list — which
      // reads as a failed submit however cheerful the toast was.
      setStatus("");
      list.refetch();
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Tickets"
        subtitle="Issues you have raised"
        onBack={() => navigation.goBack()}
      />

      {/* Status rail. Server-side filtering, unlike Leave's client-side chips:
          a ticket queue is unbounded, so narrowing has to happen before the
          rows are shipped. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          gap: space.sm,
          paddingBottom: space.lg,
        }}
      >
        {FILTERS.map((f) => {
          const active = status === f.key;
          const n = counts[f.key];
          return (
            <Pressable
              key={f.key || "all"}
              onPress={() => setStatus(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={n ? `${f.label}, ${n}` : f.label}
              style={({ pressed }) => ({
                backgroundColor: active ? brand[600] : c.card,
                borderRadius: radius.pill,
                borderWidth: active ? 0 : 1,
                borderColor: c.border,
                opacity: pressed ? 0.75 : 1,
              })}
              className="h-9 flex-row items-center justify-center gap-1.5 px-3.5"
            >
              <Text
                style={{ color: active ? "#FFFFFF" : c.text }}
                className={T.badge}
                allowFontScaling={false}
              >
                {f.label}
              </Text>
              {/* Zero is shown as nothing rather than as "0": an empty state
                  the chip already communicates by being empty when tapped, and
                  a rail of zeros reads as a broken screen. */}
              {n ? (
                <View
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.22)" : c.fill,
                    borderRadius: radius.pill,
                    minWidth: 20,
                  }}
                  className="items-center px-1.5 py-0.5"
                >
                  <Text
                    style={{ color: active ? "#FFFFFF" : c.textMuted }}
                    className={T.count}
                    allowFontScaling={false}
                  >
                    {n}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 76,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching && !list.isLoading}
            onRefresh={() => list.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {list.isLoading ? (
          <>
            <Skeleton height={150} radius={radius.card} />
            <Skeleton height={150} radius={radius.card} />
            <Skeleton height={150} radius={radius.card} />
            <Skeleton height={150} radius={radius.card} />
          </>
        ) : list.error ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your tickets"
            message={describeApiError(list.error).title}
            actionLabel="Try again"
            onAction={() => list.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy size={32} strokeWidth={1.6} color={brand[600]} />}
            title={status ? "Nothing in this state" : "No tickets yet"}
            message={
              status
                ? "Try another status, or raise a new ticket."
                : "Laptop playing up, payroll question, access request — raise it here and it reaches the right desk."
            }
            actionLabel={status ? "Show all" : "Raise a ticket"}
            onAction={status ? () => setStatus("") : () => setComposeOpen(true)}
          />
        ) : (
          items.map((t) => (
            <TicketRow
              key={t._id}
              ticket={t}
              onPress={() => navigation.navigate("Ticket", { id: t._id, title: t.title })}
            />
          ))
        )}
      </ScrollView>

      {/* Same sticky-FAB pattern as Leave — one obvious way to start. */}
      <Pressable
        onPress={() => setComposeOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Raise a ticket"
        style={({ pressed }) => ({
          position: "absolute",
          right: space.screen,
          bottom: insets.bottom + BOTTOM_NAV_CLEARANCE,
          height: 52,
          backgroundColor: brand[600],
          borderRadius: radius.pill,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          ...shadow.floating,
        })}
        className="flex-row items-center gap-2 px-5"
      >
        <Plus size={20} strokeWidth={2.4} color="#FFFFFF" />
        <Text className="font-ui-semibold text-[14.5px] text-white">Ticket</Text>
      </Pressable>

      <BottomNav active={null} onSelect={go} />

      {/* ── Compose ────────────────────────────────────────────────────────
          A sheet, not a pushed screen: three fields and no date picker, so
          there is nothing here that wants the whole viewport. */}
      <BottomSheet
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        maxHeightRatio={0.86}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: space.screen, gap: space.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: c.text }} className={T.section}>
              Raise a ticket
            </Text>

            {error ? (
              <Text style={{ color: surface.danger.tint }} className={T.body}>
                {error}
              </Text>
            ) : null}

            <View style={{ gap: space.sm }}>
              <Text style={{ color: c.textMuted }} className={T.label}>
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="One line — what is broken?"
                placeholderTextColor={c.textFaint}
                style={{
                  height: 52,
                  backgroundColor: c.fill,
                  borderRadius: radius.input,
                  color: c.text,
                  paddingHorizontal: space.lg,
                }}
                className="font-ui text-[14px]"
              />
            </View>

            <View style={{ gap: space.sm }}>
              <Text style={{ color: c.textMuted }} className={T.label}>
                Priority
              </Text>
              <View className="flex-row" style={{ gap: space.sm }}>
                {PRIORITIES.map((p) => {
                  const active = priority === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPriority(p)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 42,
                        borderRadius: radius.input,
                        backgroundColor: active ? brand[600] : c.fill,
                        opacity: pressed ? 0.8 : 1,
                      })}
                      className="items-center justify-center"
                    >
                      <Text
                        style={{ color: active ? "#FFFFFF" : c.textMuted }}
                        className={T.badge}
                        numberOfLines={1}
                      >
                        {PRIORITY_LABEL[p]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: space.sm }}>
              <Text style={{ color: c.textMuted }} className={T.label}>
                Details
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What happened, when, and what you already tried."
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 120,
                  backgroundColor: c.fill,
                  borderRadius: radius.input,
                  color: c.text,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                }}
                className="font-ui text-[14px]"
              />
            </View>

            <Button
              label={creating ? "Sending…" : "Submit ticket"}
              icon={<Send size={18} strokeWidth={2} color="#FFFFFF" />}
              loading={creating}
              onPress={submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}
