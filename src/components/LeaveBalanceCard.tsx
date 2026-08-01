import { ScrollView, Text, View } from "react-native";

import { ProgressBar, Skeleton } from "./ui";
import { describeApiError } from "../lib/apiError";
import { useGetMyBalanceQuery, type LeaveBucket } from "../store/leaveApi";
import { radius, shadow, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Remaining leave per bucket — `GET /leaves/me/balance`.
 *
 * A horizontal strip of tinted cards: the buckets are compared against each
 * other, and each one is a glance ("how many do I have left"), not a paragraph.
 */
export function BalanceTile({
  label,
  bucket,
  tone,
  /** `filled` = solid accent with white type. Use it for the lead bucket only. */
  variant = "tint",
  width = 168,
}: {
  label: string;
  bucket?: LeaveBucket;
  tone: Surface;
  variant?: "filled" | "tint";
  width?: number;
}) {
  const { c, dark } = useTheme();
  const allocated = bucket?.allocated ?? 0;
  const available = bucket?.available ?? 0;
  // Guard the divide: a bucket with nothing allocated reads as empty, not NaN.
  const pct = allocated > 0 ? available / allocated : 0;

  const filled = variant === "filled";
  // Dark mode drops the pastel fills — a tint that reads as "soft" on white
  // reads as "muddy" on a dark surface.
  const bg = filled ? tone.tint : dark ? c.card : tone.bg;
  // A tinted tile on a white-smoke canvas needs its own edge; the filled one
  // already has maximum contrast and a border would only muddy it.
  const borderColor = filled ? "transparent" : dark ? c.border : tone.border;
  const labelColor = filled
    ? "rgba(255,255,255,0.85)"
    : dark
      ? c.textMuted
      : tone.text;
  const valueColor = filled ? "#FFFFFF" : c.text;
  const subColor = filled ? "rgba(255,255,255,0.75)" : c.textMuted;

  return (
    <View
      style={{
        width,
        backgroundColor: bg,
        borderRadius: radius.card,
        borderWidth: filled ? 0 : 1,
        borderColor,
        paddingHorizontal: space.lg,
        paddingTop: space.lg,
        paddingBottom: space.lg,
        // No shadow. Inside a horizontal ScrollView the blur was being clipped
        // by the scroll frame, which cropped the bottom corners and made the
        // tiles look pressed into the canvas.
        ...shadow.none,
      }}
    >
      <Text
        style={{ color: labelColor }}
        className="font-ui-semibold text-[12.5px]"
        numberOfLines={1}
      >
        {label}
      </Text>

      <View className="mt-1.5 flex-row items-baseline">
        <Text
          style={{ color: valueColor }}
          className="font-display text-[26px] leading-8"
        >
          {available}
        </Text>
        <Text
          style={{ color: subColor }}
          className="ml-1 font-ui-regular text-[13px]"
        >
          / {allocated}
        </Text>
      </View>

      <Text style={{ color: subColor }} className="font-ui-regular text-[11px]">
        Days Available
      </Text>

      {/* Hairline-thin: at 100% a thick bar reads as a coloured block glued to
          the card rather than as progress. */}
      <View className="mt-3">
        <ProgressBar
          value={pct}
          color={filled ? "#FFFFFF" : tone.tint}
          height={5}
          track={filled ? "rgba(255,255,255,0.28)" : undefined}
        />
      </View>
    </View>
  );
}

/**
 * The buckets to show, in order, and how each is styled.
 *
 * Driven by what the API actually returns rather than hard-coded to two tiles:
 * `/leave/me/balance` currently answers with `el` and `sl` only, so a "Casual"
 * tile would render as a permanent 0 / 0. Add `cl` server-side and it appears
 * here on its own — no client change.
 */
const BUCKETS: {
  key: string;
  label: string;
  tone?: Surface;
  variant?: "filled" | "tint";
}[] = [
  { key: "el", label: "Annual Leave", variant: "filled" },
  { key: "sl", label: "Sick Leave", tone: surface.purple },
  { key: "cl", label: "Casual Leave", tone: surface.warning },
  { key: "ml", label: "Maternity Leave", tone: surface.info },
];

/** Tiles for every bucket the server actually sent, in the order above. */
export function useBalanceTiles(data: unknown) {
  const map = (data ?? {}) as Record<string, LeaveBucket | undefined>;
  return BUCKETS.filter((b) => map[b.key]).map((b) => ({
    ...b,
    bucket: map[b.key],
  }));
}

export function LeaveBalanceCard() {
  const { c, primary } = useTheme();
  const { data, isLoading, error } = useGetMyBalanceQuery();
  const tiles = useBalanceTiles(data);

  if (isLoading) {
    return (
      <View
        className="flex-row"
        style={{ paddingHorizontal: space.screen, gap: space.md }}
      >
        <Skeleton height={124} width={168} radius={radius.card} />
        <Skeleton height={124} width={168} radius={radius.card} />
      </View>
    );
  }

  if (error) {
    return (
      <Text
        style={{ color: c.textMuted, paddingHorizontal: space.screen }}
        className="font-ui-regular text-[13px]"
      >
        {describeApiError(error).title}
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: space.screen,
        gap: space.md,
        borderRadius: 0,
        paddingBottom: space.md,
      }}
      className="mt-3"
    >
      {tiles.map((t) => (
        <BalanceTile
          key={t.key}
          label={t.label}
          bucket={t.bucket}
          tone={t.tone ?? primary}
          variant={t.variant}
        />
      ))}
    </ScrollView>
  );
}
