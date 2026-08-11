import {
  BookText,
  Boxes,
  Cake,
  CalendarDays,
  FileText,
  Gift,
  MessageSquare,
  LayoutGrid,
  LifeBuoy,
  Receipt,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { toast } from "../lib/toast";
import { radius, shadow, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/**
 * Cards visible at rest.
 *
 * Three, not four: at four the cards come out ~79px wide, which is narrower than
 * the icon well is tall and reads as a strip of slivers. Three gives each card
 * room to be a card, and the fourth peeking at the edge is what says the rail
 * scrolls.
 */
const PER_SCREEN = 3;
const GAP = space.md;

interface Action {
  key: string;
  label: string;
  /** Spoken, not shown — screen readers get what the tap will do. */
  hint: string;
  icon: LucideIcon;
  tone: Surface;
  /** No screen behind it yet. Still tappable, so the tap can say why. */
  soon?: boolean;
}

/**
 * Everything the bottom bar does NOT carry.
 *
 * Home, Attendance, Leaves and Profile each have a tab, and the centre button
 * owns every punch — repeating any of those here would just be two doors into
 * the same room. What is left is the long tail, and a scrolling rail is exactly
 * the right shape for a long tail: new modules get appended without re-flowing
 * the row or shrinking every card that already exists.
 */
const ACTIONS: Action[] = [
  {
    key: "apply",
    label: "Leave",
    hint: "Balance and requests",
    icon: FileText,
    tone: surface.danger,
  },
  {
    key: "chat",
    label: "Chat",
    hint: "Message a colleague",
    icon: MessageSquare,
    tone: surface.info,
  },
  {
    key: "team",
    label: "Team",
    hint: "Your department",
    icon: UsersRound,
    tone: surface.success,
  },
  {
    key: "birthday",
    label: "Birthdays",
    hint: "Wish the team",
    icon: Cake,
    tone: surface.warning,
  },
  {
    key: "refer",
    label: "Referrals",
    hint: "Refer a candidate",
    icon: Gift,
    tone: surface.purple,
  },
  {
    key: "payslip",
    label: "Salary",
    hint: "Package and deductions",
    icon: Receipt,
    tone: surface.neutral,
  },
  {
    key: "performance",
    label: "Performance",
    hint: "Your reviews",
    icon: Target,
    tone: surface.success,
  },
  {
    key: "tickets",
    label: "Tickets",
    hint: "Raise an issue",
    icon: LifeBuoy,
    tone: surface.info,
  },
  {
    key: "calendar",
    label: "Calendar",
    hint: "Holidays",
    icon: CalendarDays,
    tone: surface.success,
  },
  {
    key: "asset",
    label: "Assets",
    hint: "What you hold",
    icon: Boxes,
    tone: surface.purple,
  },
  {
    key: "policy",
    label: "HR Policy",
    hint: "Read the rules",
    icon: BookText,
    tone: surface.info,
  },
  {
    key: "meeting",
    label: "Meetings",
    hint: "Your schedule",
    icon: Users,
    tone: surface.warning,
    soon: true,
  },
  {
    key: "more",
    label: "More",
    hint: "All options",
    icon: LayoutGrid,
    tone: surface.neutral,
  },
];

function ActionCard({
  action,
  width,
  onPress,
}: {
  action: Action;
  width: number;
  onPress: () => void;
}) {
  const { c, dark } = useTheme();
  const Icon = action.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action.label}. ${action.hint}`}
      accessibilityHint={action.soon ? "Coming soon" : undefined}
      style={({ pressed }) => ({
        width,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: space.sm,
        paddingVertical: space.lg,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        ...(dark ? shadow.none : shadow.soft),
      })}
      className="items-center"
    >
      {/* Solid fill, white glyph. A pale tint behind a coloured outline icon
          washes out at this size — the well is the only saturated thing on the
          card, so it has to carry the category on its own. */}
      <View
        style={{
          backgroundColor: action.tone.tint,
          borderRadius: 4,
        }}
        className="h-14 w-14 items-center justify-center"
      >
        <Icon size={26} strokeWidth={2.2} color="#FFFFFF" />
      </View>

      <Text
        style={{ color: c.text }}
        className={`mt-3 text-center ${T.cardTitleSm}`}
        numberOfLines={1}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

/** Horizontally scrolling rail of shortcut cards. */
export function QuickActions({
  onOpen,
  onMore,
}: {
  onOpen?: (key: string) => void;
  onMore?: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth =
    (width - space.screen * 2 - GAP * (PER_SCREEN - 1)) / PER_SCREEN;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: space.screen,
        gap: GAP,
      }}
    >
      {ACTIONS.map((a) => (
        <ActionCard
          key={a.key}
          action={a}
          width={cardWidth}
          onPress={() => {
            if (a.soon) {
              // A dead tap reads as a bug. Say why nothing happened.
              toast.info(`${a.label} is coming soon.`);
              return;
            }
            if (a.key === "more") onMore?.();
            else onOpen?.(a.key);
          }}
        />
      ))}
    </ScrollView>
  );
}
