import { BadgeCheck, Building2, ChevronRight, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Avatar, fullNameOf } from './Avatar';
import { Badge, Card } from './ui';
import type { AuthUser } from '../store/tokenStorage';
import { space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

/** One meta line — small icon, faint label text. */
function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { c } = useTheme();
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      {icon}
      <Text
        style={{ color: c.textMuted }}
        className="flex-1 font-ui-regular text-[12px]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Identity card — who is signed in and where they sit in the org.
 *
 * Hierarchy over badges: name → designation → department → employee id, with a
 * single duty chip on the right. The shift window is deliberately NOT here; it
 * belongs on the attendance card, which is where it gets acted on.
 */
export function AccountCard({
  user,
  onDuty = false,
  onPress,
  onClose,
}: {
  user?: AuthUser | null;
  /** Clocked in right now. */
  onDuty?: boolean;
  onPress?: () => void;
  /** Drawer variant — dismiss button instead of the chevron. */
  onClose?: () => void;
}) {
  const { c } = useTheme();

  // `role` is a CODE (ADMIN) — only fall back to it when there is no label.
  const designation = user?.designation || user?.role_name || user?.role;
  const department = user?.department_name;
  const employeeId = user?.employee_id;

  const body = (
    <Card padded={false}>
      <View style={{ padding: space.lg }} className="flex-row items-start gap-3">
        <Avatar user={user} size={52} />

        <View className="flex-1">
          <Text
            style={{ color: c.text }}
            className="font-ui-semibold text-[16px]"
            numberOfLines={1}
          >
            {fullNameOf(user)}
          </Text>
          {designation ? (
            <Text
              style={{ color: c.textMuted }}
              className="mt-0.5 font-ui-regular text-[12.5px]"
              numberOfLines={1}
            >
              {designation}
            </Text>
          ) : null}
          {department ? (
            <MetaRow
              icon={<Building2 size={12} strokeWidth={2} color={c.textFaint} />}
              label={department}
            />
          ) : null}
          {employeeId ? (
            <MetaRow
              icon={<BadgeCheck size={12} strokeWidth={2} color={c.textFaint} />}
              label={`Employee ID: ${employeeId}`}
            />
          ) : null}
        </View>

        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, backgroundColor: c.fill })}
            className="h-8 w-8 items-center justify-center rounded-full"
          >
            <X size={16} strokeWidth={2} color={c.textMuted} />
          </Pressable>
        ) : (
          // Duty state is the only thing here that changes during the day, so
          // it is the only chip. The shift window lives on the attendance card,
          // where it is actually acted on — repeating it here was noise.
          <View className="items-end gap-2">
            <Badge
              label={onDuty ? 'On Duty' : 'Off Duty'}
              tone={onDuty ? surface.success : surface.neutral}
            />
            {onPress ? <ChevronRight size={18} strokeWidth={2} color={c.textFaint} /> : null}
          </View>
        )}
      </View>
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View profile"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {body}
    </Pressable>
  );
}
