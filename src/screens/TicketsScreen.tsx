import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  LifeBuoy,
  Plus,
  Send,
  TriangleAlert,
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

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
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
} from "../store/ticketsApi";
import { radius, shadow, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDayShort } from "../utils/date";

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

const PRIORITY_TONE: Record<string, Surface> = {
  low: surface.neutral,
  medium: surface.info,
  high: surface.warning,
  critical: surface.danger,
};

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

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

function TicketRow({ ticket, onPress }: { ticket: TicketItem; onPress: () => void }) {
  const { c, dark } = useTheme();

  const key = statusKey(ticket.status);
  const status = STATUS_TONE[key] ?? {
    label: ticket.status || "Unknown",
    tone: surface.neutral,
  };
  const priority = PRIORITY_TONE[String(ticket.priority).toLowerCase()];
  const raised = ticket.createdAt ?? ticket.created_at;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.title}. ${status.label}`}
      accessibilityHint="Opens the ticket and its replies"
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        opacity: pressed ? 0.85 : 1,
        ...(dark ? shadow.none : shadow.soft),
      })}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={2}>
            {ticket.title}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {[ticket.ticket_no, raised ? `Raised ${fmtDayShort(raised)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <Badge label={status.label} tone={status.tone} />
      </View>

      {ticket.description ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-2.5 leading-5 ${T.secondary}`}
          numberOfLines={3}
        >
          {ticket.description}
        </Text>
      ) : null}

      {priority ? (
        <View className="mt-3 flex-row">
          <Badge label={`${ticket.priority} priority`} tone={priority} />
        </View>
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
          return (
            <Pressable
              key={f.key || "all"}
              onPress={() => setStatus(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                backgroundColor: active ? brand[600] : c.card,
                borderRadius: radius.pill,
                borderWidth: active ? 0 : 1,
                borderColor: c.border,
                opacity: pressed ? 0.75 : 1,
              })}
              className="h-9 items-center justify-center px-3.5"
            >
              <Text
                style={{ color: active ? "#FFFFFF" : c.text }}
                className={T.badge}
                allowFontScaling={false}
              >
                {f.label}
              </Text>
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
            <Skeleton height={128} radius={radius.card - 4} />
            <Skeleton height={128} radius={radius.card - 4} />
            <Skeleton height={128} radius={radius.card - 4} />
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
                        borderRadius: radius.input - 4,
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
                        {p}
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
