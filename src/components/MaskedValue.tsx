import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { toast } from '../lib/toast';
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { maskTail } from '../utils/mask';

/**
 * One sensitive FIELD — a PAN, an account number, a phone — as `XXXXXX9518`
 * with a copy button.
 *
 * Two affordances, and the split between them is the whole design:
 *
 *   - **Tap the value to reveal it.** The mask protects the number in a list,
 *     over a shoulder and in a screenshot; it must not protect it from its own
 *     owner, who opened this screen precisely to check it.
 *   - **Tap copy to copy the REAL value**, revealed or not. This is the thing
 *     people actually came to do — paste the account number into a form, send
 *     the PAN to HR — and making them un-mask it first, select it by hand and
 *     hope the selection did not include the X's is how a masked field becomes
 *     the reason somebody writes the number down on paper instead.
 *
 * The copy icon confirms in place (a tick for a moment) as well as by toast:
 * the toast is at the other end of the screen from the finger that just tapped.
 */
export function MaskedValue({
  value,
  label,
  keep = 4,
  style,
  className,
}: {
  value?: string | null;
  /** What this is ("PAN", "Account number") — spoken, and used in the toast. */
  label?: string;
  /** Trailing characters left visible. Four answers "is this the right one". */
  keep?: number;
  style?: StyleProp<TextStyle>;
  className?: string;
}) {
  const { c, brand } = useTheme();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The tick is a timer, and a timer that outlives its component sets state on
  // an unmounted one. Cleared on the way out.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const masked = maskTail(raw, keep);
  /** Nothing was hidden (a short value) — then there is nothing to reveal. */
  const hides = masked !== raw;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(raw);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
      toast.success(label ? `${label} copied` : 'Copied');
    } catch {
      toast.error('Could not copy that.');
    }
  };

  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable
        onPress={hides ? () => setShown((s) => !s) : undefined}
        disabled={!hides}
        hitSlop={6}
        accessibilityRole={hides ? 'button' : 'text'}
        accessibilityState={{ expanded: shown }}
        accessibilityLabel={
          hides
            ? `${label ? `${label}: ` : ''}${shown ? raw : `hidden, ending ${raw.slice(-keep)}`}. ${
                shown ? 'Hide' : 'Reveal'
              }`
            : `${label ? `${label}: ` : ''}${raw}`
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          style={[
            {
              color: c.textMuted,
              // Tabular figures keep the tail from shifting sideways as the
              // value flips between masked and revealed.
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.4,
            },
            style,
          ]}
          className={className ?? T.count}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {shown ? raw : masked}
        </Text>
      </Pressable>

      <Pressable
        onPress={copy}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label ? `Copy ${label}` : 'Copy'}
        style={({ pressed }) => ({
          borderRadius: radius.well,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        {copied ? (
          <Check size={13} strokeWidth={2.6} color={brand[600]} />
        ) : (
          <Copy size={13} strokeWidth={2.2} color={c.textFaint} />
        )}
      </Pressable>
    </View>
  );
}
