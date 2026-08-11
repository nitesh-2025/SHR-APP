import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Gift, PartyPopper } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Avatar, personUser } from "./Avatar";
import { useTodaysBirthdays } from "../hooks/useTodaysBirthdays";
import { selectCurrentUser, useAppSelector } from "../store";
import { radius, shadow, space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/** How many faces the stack shows before it starts counting instead. */
const FACES = 3;

/**
 * Today's birthdays, on the home screen.
 *
 * `mine` renders ONLY on the signed-in user's own birthday and `others` only
 * when someone else is celebrating — both render nothing on all the other days
 * of the year. That is the whole point: a permanent "no birthdays today" row
 * would spend a card of the home screen, every day, to say nothing.
 *
 * Two scopes because the two belong in different places. Being wished is the
 * first thing you should see; wishing someone else is a nudge that sits under
 * the day's actual work.
 *
 * Both scopes read the SAME cached query — RTK Query dedupes by argument, so
 * rendering both costs one request.
 */
export function BirthdayBanner({
  scope,
  onPress,
  variant = "card",
}: {
  scope: "mine" | "others";
  onPress: () => void;
  /**
   * `card` stands on its own on the page. `strip` is the same row rendered
   * INSIDE the dark attendance card — no fill, no border, no margins of its
   * own, and white ink, because the surface underneath it is already a card.
   */
  variant?: "card" | "strip";
}) {
  const { c, brand, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);
  const { isMine, mine, others } = useTodaysBirthdays();

  /* ── Your own day ───────────────────────────────────────────────────── */

  if (scope === "mine") {
    if (!isMine) return null;
    // The HR record's name first: a login called "Super" belongs to a person
    // whose employee record knows their real name, and the wish should use it.
    const first =
      mine?.name?.trim().split(" ")[0] || me?.first_name?.trim() || "there";

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="It is your birthday. Open birthdays"
        style={({ pressed }) => ({
          marginHorizontal: space.screen,
          marginBottom: space.lg,
          borderRadius: radius.card,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          ...shadow.card,
        })}
      >
        <LinearGradient
          colors={[brand[500], brand[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.card, padding: space.lg }}
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <PartyPopper size={22} strokeWidth={2.2} color="#FFFFFF" />
            </View>

            <View className="flex-1">
              <Text className={`text-white ${T.cardTitle}`} numberOfLines={1}>
                Happy birthday, {first}! 🎉
              </Text>
              <Text
                style={{ color: "rgba(255,255,255,0.85)" }}
                className={`mt-0.5 ${T.micro}`}
                numberOfLines={1}
              >
                The whole team is wishing you today
              </Text>
            </View>

            <ChevronRight
              size={18}
              strokeWidth={2.4}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  /* ── Someone else's ─────────────────────────────────────────────────── */

  if (others.length === 0) return null;

  const warm = toneFor(surface.warning, dark);
  const faces = others.slice(0, FACES);
  const extra = others.length - faces.length;
  const one = others.length === 1;

  // One person: their name and what they do. Several: the count, because at
  // that point the faces ARE the list and a string of first names would just
  // be the same information spelled out badly.
  const lead = others[0];
  const leadName = lead.name?.trim() || "A teammate";
  const leadRole = [lead.designation, lead.department_name]
    .map((v) => v?.trim())
    .filter(
      (v): v is string =>
        Boolean(v) && v!.toLowerCase() !== leadName.toLowerCase(),
    )
    .join(" · ");

  const title = one ? leadName : `${others.length} birthdays`;
  const sub = one && leadRole ? leadRole : "Today is their day 🎉";
  const a11y = one
    ? `${leadName}'s birthday today. Send your wishes`
    : `${others.length} birthdays today. Send your wishes`;

  const strip = variant === "strip";

  /** Ring colour, and the ink the row is written in. */
  const ringColor = strip ? "rgba(255,255,255,0.22)" : dark ? c.card : warm.bg;
  const titleColor = strip ? "#FFFFFF" : c.text;
  const subColor = strip ? "rgba(255,255,255,0.75)" : c.textMuted;
  const buttonInk = strip ? "#FFFFFF" : brand[600];

  const faceStack = (
    /* Overlapping faces, capped at three. Past that the "+n" disc is both
       shorter and more honest than four more half-hidden avatars.
       Nothing sits before them: a cake glyph used to, which meant the row
       opened with two competing circles and the eye had to pick one. */
    <View className="flex-row">
      {faces.map((p, i) => (
        <View
          key={p._id}
          style={{
            marginLeft: i === 0 ? 0 : -11,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: ringColor,
          }}
        >
          <Avatar user={personUser(p)} size={strip ? 30 : 34} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{
            marginLeft: -11,
            width: strip ? 30 : 34,
            height: strip ? 30 : 34,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: ringColor,
            backgroundColor: strip ? "rgba(255,255,255,0.22)" : warm.tint,
          }}
          className="items-center justify-center"
        >
          <Text className={`text-white ${T.count}`} allowFontScaling={false}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const copy = (
    <View className="flex-1">
      <Text
        style={{ color: titleColor }}
        className={T.cardTitleSm}
        numberOfLines={1}
      >
        {title}
      </Text>
      {/* A slight lean on the second line — it is the warm aside, not a data
          field, and the tilt is what separates "today is their day" from the
          punch times sitting right above it.

          Skewed, not `fontStyle: "italic"`: Outfit ships no italic cut, and
          asking for one makes Android silently swap in the SYSTEM italic — a
          different typeface mid-card. An 8° skew keeps the app's own font. */}
      <Text
        style={{
          color: subColor,
          transform: [{ skewX: "-8deg" }],
          // Skew pivots on the baseline's left edge, so the tail of the line
          // drifts right. A hair of left padding keeps it optically aligned
          // with the name above it.
          paddingLeft: 1,
        }}
        className={`mt-0.5 ${T.micro}`}
        numberOfLines={1}
      >
        {sub}
      </Text>
    </View>
  );

  const wish = (
    <View
      style={{
        backgroundColor: strip
          ? "rgba(255,255,255,0.14)"
          : dark
            ? "transparent"
            : c.card,
        // borderWidth: 1,
        // borderColor: strip ? "rgba(255,255,255,0.45)" : brand[600],
        borderRadius: radius.button,
        paddingHorizontal: space.md,
        height: 32,
      }}
      className="flex-row items-center gap-1.5"
    >
      <Gift size={14} strokeWidth={2.2} color={buttonInk} />
      <Text
        style={{ color: buttonInk }}
        className={T.badge}
        allowFontScaling={false}
      >
        Wish
      </Text>
    </View>
  );

  /* ── Inside the attendance card ─────────────────────────────────────── */

  if (strip) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => ({
          marginTop: space.lg + 2,
          paddingTop: space.lg,
          paddingBottom: space.md,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.12)",
          opacity: pressed ? 0.75 : 1,
        })}
        className="flex-row items-center gap-2.5"
      >
        {faceStack}
        {copy}
        {wish}
      </Pressable>
    );
  }

  /* ── On its own, on the page ────────────────────────────────────────── */

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        marginHorizontal: space.screen,
        marginTop: space.lg,
        marginBottom: space.lg,
        backgroundColor: dark ? c.card : warm.bg,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: dark ? c.border : warm.border,
        paddingVertical: space.md,
        paddingHorizontal: space.md + 2,
        opacity: pressed ? 0.9 : 1,
        ...(dark ? shadow.none : shadow.soft),
      })}
      className="flex-row items-center gap-2.5"
    >
      {faceStack}
      {copy}
      {wish}
    </Pressable>
  );
}
