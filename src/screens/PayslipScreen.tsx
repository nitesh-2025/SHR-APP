import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Info, Receipt, TriangleAlert, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import {
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
import { Badge, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { useMenuNav } from "../navigation/useMenuNav";
import { useGetMyProfileQuery } from "../store/employeesApi";
import {
  useGetMyDeductionsQuery,
  type DeductionStatus,
  type SalaryDeduction,
} from "../store/salaryDeductionApi";
import { radius, shadow, space, surface, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDate, MONTHS_LONG } from "../utils/date";

const STATUS: Record<DeductionStatus, { label: string; tone: Surface }> = {
  draft: { label: "Provisional", tone: surface.warning },
  finalized: { label: "Applied", tone: surface.danger },
  waived: { label: "Waived off", tone: surface.success },
};

/**
 * `₹1,20,000` — the Indian grouping, not the Western one.
 *
 * `Intl.NumberFormat` with `en-IN` gets this right on both platforms in Hermes,
 * and hand-rolling lakh/crore grouping is exactly the sort of thing that ships
 * one wrong comma to production.
 */
function inr(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

/** `"2026-08"` → `"August 2026"`. */
function monthLabel(month?: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month ?? ""));
  if (!m) return month ?? "—";
  const idx = Number(m[2]) - 1;
  return `${MONTHS_LONG[idx] ?? m[2]} ${m[1]}`;
}

/* ── Deduction row ────────────────────────────────────────────────────────── */

function DeductionCard({ item }: { item: SalaryDeduction }) {
  const { c, dark } = useTheme();
  const status = STATUS[item.status] ?? STATUS.draft;

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        // A waived deduction is history that did NOT cost anything — it stays
        // on the list for the audit trail, but it should not read as live.
        opacity: item.status === "waived" ? 0.72 : 1,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
            {monthLabel(item.month)}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {item.unauthorized_days} unauthorised day
            {item.unauthorized_days === 1 ? "" : "s"} · window{" "}
            {fmtDate(item.window_from)} – {fmtDate(item.window_to)}
          </Text>
        </View>

        <View className="items-end">
          <Text
            style={{ color: c.text }}
            className={T.cardTitle}
            allowFontScaling={false}
          >
            −{inr(item.amount)}
          </Text>
          <View className="mt-1">
            <Badge label={status.label} tone={status.tone} />
          </View>
        </View>
      </View>

      {item.reason ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-2.5 leading-5 ${T.secondary}`}
          numberOfLines={3}
        >
          {item.reason}
        </Text>
      ) : null}

      {item.unauthorized_dates?.length ? (
        <Text style={{ color: c.textFaint }} className={`mt-2 ${T.micro}`} numberOfLines={2}>
          {item.unauthorized_dates.slice(0, 8).map(fmtDate).join(", ")}
          {item.unauthorized_dates.length > 8
            ? ` +${item.unauthorized_dates.length - 8} more`
            : ""}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

const HERO_HEIGHT = 152;

/**
 * Salary — the CTC on file plus every month-closing deduction raised against it.
 *
 * NOT a payslip generator. The backend has no payroll run behind it, so this
 * screen shows the two things it genuinely knows: what your package is, and
 * what has been docked from it and why. Inventing a "net pay" figure out of
 * CTC ÷ 12 minus deductions would be a number nobody's bank statement matches.
 */
export default function PayslipScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const { width } = useWindowDimensions();
  const go = useMenuNav();

  const profile = useGetMyProfileQuery();
  const deductions = useGetMyDeductionsQuery({ limit: 24 });

  const items = useMemo(() => deductions.data?.items ?? [], [deductions.data]);

  /** Only what actually cost money — a waived row is not a deduction. */
  const chargedThisYear = useMemo(() => {
    const year = String(new Date().getFullYear());
    return items
      .filter((d) => d.status !== "waived" && String(d.month).startsWith(year))
      .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  }, [items]);

  const salary = profile.data?.salary;
  const heroWidth = width - space.screen * 2;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Salary"
        subtitle="Package and deductions"
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
            refreshing={
              (deductions.isFetching && !deductions.isLoading) ||
              (profile.isFetching && !profile.isLoading)
            }
            onRefresh={() => {
              deductions.refetch();
              profile.refetch();
            }}
            tintColor={brand[600]}
          />
        }
      >
        {/* ── Package ────────────────────────────────────────────────────── */}
        {profile.isLoading ? (
          <Skeleton height={HERO_HEIGHT} radius={radius.card} />
        ) : profile.error ? (
          /* A failed fetch must not wear the hero's clothes.
             Without this branch a 401 or a 500 rendered the full gradient card
             reading "ANNUAL CTC — Not on file": a transport error presented to
             the employee as an authoritative statement that HR holds no salary
             for them. */
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your package"
            message={describeApiError(profile.error).title}
            actionLabel="Try again"
            onAction={() => profile.refetch()}
          />
        ) : (
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
            <View
              style={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                overflow: "hidden",
              }}
            >
              <Svg width={heroWidth} height={HERO_HEIGHT}>
                {[0.42, 0.6, 0.8].map((r, i) => (
                  <Circle
                    key={r}
                    cx={heroWidth * 0.92}
                    cy={HERO_HEIGHT * 0.9}
                    r={heroWidth * r}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={1.2}
                    strokeOpacity={0.2 - i * 0.05}
                  />
                ))}
              </Svg>
            </View>

            <Text
              className={`text-white/85 ${T.badge}`}
              style={{ letterSpacing: 0.6 }}
              allowFontScaling={false}
            >
              ANNUAL CTC
            </Text>
            <Text
              className={`mt-1.5 text-white ${T.kpi}`}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {salary?.ctc ? inr(salary.ctc) : "Not on file"}
            </Text>

            <View
              style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" }}
              className="mt-3 flex-row items-center pt-3"
            >
              <View className="flex-1">
                <Text className={`text-white ${T.cardTitleSm}`} numberOfLines={1}>
                  {salary?.basic ? inr(salary.basic) : "—"}
                </Text>
                <Text className={`mt-0.5 text-white/75 ${T.nano}`}>Basic</Text>
              </View>
              <View
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                className="h-7 w-px"
              />
              <View className="flex-1 items-center">
                <Text className={`text-white ${T.cardTitleSm}`} numberOfLines={1}>
                  {salary?.pay_frequency ?? "Monthly"}
                </Text>
                <Text className={`mt-0.5 text-white/75 ${T.nano}`}>Paid</Text>
              </View>
              <View
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                className="h-7 w-px"
              />
              <View className="flex-1 items-end">
                <Text className={`text-white ${T.cardTitleSm}`} numberOfLines={1}>
                  {chargedThisYear > 0 ? `−${inr(chargedThisYear)}` : "None"}
                </Text>
                <Text className={`mt-0.5 text-white/75 ${T.nano}`}>Docked YTD</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ── What this screen is not ────────────────────────────────────
            Said once, plainly, so nobody hunts for a download button that was
            never built. */}
        <View
          style={{
            backgroundColor: c.fill,
            borderRadius: radius.well,
          }}
          className="flex-row items-start gap-2.5 px-4 py-3"
        >
          <Info size={15} strokeWidth={2} color={c.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ color: c.textMuted }} className={`flex-1 leading-5 ${T.secondary}`}>
            Monthly payslip PDFs are issued by Finance over email. This screen
            shows the package HR holds on record and any deductions raised
            against it.
          </Text>
        </View>

        {/* ── Deductions ─────────────────────────────────────────────────── */}
        <Text style={{ color: c.text }} className={T.section}>
          Deductions
        </Text>

        {deductions.isLoading ? (
          <>
            <Skeleton height={110} radius={radius.card} />
            <Skeleton height={110} radius={radius.card} />
          </>
        ) : deductions.error ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your deductions"
            message={describeApiError(deductions.error).title}
            actionLabel="Try again"
            onAction={() => deductions.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Wallet size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Nothing has been docked"
            message="No unauthorised absence has been charged against your salary. Keep it that way."
          />
        ) : (
          <View style={{ gap: space.md }}>
            {items.map((d) => (
              <DeductionCard key={d._id} item={d} />
            ))}
          </View>
        )}

        <View className="flex-row items-center gap-1.5">
          <Receipt size={12} strokeWidth={2.2} color={c.textFaint} />
          <Text style={{ color: c.textFaint }} className={T.micro}>
            Think a deduction is wrong? Raise a ticket — do not wait for payday.
          </Text>
        </View>
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
