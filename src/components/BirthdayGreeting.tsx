import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";

import { space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDayShort } from "../utils/date";

/**
 * The one day a year the header stops being chrome.
 *
 * `Good evening,` is a lead-in — deliberately quiet, because on 364 days the
 * thing worth reading is the name under it. On a birthday that ranking is
 * wrong: the wish IS the message, so it takes the big line and the name moves
 * under it, and the whole band picks up colour it never otherwise has.
 *
 * The palette is warm rather than the brand green on purpose. Green is what
 * every other surface in the app already uses to mean "on duty / approved /
 * present"; a wish rendered in it would read as one more status.
 */
const SKIN = {
  light: {
    /**
     * Runs the height of the SCREEN, not of the header.
     *
     * Painting only the band left a hard seam where the wash met the grey
     * canvas — the celebration stopped mid-scroll and the page went back to
     * being a normal Tuesday underneath it. The colour settles into a warm
     * off-white by the third stop, so the cards below still read as cards on
     * paper rather than as tiles on a pink poster.
     */
    wash: ["#FFE4E6", "#FFF1EE", "#FFF9F6"] as const,
    stops: [0, 0.55, 1] as const,
    wish: "#E11D48",
    name: "#9F1239",
    meta: "#BE123C",
    chip: "rgba(255,255,255,0.72)",
    rope: "#E7A3AE",
  },
  dark: {
    wash: ["#3F1D2B", "#2A1A20", "#191819"] as const,
    stops: [0, 0.55, 1] as const,
    wish: "#FDA4AF",
    name: "#FECDD3",
    meta: "#FDA4AF",
    chip: "rgba(255,255,255,0.10)",
    rope: "#8C5A66",
  },
};

/** Balloon body colours, straight off the reference. */
const BALLOONS = [
  { x: 14, fill: "#F472B6" },
  { x: 39, fill: "#FBBF24" },
  { x: 64, fill: "#60A5FA" },
];

/**
 * Decoration, drawn rather than typed.
 *
 * Three 🎈 emoji would all have come out the same red — the emoji font picks
 * the colour, not us — and the reference is three DIFFERENT balloons. At this
 * size that is the whole charm of it, so they are shapes.
 */
function Balloons({ rope }: { rope: string }) {
  return (
    <Svg width={78} height={58} viewBox="0 0 78 58">
      {BALLOONS.map((b) => (
        <G key={b.fill}>
          {/* String first, so the knot laps over where it starts. */}
          <Path
            d={`M${b.x} 29 C ${b.x - 5} 37, ${b.x + 5} 44, ${b.x} 53`}
            stroke={rope}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse cx={b.x} cy={14} rx={9.5} ry={12} fill={b.fill} />
          <Path
            d={`M${b.x - 3} 25 L ${b.x + 3} 25 L ${b.x} 30 Z`}
            fill={b.fill}
          />
        </G>
      ))}
    </Svg>
  );
}

/**
 * The screen's canvas on a birthday — and the ordinary one every other day.
 *
 * The wrapper takes `active` rather than the screen picking between two roots,
 * so the whole subtree underneath (scroll view, bottom bar, sheets) is written
 * once. A screen that branches at its root ends up with two copies of its own
 * body, and they drift.
 */
export function BirthdayBackdrop({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { c, dark } = useTheme();
  const skin = dark ? SKIN.dark : SKIN.light;

  if (!active) {
    return (
      <View style={{ backgroundColor: c.bg }} className="flex-1">
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={skin.wash}
      locations={skin.stops}
      start={{ x: 0, y: 0 }}
      // Ends barely a third of the way down: past that the page is the last
      // stop, flat. A wash stretched over the full height would still be
      // visibly pink behind the leave cards at the bottom of a long scroll.
      end={{ x: 0.9, y: 0.32 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * The birthday header band — the greeting row, re-dressed.
 *
 * Draws no background of its own: the backdrop above already colours the whole
 * page, and a second gradient stacked on it was exactly the hard seam that made
 * the celebration look like it stopped at the header's bottom edge.
 *
 * Takes the header's right-hand controls as a prop instead of owning them: the
 * bell and the avatar are the same two buttons on every day of the year, and a
 * birthday copy of them would be two things to keep in step.
 */
export function BirthdayGreeting({
  name,
  dob,
  paddingTop,
  right,
}: {
  name: string;
  /** Date of birth, for the "08 Aug" stamp. Omitted if the API did not send it. */
  dob?: string;
  paddingTop: number;
  right: ReactNode;
}) {
  const { dark } = useTheme();
  const skin = dark ? SKIN.dark : SKIN.light;
  const day = dob ? fmtDayShort(dob) : "";

  return (
    <View
      style={{
        paddingTop,
        paddingHorizontal: space.screen,
        paddingBottom: space.xl,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {/* 22px, not the 28px the name usually gets: "Happy Birthday!" is
              more than twice as long as a first name, and at 28 it wrapped
              against the buttons on a 360dp screen. */}
          <Text
            style={{ color: skin.wish, fontSize: 22, lineHeight: 28 }}
            className="font-display"
            numberOfLines={1}
          >
            Happy Birthday!
          </Text>

          <Text
            style={{ color: skin.name }}
            className={`mt-0.5 ${T.cardTitle}`}
            numberOfLines={1}
          >
            {name} 🎂
          </Text>
        </View>
        <View style={{ marginTop: space.sm }} className="items-end">
          {right}
          {/* <View style={{ marginTop: space.sm, opacity: 0.95 }}>
            <Balloons rope={skin.rope} />
          </View> */}
        </View>
      </View>
    </View>
  );
}
