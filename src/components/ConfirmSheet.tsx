import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet } from './BottomSheet';
import { Button } from './ui';
import { radius, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

export type ConfirmTone = 'default' | 'danger' | 'warning';

/* ── Detail column ────────────────────────────────────────────────────────── */

/**
 * One figure in the optional summary well.
 *
 * Centred, because the well is a row of two or three peers — left-aligned
 * columns would read as a list that happens to be side by side.
 */
export function ConfirmStat({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-1 items-center px-1">
      <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: c.text }}
        className={`mt-0.5 text-center ${T.cardTitleSm}`}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}

/** The 1px rule between two `ConfirmStat`s. */
export function ConfirmDivider() {
  const { c } = useTheme();
  return <View style={{ backgroundColor: c.border }} className="h-8 w-px" />;
}

/* ── Sheet ────────────────────────────────────────────────────────────────── */

/**
 * One component for every "are you sure" in the app, so a consequential tap
 * always asks the same way.
 *
 * Never `Alert.alert`: the system dialog cannot carry the app's type, its
 * accent or a busy state on the confirm button, and it looks like a different
 * product on each platform.
 *
 * **Both buttons name their own outcome.** A sheet whose only labelled choice
 * is the way out ("Cancel" opposite a bare "OK") reads as if there is no way
 * forward. Cancel sits first and carries no fill — weight marks the
 * consequential choice, not position.
 */
export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  icon: Icon,
  title,
  message,
  detail,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'No, cancel',
  tone = 'default',
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon: LucideIcon;
  title: string;
  message?: string;
  /** Optional summary — a row of `ConfirmStat`s split by `ConfirmDivider`. */
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** The sheet stays open with a spinner on confirm; cancel disables. */
  loading?: boolean;
}) {
  const { c, primary } = useTheme();

  const TONES: Record<ConfirmTone, Surface> = {
    default: primary,
    danger: surface.danger,
    warning: surface.warning,
  };
  const t = TONES[tone];

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.6}>
      <View style={{ paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: space.screen }}>
        <View
          style={{ backgroundColor: t.bg, borderRadius: radius.pill }}
          className="h-14 w-14 items-center justify-center self-center"
        >
          <Icon size={26} strokeWidth={2} color={t.tint} />
        </View>

        <Text style={{ color: c.text }} className={`mt-4 text-center ${T.cardTitle}`}>
          {title}
        </Text>

        {message ? (
          <Text
            style={{ color: c.textMuted }}
            className={`mt-2 text-center leading-5 ${T.secondary}`}
          >
            {message}
          </Text>
        ) : null}

        {detail ? (
          <View
            style={{
              backgroundColor: c.fill,
              borderRadius: radius.well,
              paddingVertical: space.md,
              marginTop: space.lg,
            }}
            className="flex-row items-center"
          >
            {detail}
          </View>
        ) : null}

        <View className="mt-6 flex-row" style={{ gap: space.md }}>
          {/* `secondary`, not `ghost`: ghost is transparent with a hairline,
              and on a white sheet that reads as an absent button. The way out
              of a confirm must never be the harder one to see. */}
          <Button
            label={cancelLabel}
            variant="secondary"
            full={false}
            disabled={loading}
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            label={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            full={false}
            loading={loading}
            onPress={onConfirm}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
