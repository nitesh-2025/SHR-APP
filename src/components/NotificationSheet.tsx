import {
  Bell,
  BellOff,
  CalendarCheck,
  LifeBuoy,
  MessageSquare,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { BottomSheet } from "./BottomSheet";
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationItem,
  type NotificationType,
} from "../store/notificationApi";
import { useTheme } from "../theme/ThemeProvider";

const ICONS: Record<NotificationType, LucideIcon> = {
  ticket: LifeBuoy,
  sla: Timer,
  system: Bell,
  comment: MessageSquare,
  attendance: CalendarCheck,
};

/** "just now" / "12m" / "3h" / "2d" — absolute dates are noise in a feed. */
function ago(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

function Row({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const Icon = ICONS[item.type] ?? Bell;
  const unread = !item.is_read;
  // The unread wash and the icon well used the brand's 50/100 steps, which only
  // work on white — on the dark sheet they read as two pale slabs. `tint` is the
  // same recipe already rebuilt from the 500 step at low alpha.
  const { brand, c, dark, tint } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      android_ripple={{ color: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1,
        backgroundColor: unread ? tint.bg : "transparent",
      })}
      className="flex-row gap-3 px-5 py-3.5"
    >
      <View
        style={{ backgroundColor: unread ? tint.bg : c.fill }}
        className="h-9 w-9 items-center justify-center rounded-xl"
      >
        <Icon size={17} strokeWidth={2} color={unread ? brand[600] : c.textFaint} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            style={{ color: unread ? c.text : c.textMuted }}
            className={`flex-1 text-[13px] ${
              unread ? "font-ui-semibold" : "font-ui"
            }`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={{ color: c.textFaint }}
            className="font-ui-regular text-[11px]"
          >
            {ago(item.createdAt)}
          </Text>
        </View>
        <Text
          style={{ color: c.textMuted }}
          className="mt-0.5 font-ui-regular text-[12px]"
          numberOfLines={2}
        >
          {item.message}
        </Text>
      </View>

      {/* Unread dot repeats the state for anyone who cannot separate the tints. */}
      {unread ? (
        <View
          style={{ backgroundColor: brand[600] }}
          className="mt-1.5 h-2 w-2 self-start rounded-full"
        />
      ) : null}
    </Pressable>
  );
}

/**
 * Notification feed, opened from the header bell.
 *
 * A sheet rather than a screen: it is a glance-and-dismiss surface, and the
 * navigator has no route for it yet. Tapping a row only marks it read — there
 * is nowhere to deep-link to until the module screens exist.
 */
export function NotificationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { brand, c } = useTheme();
  // `skip` while closed: the sheet lives mounted inside the screen, and an
  // always-on poll for a panel nobody opened is wasted battery and requests.
  const { data, isLoading, isFetching, refetch } = useGetNotificationsQuery(
    { limit: 30 },
    { skip: !visible, refetchOnMountOrArgChange: true },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();

  const items = data?.items ?? [];
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.78}>
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-1">
        <Text style={{ color: c.text }} className="flex-1 font-display text-[17px]">
          Notifications
        </Text>

        {hasUnread ? (
          <Pressable
            onPress={() => markAllRead()}
            disabled={markAllState.isLoading}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            hitSlop={8}
          >
            <Text
              style={{ color: brand[600] }}
              className="font-ui-semibold text-[12px]"
            >
              Mark all read
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
          style={{ backgroundColor: c.fill }}
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <X size={16} strokeWidth={2.2} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={{ backgroundColor: c.border }} className="h-px" />

      {isLoading ? (
        <View className="h-40 items-center justify-center">
          <ActivityIndicator color={brand[500]} />
        </View>
      ) : items.length === 0 ? (
        <View className="items-center gap-2 px-5 py-14">
          <BellOff size={26} strokeWidth={1.8} color={c.textFaint} />
          <Text style={{ color: c.textMuted }} className="font-ui text-[13px]">
            You&apos;re all caught up
          </Text>
        </View>
      ) : (
        <FlatList
          // `shrink` so the list gives way to the sheet's `maxHeight` and
          // scrolls inside it, rather than measuring to its own content height
          // and being clipped by the cap.
          className="shrink"
          data={items}
          keyExtractor={(n) => n._id}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          ItemSeparatorComponent={() => (
            <View style={{ backgroundColor: c.border }} className="ml-[68px] h-px" />
          )}
          renderItem={({ item }) => (
            <Row
              item={item}
              onPress={() => {
                if (!item.is_read) markRead(item._id);
              }}
            />
          )}
        />
      )}
    </BottomSheet>
  );
}
