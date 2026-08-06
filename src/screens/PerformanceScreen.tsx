import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquareText,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, EmptyState, ProgressBar, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { useMenuNav } from "../navigation/useMenuNav";
import {
  useGetMyReviewsQuery,
  type Kpi,
  type PerformanceReview,
  type RatingLabel,
  type ReviewStatus,
} from "../store/performanceApi";
import { radius, shadow, space, surface, toneFor, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDate } from "../utils/date";

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

const RATING: Record<RatingLabel, { label: string; tone: Surface }> = {
  outstanding: { label: "Outstanding", tone: surface.success },
  exceeds: { label: "Exceeds expectations", tone: surface.success },
  meets: { label: "Meets expectations", tone: surface.info },
  needs_improvement: { label: "Needs improvement", tone: surface.warning },
  unsatisfactory: { label: "Unsatisfactory", tone: surface.danger },
};

const STATUS: Record<ReviewStatus, { label: string; tone: Surface }> = {
  draft: { label: "In progress", tone: surface.neutral },
  submitted: { label: "Submitted", tone: surface.info },
  reviewed: { label: "Reviewed", tone: surface.info },
  finalized: { label: "Final", tone: surface.success },
};

/**
 * A draft belongs to the reviewer, not the reviewed.
 *
 * `/performance/me` decides what this employee may see, and it does return
 * drafts — a cycle their manager has opened but not finished. Showing a live
 * 2.4/5 out of a half-written form is how someone spends a weekend worrying
 * about a number that was never final. The row still appears, so the cycle is
 * not a surprise later; the score does not.
 */
const isScoreVisible = (r: PerformanceReview) => r.status !== "draft";

/** 0–5 → 0–1, clamped. A malformed score should flatten, never overflow the bar. */
const asFraction = (score: number) =>
  Math.min(1, Math.max(0, (Number.isFinite(score) ? score : 0) / 5));

/* ── KPI row ──────────────────────────────────────────────────────────────── */

function KpiRow({ kpi }: { kpi: Kpi }) {
  const { c, dark } = useTheme();

  // The bar is coloured by how the KPI actually landed, using the same
  // thresholds the server's own rating labels imply — a green bar under a
  // 1.5/5 would contradict the badge at the top of the card.
  const tone =
    kpi.score >= 4
      ? surface.success
      : kpi.score >= 3
        ? surface.info
        : kpi.score >= 2
          ? surface.warning
          : surface.danger;
  const t = toneFor(tone, dark);

  return (
    <View>
      <View className="flex-row items-baseline gap-2">
        <Text
          style={{ color: c.text }}
          className={`flex-1 ${T.cardTitleSm}`}
          numberOfLines={2}
        >
          {kpi.name}
        </Text>
        <Text
          style={{ color: c.textFaint }}
          className={T.micro}
          allowFontScaling={false}
        >
          {kpi.weight}%
        </Text>
        <Text
          style={{ color: t.text }}
          className={T.cardTitleSm}
          allowFontScaling={false}
        >
          {kpi.score}/5
        </Text>
      </View>

      <View className="mt-2">
        <ProgressBar value={asFraction(kpi.score)} color={t.tint} height={6} />
      </View>

      {/* Target vs achieved only when BOTH exist — "Target: 40 · Achieved: —"
          is a row that costs a line and says nothing. */}
      {kpi.target && kpi.achieved ? (
        <Text style={{ color: c.textMuted }} className={`mt-1.5 ${T.micro}`}>
          Target {kpi.target} · Achieved {kpi.achieved}
        </Text>
      ) : null}

      {kpi.remarks ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-1 leading-[18px] ${T.micro}`}
        >
          {kpi.remarks}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Note block ───────────────────────────────────────────────────────────── */

function Note({
  icon,
  label,
  body,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
  tone: Surface;
}) {
  const { c, dark } = useTheme();
  const t = toneFor(tone, dark);

  return (
    <View
      style={{ backgroundColor: t.bg, borderRadius: radius.well - 4, padding: space.md }}
      className="flex-row gap-2.5"
    >
      <View style={{ marginTop: 1 }}>{icon}</View>
      <View className="flex-1">
        <Text style={{ color: t.text }} className={T.nano}>
          {label}
        </Text>
        <Text style={{ color: c.text }} className={`mt-0.5 leading-[20px] ${T.secondary}`}>
          {body}
        </Text>
      </View>
    </View>
  );
}

/* ── Review card ──────────────────────────────────────────────────────────── */

function ReviewCard({
  review,
  open,
  onToggle,
}: {
  review: PerformanceReview;
  open: boolean;
  onToggle: () => void;
}) {
  const { c, dark } = useTheme();

  const status = STATUS[review.status] ?? STATUS.draft;
  const rating = RATING[review.rating];
  const showScore = isScoreVisible(review);
  const kpis = review.kpis ?? [];

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      {/* The summary is never itself tappable — the expand control below is,
          and only when there is something behind it to reveal. A card that
          looks pressable but is not reads as broken. */}
      <View style={{ padding: space.lg }}>
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
              {review.period}
            </Text>
            <Text
              style={{ color: c.textMuted }}
              className={`mt-0.5 ${T.micro}`}
              numberOfLines={1}
            >
              {[
                review.period_type?.replace(/_/g, " "),
                review.cycle_start && review.cycle_end
                  ? `${fmtDate(review.cycle_start)} – ${fmtDate(review.cycle_end)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          <Badge label={status.label} tone={status.tone} />
        </View>

        {showScore ? (
          <View className="mt-3 flex-row items-center gap-3">
            <Text
              style={{ color: c.text }}
              className={T.kpi}
              allowFontScaling={false}
            >
              {review.overall_score?.toFixed(1) ?? "—"}
            </Text>
            <Text style={{ color: c.textFaint }} className={T.secondary}>
              / 5
            </Text>
            <View className="flex-1 items-end">
              {rating ? <Badge label={rating.label} tone={rating.tone} /> : null}
            </View>
          </View>
        ) : (
          <Text style={{ color: c.textMuted }} className={`mt-3 ${T.secondary}`}>
            Your manager is still writing this review. The score appears once it
            is submitted.
          </Text>
        )}

        {review.reviewer_name ? (
          <Text style={{ color: c.textFaint }} className={`mt-2 ${T.micro}`}>
            Reviewed by {review.reviewer_name}
            {review.reviewed_at ? ` · ${fmtDate(review.reviewed_at)}` : ""}
          </Text>
        ) : null}
      </View>

      {/* `comments` belongs in this test too. Every one of the four is optional
          on the wire, and a finalized review whose reviewer wrote only free-text
          comments — no KPIs, no strengths, no improvements — rendered a card
          with no expand control at all, so the one thing they DID write was
          unreachable. */}
      {showScore &&
      (kpis.length > 0 ||
        review.strengths ||
        review.improvements ||
        review.comments) ? (
        <>
          <View style={{ backgroundColor: c.border }} className="h-px" />

          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={
              open ? "Hide the detail" : `Show ${kpis.length} KPIs and notes`
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="h-12 flex-row items-center justify-center gap-1.5"
          >
            <Text style={{ color: c.textMuted }} className={T.buttonSm}>
              {open
                ? "Hide detail"
                : kpis.length
                  ? `${kpis.length} KPIs · show detail`
                  : "Show reviewer's notes"}
            </Text>
            {open ? (
              <ChevronUp size={15} strokeWidth={2.2} color={c.textMuted} />
            ) : (
              <ChevronDown size={15} strokeWidth={2.2} color={c.textMuted} />
            )}
          </Pressable>

          {open ? (
            <View style={{ padding: space.lg, paddingTop: 0, gap: space.lg }}>
              {kpis.map((k, i) => (
                <KpiRow key={`${k.name}-${i}`} kpi={k} />
              ))}

              {review.strengths ? (
                <Note
                  icon={
                    <TrendingUp
                      size={13}
                      strokeWidth={2.2}
                      color={surface.success.tint}
                    />
                  }
                  label="Strengths"
                  body={review.strengths}
                  tone={surface.success}
                />
              ) : null}

              {review.improvements ? (
                <Note
                  icon={
                    <Lightbulb
                      size={13}
                      strokeWidth={2.2}
                      color={surface.warning.tint}
                    />
                  }
                  label="Where to improve"
                  body={review.improvements}
                  tone={surface.warning}
                />
              ) : null}

              {review.comments ? (
                <Note
                  icon={
                    <MessageSquareText
                      size={13}
                      strokeWidth={2.2}
                      color={surface.info.tint}
                    />
                  }
                  label="Reviewer's comments"
                  body={review.comments}
                  tone={surface.info}
                />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

const HERO_HEIGHT = 168;
const RING = 92;
const RING_STROKE = 9;

/**
 * The most recent review that has a real score behind it.
 *
 * "Latest" is the one the employee cares about, and a hero showing a draft's
 * placeholder would be the loudest possible place to show a number that is not
 * final yet.
 */
function LatestHero({
  review,
  width,
}: {
  review: PerformanceReview;
  width: number;
}) {
  const { brand } = useTheme();

  const pct = asFraction(review.overall_score);
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const rating = RATING[review.rating];

  return (
    <LinearGradient
      colors={[brand[600], brand[800]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: HERO_HEIGHT,
        borderRadius: radius.card,
        paddingHorizontal: space.xl,
        justifyContent: "center",
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      {/* Same arc ornament as the other filled cards — three of these in the
          app now, all speaking the same language. */}
      <View
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <Svg width={width} height={HERO_HEIGHT}>
          {[0.42, 0.6, 0.8].map((rr, i) => (
            <Circle
              key={rr}
              cx={width * 0.92}
              cy={HERO_HEIGHT * 0.9}
              r={width * rr}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={1.2}
              strokeOpacity={0.2 - i * 0.05}
            />
          ))}
        </Svg>
      </View>

      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text
            className={`text-white/85 ${T.badge}`}
            style={{ letterSpacing: 0.6 }}
            allowFontScaling={false}
          >
            LATEST REVIEW
          </Text>

          <Text className={`mt-1.5 text-white ${T.cardTitle}`} numberOfLines={1}>
            {review.period}
          </Text>

          {rating ? (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: radius.pill,
              }}
              className="mt-2 self-start px-2.5 py-1"
            >
              <Text className={`text-white ${T.badge}`} numberOfLines={1}>
                {rating.label}
              </Text>
            </View>
          ) : null}

          {review.reviewer_name ? (
            <Text className={`mt-2 text-white/75 ${T.micro}`} numberOfLines={1}>
              by {review.reviewer_name}
            </Text>
          ) : null}
        </View>

        {/* Amber arc, as on every other hero: against a deep green fill it is
            the one accent that reads without introducing a second status hue. */}
        <View style={{ width: RING, height: RING }}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke="#FBBF24"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - pct)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View
            style={{ position: "absolute", inset: 0 }}
            className="items-center justify-center"
          >
            <Text className={`text-white ${T.kpiSm}`} allowFontScaling={false}>
              {review.overall_score?.toFixed(1) ?? "—"}
            </Text>
            <Text className={`text-white/75 ${T.nano}`}>of 5</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My Performance — every review cycle this employee has been through.
 *
 * Read-only, and only ever `/performance/me`. The same slice exposes
 * create/update/delete and an org-wide `/` list, all of which are the reviewer
 * console's business: an employee editing their own KPI scores from a phone is
 * not a feature.
 */
export default function PerformanceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand } = useTheme();
  const { width } = useWindowDimensions();
  const go = useMenuNav();

  const reviews = useGetMyReviewsQuery({ limit: 50 });
  const [openId, setOpenId] = useState<string | null>(null);

  /** Newest first — the server's order is not guaranteed. */
  const items = useMemo(() => {
    const list = [...(reviews.data?.items ?? [])];
    return list.sort((a, b) =>
      String(b.cycle_start ?? b.createdAt ?? "").localeCompare(
        String(a.cycle_start ?? a.createdAt ?? ""),
      ),
    );
  }, [reviews.data]);

  const latest = useMemo(() => items.find(isScoreVisible), [items]);

  /** Trend across scored cycles — one line, only when there is a line to draw. */
  const average = useMemo(() => {
    const scored = items.filter(isScoreVisible);
    if (!scored.length) return null;
    const sum = scored.reduce((n, r) => n + (r.overall_score ?? 0), 0);
    return { value: sum / scored.length, count: scored.length };
  }, [items]);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="My Performance"
        subtitle={
          items.length
            ? `${items.length} review cycle${items.length === 1 ? "" : "s"}`
            : "Your review history"
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={reviews.isFetching && !reviews.isLoading}
            onRefresh={() => reviews.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {reviews.isLoading ? (
          <>
            <Skeleton height={HERO_HEIGHT} radius={radius.card} />
            <Skeleton height={140} radius={radius.card - 4} />
            <Skeleton height={140} radius={radius.card - 4} />
          </>
        ) : reviews.error ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your reviews"
            message={describeApiError(reviews.error).title}
            actionLabel="Try again"
            onAction={() => reviews.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Target size={32} strokeWidth={1.6} color={brand[600]} />}
            title="No reviews yet"
            message="Once your manager runs a review cycle for you, the KPIs, scores and their notes all land here."
          />
        ) : (
          <>
            {latest ? <LatestHero review={latest} width={width - space.screen * 2} /> : null}

            {average && average.count > 1 ? (
              <View
                style={{ backgroundColor: c.fill, borderRadius: radius.well }}
                className="flex-row items-center gap-2.5 px-4 py-3"
              >
                <TrendingUp size={15} strokeWidth={2.2} color={c.textMuted} />
                <Text style={{ color: c.textMuted }} className={`flex-1 ${T.secondary}`}>
                  Averaging{" "}
                  <Text style={{ color: c.text }} className={T.cardTitleSm}>
                    {average.value.toFixed(1)}
                  </Text>{" "}
                  across {average.count} scored cycles.
                </Text>
              </View>
            ) : null}

            <Text style={{ color: c.text }} className={T.section}>
              All cycles
            </Text>

            {items.map((r) => (
              <ReviewCard
                key={r._id}
                review={r}
                open={openId === r._id}
                onToggle={() => setOpenId(openId === r._id ? null : r._id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
