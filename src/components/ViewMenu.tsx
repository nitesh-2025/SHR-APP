import { Check, EllipsisVertical, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./BottomSheet";
import { Badge } from "./ui";
import { radius, space, surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

export interface ViewOption<K extends string> {
  key: K;
  label: string;
  /** The sentence that says what picking it does. This is the whole point. */
  hint: string;
  icon: LucideIcon;
  /** Shown as a chip on the row. Omit or pass 0 to hide. */
  count?: number;
}

export interface ViewAction {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  onPress: () => void;
}

/* ── Row ──────────────────────────────────────────────────────────────────── */

function MenuRow({
  icon: Icon,
  label,
  hint,
  count,
  active,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  count?: number;
  /** `undefined` for an action — an action is not a state you can be in. */
  active?: boolean;
  onPress: () => void;
}) {
  const { c, brand, tint, dark } = useTheme();
  // Press feedback as STATE. See the note on the style prop below.
  const [pressed, setPressed] = useState(false);

  const selected = active === true;
  const isAction = active === undefined;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole={isAction ? "button" : "radio"}
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${hint}`}
      // A plain object, never the `({ pressed }) => ({…})` callback form.
      //
      // This row was written with the callback and rendered as rubble: the
      // object it returned was dropped on the way through NativeWind's JSX
      // transform, so `flexDirection: "row"` went with it. The children then
      // stacked vertically — which collapsed the `flex: 1` text column to zero
      // height (a flex child in an auto-height column has nothing to divide),
      // leaving an icon, a full-width grey count pill and a tick. The label and
      // the hint were rendering the whole time, at zero pixels tall.
      //
      // `ui.tsx`'s Button documents the same failure. Same rule here: static
      // style, state for the press.
      style={{
        // The selected row is the only filled one. Five filled slabs in a
        // column is a list where nothing is chosen and everything looks chosen.
        backgroundColor: selected ? tint.bg : pressed ? c.fill : "transparent",
        borderRadius: radius.well,
        borderWidth: 1,
        borderColor: selected ? brand[600] : c.border,
        paddingLeft: space.md,
        paddingRight: space.lg,
        paddingVertical: space.md,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.well,
          alignItems: "center",
          justifyContent: "center",
          // An action's well carries the accent as a TINT, the selected view
          // carries it as a fill. Same family, different weight — one is where
          // you are, the other is something you can do.
          backgroundColor: selected
            ? brand[600]
            : isAction
              ? tint.bg
              : dark
                ? c.fill
                : c.bg,
        }}
      >
        <Icon
          size={18}
          strokeWidth={2.1}
          color={selected ? "#FFFFFF" : isAction ? brand[600] : c.textMuted}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: selected ? tint.text : c.text,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 14,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{
            color: c.textMuted,
            fontFamily: "Outfit_400Regular",
            fontSize: 11.5,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {hint}
        </Text>
      </View>

      {count ? (
        <Badge
          label={String(count)}
          tone={selected ? surface.success : surface.neutral}
        />
      ) : null}

      {selected ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.pill,
            backgroundColor: brand[600],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={13} strokeWidth={3} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

/* ── Menu ─────────────────────────────────────────────────────────────────── */

/**
 * The screen's views, behind one glyph in the header.
 *
 * This replaced the segmented strip on every screen that had one. Three
 * problems with the strip, in order of how often they bit: at 360dp a third
 * segment left each one ~100px, which is where labels truncate and count pills
 * stop fitting; a strip has no room for the sentence that says what a view IS,
 * so "Requested" and "Apply" sat a pixel apart explaining nothing; and it spent
 * a permanent 48px band on a control most people touch once a visit.
 *
 * A sheet rather than a popover anchored under the glyph: the trigger sits just
 * under the status bar, and a menu opening downward from there would cover the
 * very list it switches.
 */
export function ViewMenu<K extends string>({
  value,
  options,
  onChange,
  actions = [],
  title = "Show",
  /** A dot on the glyph — something is waiting in a view you are not on. */
  badge = false,
}: {
  value: K;
  options: ViewOption<K>[];
  onChange: (key: K) => void;
  /** One-shot things that are not views: "Refer a candidate", "Export"… */
  actions?: ViewAction[];
  title?: string;
  badge?: boolean;
}) {
  const { c, brand, tint } = useTheme();
  const [open, setOpen] = useState(false);
  const [tapped, setTapped] = useState(false);

  const current = options.find((o) => o.key === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        onPressIn={() => setTapped(true)}
        onPressOut={() => setTapped(false)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`View: ${current?.label ?? title}. Change view`}
        style={{
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          // Lit while the sheet is open, so the glyph reads as the thing the
          // sheet came out of rather than as a button that did nothing.
          backgroundColor: open ? tint.bg : c.card,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: open ? brand[600] : c.border,
          opacity: tapped ? 0.7 : 1,
        }}
      >
        <EllipsisVertical
          size={18}
          strokeWidth={2.2}
          color={open ? brand[600] : c.text}
        />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 9,
              height: 9,
              borderRadius: radius.pill,
              backgroundColor: surface.warning.tint,
              borderWidth: 1.5,
              borderColor: c.bg,
            }}
          />
        ) : null}
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        maxHeightRatio={0.7}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <View style={{ marginBottom: space.xs }}>
            <Text style={{ color: c.text }} className={T.section}>
              {title}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-0.5 ${T.secondary}`}
            >
              {current ? `Currently on ${current.label.toLowerCase()}` : " "}
            </Text>
          </View>

          {options.map((o) => (
            <MenuRow
              key={o.key}
              icon={o.icon}
              label={o.label}
              hint={o.hint}
              count={o.count}
              active={o.key === value}
              onPress={() => {
                onChange(o.key);
                setOpen(false);
              }}
            />
          ))}

          {actions.length > 0 ? (
            <>
              {/* Actions sit below a rule, because a thing that HAPPENS and a
                  thing you are LOOKING AT should not be picked from the same
                  list without a line between them. */}
              <View
                style={{
                  height: 1,
                  backgroundColor: c.border,
                  marginVertical: space.sm,
                }}
              />
              {actions.map((a) => (
                <MenuRow
                  key={a.key}
                  icon={a.icon}
                  label={a.label}
                  hint={a.hint}
                  onPress={() => {
                    setOpen(false);
                    a.onPress();
                  }}
                />
              ))}
            </>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}
