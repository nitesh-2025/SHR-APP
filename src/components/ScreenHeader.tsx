import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Title bar for every pushed screen. The native header is disabled on the stack
 * (`headerShown: false`) so back buttons, titles and trailing actions all come
 * from one component instead of drifting per screen.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <View
      style={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.screen,
        paddingBottom: space.lg,
        backgroundColor: c.bg,
      }}
      className="flex-row items-center gap-3"
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            backgroundColor: c.card,
            borderRadius: radius.button,
          })}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={20} strokeWidth={2} color={c.text} />
        </Pressable>
      ) : null}

      <View className="flex-1">
        <Text
          style={{ color: c.text }}
          className="font-display text-[22px] leading-7"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ color: c.textMuted }}
            className="font-ui-regular text-[12.5px]"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}
