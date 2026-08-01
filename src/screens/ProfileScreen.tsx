import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  FileText,
  KeyRound,
  Landmark,
  LogOut,
  Settings,
  ShieldCheck,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDrawer } from '../components/AppDrawer';
import { Avatar, fullNameOf } from '../components/Avatar';
import { BOTTOM_NAV_CLEARANCE, BottomNav } from '../components/BottomNav';
import { ShiftCard } from '../components/ShiftCard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { selectCurrentUser, useAppDispatch, useAppSelector } from '../store';
import { clearCredentials } from '../store/authSlice';
import { danger, radius, shadow, space } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

interface Entry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** No screen behind it yet — labelled, not hidden. */
  soon?: boolean;
  danger?: boolean;
}

// Identity first, then money, then paperwork, then account controls.
const ENTRIES: Entry[] = [
  { key: 'personal', label: 'Personal Information', icon: CircleUserRound, soon: true },
  { key: 'bank', label: 'Bank Details', icon: Landmark, soon: true },
  { key: 'documents', label: 'Documents', icon: FileText, soon: true },
  { key: 'emergency', label: 'Emergency Contact', icon: UserRoundCog, soon: true },
  { key: 'password', label: 'Change Password', icon: KeyRound, soon: true },
  { key: 'privacy', label: 'Privacy Policy', icon: ShieldCheck, soon: true },
];

/* ── Decorative arcs on the identity card ─────────────────────────────────── */

/**
 * Thin concentric rings sweeping out of the card's right edge. Same language as
 * the dashboard backdrop, drawn in white here because the card is filled.
 */
function CardArcs({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <Svg width={width} height={height}>
        {[0.44, 0.62, 0.82].map((r, i) => (
          <Circle
            key={r}
            cx={width * 0.94}
            cy={height * 0.16}
            r={width * r}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.2}
            strokeOpacity={0.18 - i * 0.04}
          />
        ))}
      </Svg>
    </View>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────────── */

function Row({
  entry,
  onPress,
  last,
}: {
  entry: Entry;
  onPress: () => void;
  last: boolean;
}) {
  const { c } = useTheme();
  const Icon = entry.icon;
  const soon = Boolean(entry.soon);
  const ink = entry.danger ? danger[500] : soon ? c.textFaint : c.text;

  return (
    <>
      <Pressable
        onPress={soon ? undefined : onPress}
        disabled={soon}
        accessibilityRole="button"
        accessibilityLabel={entry.label}
        accessibilityState={{ disabled: soon }}
        accessibilityHint={soon ? 'Coming soon' : undefined}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        className="h-14 flex-row items-center gap-3.5 px-4"
      >
        <Icon size={20} strokeWidth={1.8} color={ink} />

        <Text
          style={{ color: entry.danger ? danger[600] : soon ? c.textMuted : c.text }}
          className="flex-1 font-ui text-[15px]"
          numberOfLines={1}
        >
          {entry.label}
        </Text>

        {soon ? (
          <Text style={{ color: c.textFaint }} className="font-ui-regular text-[11.5px]">
            Soon
          </Text>
        ) : (
          <ChevronRight
            size={18}
            strokeWidth={2}
            color={entry.danger ? danger[200] : c.textFaint}
          />
        )}
      </Pressable>

      {/* Inset so the rule starts under the label, not under the glyph. */}
      {last ? null : (
        <View style={{ backgroundColor: c.border, marginLeft: 54 }} className="h-px" />
      )}
    </>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Profile. Read-only for now — every row here needs an endpoint that does not
 * exist yet, so they are marked "Soon" rather than wired to a guess. The card
 * itself renders from the session user already in the store, which is why the
 * screen needs no fetch of its own.
 */
export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const { c, brand } = useTheme();
  const { width } = useWindowDimensions();

  const [menuOpen, setMenuOpen] = useState(false);

  // `role` is a CODE (ADMIN) — only fall back to it when there is no label.
  const designation = user?.designation || user?.role_name || user?.role;
  const cardWidth = width - space.screen * 2;
  const cardHeight = 132;

  const go = (key: string) => {
    if (key === 'home') navigation.navigate('Dashboard');
    else if (key === 'attendance') navigation.navigate('Attendance');
    else if (key === 'leaves') navigation.navigate('Leave');
    else if (key === 'apply') navigation.navigate('LeaveApply');
    else if (key === 'more') setMenuOpen(true);
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.lg,
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

        <Text style={{ color: c.text }} className={`flex-1 ${T.screenTitle}`}>
          Profile
        </Text>

        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Settings size={21} strokeWidth={2} color={c.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity card ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={[brand[600], brand[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: cardHeight,
            borderRadius: radius.card,
            paddingHorizontal: space.lg + 2,
            justifyContent: 'center',
            overflow: 'hidden',
            ...shadow.card,
          }}
        >
          <CardArcs width={cardWidth} height={cardHeight} />

          <View className="flex-row items-center gap-4">
            <Avatar user={user} size={84} ring />

            <View className="flex-1">
              <Text
                className="font-display text-[20px] leading-7 text-white"
                numberOfLines={1}
              >
                {fullNameOf(user)}
              </Text>
              {designation ? (
                <Text
                  className="mt-0.5 font-ui-regular text-[13px] text-white/80"
                  numberOfLines={1}
                >
                  {designation}
                </Text>
              ) : null}
              {user?.employee_id ? (
                <Text className="mt-1 font-ui text-[13px] text-white/90" numberOfLines={1}>
                  Emp ID: {user.employee_id}
                </Text>
              ) : (
                <Text className="mt-1 font-ui text-[13px] text-white/90" numberOfLines={1}>
                  {user?.email}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── Shift ────────────────────────────────────────────────────────
            A shift window is a fact about the PERSON, like their department or
            their employee id — not about any one day. On the attendance screen
            it sat among a month of varying records and read as one more
            reading; here it reads as what it is. */}
        <View style={{ marginTop: space.lg }}>
          <ShiftCard />
        </View>

        {/* ── Rows ─────────────────────────────────────────────────────────
            Flat, not a raised Card. The gradient card above is the one thing on
            this screen that should sit forward; putting a shadow under the
            settings list as well made two competing planes out of a page that
            is really "identity, then a list". A hairline is enough of an edge. */}
        <View
          style={{
            marginTop: space.lg,
            backgroundColor: c.card,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
          }}
        >
          {ENTRIES.map((e, i) => (
            <Row
              key={e.key}
              entry={e}
              last={i === ENTRIES.length - 1}
              onPress={() => go(e.key)}
            />
          ))}

          <View style={{ backgroundColor: c.border, marginLeft: 54 }} className="h-px" />

          <Row
            entry={{ key: 'logout', label: 'Logout', icon: LogOut, danger: true }}
            last
            onPress={() => dispatch(clearCredentials())}
          />
        </View>
      </ScrollView>

      <BottomNav active="profile" onSelect={go} />

      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={go}
      />
    </View>
  );
}
