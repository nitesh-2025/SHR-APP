import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { toast } from '../lib/toast';
import { radius, space } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { maskSensitive } from '../utils/mask';

/**
 * Free text somebody else typed, with anything that looks like a secret blunted.
 *
 * Masking without a way back would be worse than not masking: the author of a
 * ticket needs to confirm they pasted the RIGHT account number, and a support
 * reply that says "we credited it to ••••4417" is only useful if the reader can
 * check the four digits against their own. So the value is hidden by default —
 * which is what protects it in a list, over a shoulder, and in a screenshot —
 * and revealing it is one deliberate tap that the reader owns.
 *
 * The affordance appears ONLY when something was actually hidden. A permanent
 * "show" control under every paragraph would train people to tap it by reflex,
 * which is the opposite of what it is for.
 */
export function MaskedText({
  value,
  className,
  style,
  numberOfLines,
}: {
  value?: string | null;
  className?: string;
  style?: StyleProp<TextStyle>;
  /** Applies to the masked view; a revealed value is never truncated. */
  numberOfLines?: number;
}) {
  const { c, brand, tint } = useTheme();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const result = useMemo(() => maskSensitive(value), [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      // The ORIGINAL, not what is on screen. Copying a string of X is a
      // paste-time surprise, and the reason to copy at all is to use the value.
      await Clipboard.setStringAsync(value ?? '');
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy that.');
    }
  };

  if (!result.text) return null;

  return (
    <View>
      <Text
        style={style}
        className={className}
        numberOfLines={shown ? undefined : numberOfLines}
        // Screen readers get the masked form too — the reveal is a deliberate
        // action there as much as it is by touch.
        accessibilityLabel={
          result.masked
            ? `${result.text}. ${result.count} sensitive ${
                result.count === 1 ? 'value' : 'values'
              } hidden`
            : undefined
        }
      >
        {shown ? (value ?? '') : result.text}
      </Text>

      {result.masked ? (
        <View
          className="flex-row items-center gap-2"
          style={{ marginTop: space.sm }}
        >
          <Pressable
            onPress={() => setShown((s) => !s)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: shown }}
            accessibilityLabel={
              shown ? 'Hide the sensitive values again' : 'Reveal the hidden values'
            }
            style={({ pressed }) => ({
              backgroundColor: shown ? c.fill : tint.bg,
              borderRadius: radius.pill,
              opacity: pressed ? 0.7 : 1,
            })}
            className="flex-row items-center gap-1.5 px-2.5 py-1"
          >
            {shown ? (
              <EyeOff size={12} strokeWidth={2.4} color={c.textMuted} />
            ) : (
              <ShieldCheck size={12} strokeWidth={2.4} color={brand[600]} />
            )}
            <Text
              style={{ color: shown ? c.textMuted : brand[700] }}
              className={T.count}
              allowFontScaling={false}
            >
              {shown
                ? 'Hide again'
                : `Show ${result.count} hidden ${result.count === 1 ? 'value' : 'values'}`}
            </Text>
            {shown ? null : <Eye size={12} strokeWidth={2.4} color={brand[700]} />}
          </Pressable>

          {/* Copy takes the original text, masked or not — the point of
              reaching for a number in a ticket is to use it somewhere else,
              and re-typing it off a revealed paragraph is where digits get
              transposed. */}
          <Pressable
            onPress={copy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Copy the full text"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            {copied ? (
              <Check size={13} strokeWidth={2.6} color={brand[600]} />
            ) : (
              <Copy size={13} strokeWidth={2.2} color={c.textFaint} />
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
