import Constants from "expo-constants";
import {
  Boxes,
  Cake,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Gift,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Receipt,
  Target,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar, fullNameOf } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { selectCurrentUser, useAppDispatch, useAppSelector } from "../store";
import { clearCredentials } from "../store/authSlice";
import { danger, radius, space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

interface MenuEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Screen not built yet — labelled, not badged. */
  soon?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuEntry[];
}

/**
 * Grouped, not one flat list.
 *
 * Thirteen identical rows in a column is a wall: nothing about "Salary" looked
 * different from "Team", so finding either one meant reading all thirteen. Four
 * short groups mean the eye picks the GROUP first and then scans three or four
 * rows — the label pays for its own height several times over.
 *
 * Order inside a group still follows how often an employee reaches for it, not
 * alphabetical.
 */
const SECTIONS: MenuSection[] = [
  {
    title: "My work",
    items: [
      { key: "leaves", label: "My Leaves", icon: ClipboardList },
      { key: "attendance", label: "Attendance", icon: CalendarDays },
      { key: "calendar", label: "Work Calendar", icon: CalendarDays },
      { key: "performance", label: "My Performance", icon: Target },
    ],
  },
  {
    title: "People",
    items: [
      { key: "chat", label: "Chat", icon: MessageSquare },
      { key: "team", label: "Team", icon: UsersRound },
      { key: "birthday", label: "Birthdays", icon: Cake },
    ],
  },
  {
    title: "Money",
    items: [
      { key: "payslip", label: "Salary", icon: Receipt },
      { key: "refer", label: "Referrals", icon: Gift },
    ],
  },
  {
    title: "Company",
    items: [
      { key: "tickets", label: "Tickets", icon: LifeBuoy },
      { key: "asset", label: "My Assets", icon: Boxes },
      { key: "policy", label: "HR Policy", icon: FileText },
      // No meetings API exists yet — labelled, not hidden, so the gap is
      // visible rather than mysterious.
      { key: "meeting", label: "Meeting", icon: Users, soon: true },
    ],
  },
];

/**
 * Menu row. Plain icon, plain label — no tinted well, no badge, and no chevron.
 *
 * The wells and pills went first (eight coloured tiles is what made this list
 * feel loud); the chevrons went with the grouping. Thirteen identical arrows
 * pointing at nothing in particular were the only thing in the column with more
 * visual weight than the labels, and in a menu every row navigates — an
 * affordance that is true of everything marks nothing.
 */
function Row({ entry, onPress }: { entry: MenuEntry; onPress: () => void }) {
  const Icon = entry.icon;
  const soon = Boolean(entry.soon);
  const { c, brand } = useTheme();

  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={soon}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
      accessibilityState={{ disabled: soon }}
      accessibilityHint={soon ? "Coming soon" : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      className="h-11 flex-row items-center gap-3.5"
    >
      <Icon size={19} strokeWidth={2} color={soon ? c.textFaint : brand[600]} />

      <Text
        style={{ color: soon ? c.textFaint : c.text }}
        className="flex-1 font-ui text-[15px]"
        numberOfLines={1}
      >
        {entry.label}
      </Text>

      {soon ? (
        <Text
          style={{ color: c.textFaint }}
          className="font-ui-regular text-[11.5px]"
        >
          Soon
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Group label. Caps at 11px — it has to separate, not compete. */
function SectionLabel({ title, first }: { title: string; first: boolean }) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        color: c.textFaint,
        letterSpacing: 0.7,
        marginTop: first ? space.sm : space.lg,
        marginBottom: 2,
      }}
      className={T.micro}
    >
      {title.toUpperCase()}
    </Text>
  );
}

// The accent swatch row was removed deliberately: one primary colour is the
// whole point of the design system, and a five-colour picker in the drawer both
// undercut that and rendered as empty circles on device. The theme ramps still
// exist in `theme/themes.ts` — flip `DEFAULT_THEME` to re-skin the app in one
// line, without giving every user a knob for it.
//
// The light/dark picker that used to sit in this footer now lives on the
// PROFILE screen, under "Appearance". A drawer is a place you pass THROUGH on
// the way to a screen; a preference is something you go and set, and it was the
// only row here that did not navigate anywhere.

/**
 * App menu. Rises from the bottom like every other overlay (see `BottomSheet`)
 * rather than sliding in from the right — one motion language, and the rows sit
 * inside thumb reach instead of up against the top edge.
 */
export function AppDrawer({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called with a `MENU` key for entries that have a screen. */
  onNavigate?: (key: string) => void;
}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const { c } = useTheme();

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

  const handleLogout = () => {
    // Close first: the navigator unmounts this tree as soon as the session
    // clears, and animating a gone component would warn.
    onClose();
    dispatch(clearCredentials());
  };

  // `Row` disables anything flagged `soon`, so this only ever runs for a
  // destination that actually exists. Close first, then navigate — pushing a
  // screen under an open modal leaves the sheet floating over it.
  const open = (key: string) => {
    onClose();
    onNavigate?.(key);
  };

  const designation = user?.designation || user?.role_name || user?.role;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* ── Header ───────────────────────────────────────────────────────
          A plain row, not a floating card: a shadowed card here sat ON TOP of
          the scrolling list and clipped the first item behind it.

          It is also the way IN to the profile now. It was the largest thing in
          the sheet and the only one that did nothing when tapped, while
          "Profile" itself was reachable only from the bottom bar behind it. */}
      <View
        style={{ paddingHorizontal: space.screen, paddingBottom: space.lg }}
        className="flex-row items-center gap-3"
      >
        <Pressable
          onPress={() => open("profile")}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          className="flex-1 flex-row items-center gap-3"
        >
          <Avatar user={user} size={44} />
          <View className="flex-1">
            <Text
              style={{ color: c.text }}
              className="font-ui-semibold text-[15px]"
              numberOfLines={1}
            >
              {fullNameOf(user)}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className="font-ui-regular text-[12.5px]"
              numberOfLines={1}
            >
              {[designation, user?.department_name].filter(Boolean).join(" · ") ||
                user?.email}
            </Text>
          </View>
          <ChevronRight size={17} strokeWidth={2} color={c.textFaint} />
        </Pressable>

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            backgroundColor: c.fill,
          })}
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <X size={16} strokeWidth={2} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={{ height: 1, backgroundColor: c.border }} />

      {/* ── Items ────────────────────────────────────────────────────── */}
      <ScrollView
        // `shrink`: inside a height-capped column the list must give way to the
        // footer instead of pushing it off the sheet.
        className="shrink"
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: space.md,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {SECTIONS.map((section, s) => (
          <View key={section.title}>
            <SectionLabel title={section.title} first={s === 0} />
            {section.items.map((entry) => (
              <Row
                key={entry.key}
                entry={entry}
                onPress={() => open(entry.key)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: c.border }} />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: space.screen, paddingTop: space.md }}>
        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            backgroundColor: c.fill,
            borderRadius: radius.button,
          })}
          className="h-12 flex-row items-center justify-center gap-2"
        >
          <LogOut size={17} strokeWidth={2} color={danger[500]} />
          <Text
            style={{ color: danger[600] }}
            className="font-ui-semibold text-[14px]"
          >
            Log out
          </Text>
        </Pressable>

        <Text
          style={{ color: c.textFaint }}
          className="mt-2.5 text-center font-ui-regular text-[11px]"
        >
          SHR · Version {version}
        </Text>
      </View>
    </BottomSheet>
  );
}
