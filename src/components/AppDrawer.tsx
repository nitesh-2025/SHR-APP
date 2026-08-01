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
  Moon,
  Sun,
  SunMoon,
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
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";

interface MenuEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Screen not built yet — labelled, not badged. */
  soon?: boolean;
}

// Order follows how often an employee reaches for each one, not alphabetical.
const MENU: MenuEntry[] = [
  { key: "leaves", label: "My Leaves", icon: ClipboardList },
  { key: "attendance", label: "Attendance", icon: CalendarDays },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "team", label: "My Team", icon: UsersRound },
  { key: "birthday", label: "Birthdays", icon: Cake },
  { key: "meeting", label: "Meeting", icon: Users, soon: true },
  { key: "calendar", label: "Calendar", icon: CalendarDays, soon: true },
  { key: "tickets", label: "Tickets", icon: LifeBuoy, soon: true },
  { key: "refer", label: "Referrals", icon: Gift },
  { key: "policy", label: "HR Policy", icon: FileText, soon: true },
  { key: "asset", label: "Asset Request", icon: Boxes, soon: true },
];

/**
 * Menu row. Plain icon, plain label — no tinted well and no badge: eight rows
 * each carrying a coloured tile and a pill is what made this list feel loud.
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
      className="h-12 flex-row items-center gap-3.5"
    >
      <Icon size={19} strokeWidth={2} color={soon ? c.textFaint : brand[600]} />

      <Text
        style={{ color: soon ? c.textFaint : c.text }}
        className="flex-1 font-ui text-[15px]"
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
      ) : (
        <ChevronRight size={17} strokeWidth={2} color={c.textFaint} />
      )}
    </Pressable>
  );
}

/* ── Settings rows ────────────────────────────────────────────────────────── */

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View className="h-12 flex-row items-center justify-between">
      <Text style={{ color: c.textMuted }} className="font-ui text-[14px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

// The accent swatch row was removed deliberately: one primary colour is the
// whole point of the design system, and a five-colour picker in the drawer both
// undercut that and rendered as empty circles on device. The theme ramps still
// exist in `theme/themes.ts` — flip `DEFAULT_THEME` to re-skin the app in one
// line, without giving every user a knob for it.

/** Light / dark / follow-system. Three states, so a toggle would not do. */
function ModePicker() {
  const { mode, setMode, c, brand } = useTheme();
  const OPTIONS: { key: ThemeMode; label: string; icon: LucideIcon }[] = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "Auto", icon: SunMoon },
  ];

  return (
    <SettingRow label="Appearance">
      <View
        style={{ backgroundColor: c.fill, borderRadius: radius.pill }}
        className="flex-row p-0.5"
      >
        {OPTIONS.map(({ key, label, icon: Icon }) => {
          const active = mode === key;
          return (
            <Pressable
              key={key}
              onPress={() => setMode(key)}
              accessibilityRole="button"
              accessibilityLabel={`${label} appearance`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                backgroundColor: active ? c.card : "transparent",
                borderRadius: radius.pill,
                opacity: pressed ? 0.7 : 1,
              })}
              className="flex-row items-center gap-4 px-2.5 py-1.5"
            >
              <Icon
                size={13}
                strokeWidth={2}
                color={active ? brand[600] : c.textFaint}
              />
              <Text
                style={{ color: active ? c.text : c.textFaint }}
                className="font-ui-semibold text-[11.5px]"
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SettingRow>
  );
}

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
  const openEntry = (entry: MenuEntry) => {
    onClose();
    onNavigate?.(entry.key);
  };

  const designation = user?.designation || user?.role_name || user?.role;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* ── Header ───────────────────────────────────────────────────────
          A plain row, not a floating card: a shadowed card here sat ON TOP of
          the scrolling list and clipped the first item behind it. */}
      <View
        style={{ paddingHorizontal: space.screen, paddingBottom: space.lg }}
        className="flex-row items-center gap-3"
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
          paddingVertical: space.sm,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {MENU.map((entry) => (
          <Row key={entry.key} entry={entry} onPress={() => openEntry(entry)} />
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: c.border }} />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: space.screen }}>
        <ModePicker />

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            backgroundColor: c.fill,
            borderRadius: radius.button,
            marginTop: space.sm,
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
