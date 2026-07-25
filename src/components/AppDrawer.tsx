import Constants from 'expo-constants';
import {
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Gift,
  LifeBuoy,
  LogOut,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, fullNameOf } from './Avatar';
import { selectCurrentUser, useAppDispatch, useAppSelector } from '../store';
import { clearCredentials } from '../store/authSlice';

interface MenuEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Screen not built yet — shown with a badge instead of firing a toast. */
  soon?: boolean;
}

// Order follows how often an employee reaches for each one, not alphabetical.
const MENU: MenuEntry[] = [
  { key: 'leaves', label: 'My Leaves', icon: ClipboardList, soon: true },
  { key: 'attendance', label: 'Attendance', icon: CalendarDays, soon: true },
  { key: 'meeting', label: 'Meeting', icon: Users, soon: true },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays, soon: true },
  { key: 'tickets', label: 'Tickets', icon: LifeBuoy, soon: true },
  { key: 'refer', label: 'Refer & Earn', icon: Gift, soon: true },
  { key: 'policy', label: 'HR Policy', icon: FileText, soon: true },
  { key: 'asset', label: 'Asset Request', icon: Boxes, soon: true },
];

const OPEN_MS = 260;
const CLOSE_MS = 200;

function Row({ entry, onPress }: { entry: MenuEntry; onPress: () => void }) {
  const Icon = entry.icon;
  const soon = Boolean(entry.soon);

  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={soon}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
      accessibilityState={{ disabled: soon }}
      accessibilityHint={soon ? 'Coming soon' : undefined}
      android_ripple={soon ? undefined : { color: 'rgba(47,143,44,0.10)' }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="flex-row items-center gap-3.5 rounded-2xl px-3 py-3.5"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          soon ? 'bg-slate-100' : 'bg-brand-50'
        }`}
      >
        <Icon size={19} strokeWidth={2} color={soon ? '#94a3b8' : '#2f8f2c'} />
      </View>
      <Text
        className={`flex-1 font-ui text-[15px] ${soon ? 'text-slate-400' : 'text-slate-800'}`}
      >
        {entry.label}
      </Text>

      {/* State is declared up front, so a tap never has to explain itself with
          a toast — the user knows before touching it. */}
      {soon ? (
        <View className="rounded-full bg-slate-100 px-2 py-0.5">
          <Text className="font-ui-semibold text-[10px] uppercase tracking-wide text-slate-400">
            Soon
          </Text>
        </View>
      ) : (
        <ChevronRight size={17} strokeWidth={2} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

/**
 * Right-hand navigation drawer. Slides in from the right edge; the scrim fades
 * with it so the two never look like separate events.
 *
 * `Modal` keeps it above the navigator without threading state through every
 * screen, and gives hardware-back handling on Android for free.
 */
export function AppDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);

  const panelWidth = Math.min(width * 0.82, 340);

  // 1 = fully off-screen right, 0 = open. One value drives both the panel slide
  // and the scrim fade, so they cannot drift apart.
  const shut = useSharedValue(1);

  useEffect(() => {
    shut.value = withTiming(visible ? 0 : 1, {
      duration: visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
    });
  }, [visible, shut]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shut.value * panelWidth }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({ opacity: 1 - shut.value }));

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const handleLogout = () => {
    // Close first: the navigator unmounts this tree as soon as the session
    // clears, and animating a gone component would warn.
    onClose();
    dispatch(clearCredentials());
  };

  // Wired for when the screens land: `Row` disables anything flagged `soon`,
  // so this only ever runs for a destination that actually exists.
  const openEntry = (_entry: MenuEntry) => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }, scrimStyle]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: panelWidth,
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 14,
              shadowColor: '#0f172a',
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: -8, height: 0 },
              elevation: 16,
            },
            panelStyle,
          ]}
          className="bg-white"
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <View className="flex-row items-center gap-3 px-5 pb-4">
            <Avatar user={user} size={46} />
            <View className="flex-1">
              <Text
                className="font-ui-semibold text-[15px] text-slate-900"
                numberOfLines={1}
              >
                {fullNameOf(user)}
              </Text>
              <Text className="font-ui-regular text-xs text-slate-500" numberOfLines={1}>
                {user?.role ? `${user.role} · ` : ''}
                {user?.email}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
            >
              <X size={16} strokeWidth={2.2} color="#64748b" />
            </Pressable>
          </View>

          <View className="mx-5 h-px bg-slate-100" />

          {/* ── Items ──────────────────────────────────────────────────── */}
          <ScrollView
            className="flex-1 px-2"
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {MENU.map((entry) => (
              <Row key={entry.key} entry={entry} onPress={() => openEntry(entry)} />
            ))}
          </ScrollView>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <View className="mx-5 h-px bg-slate-100" />

          <View className="px-5 pt-3">
            <Pressable
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              android_ripple={{ color: 'rgba(239,68,68,0.10)' }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50"
            >
              <LogOut size={17} strokeWidth={2.1} color="#e11d48" />
              <Text className="font-ui-semibold text-[14px] text-rose-600">Log out</Text>
            </Pressable>

            <Text className="mt-3 text-center font-ui-regular text-[11px] text-slate-400">
              SHR · Version {version}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
