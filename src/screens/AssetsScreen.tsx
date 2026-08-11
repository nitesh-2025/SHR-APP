import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  LifeBuoy,
  ShieldCheck,
  Star,
  TriangleAlert,
} from "lucide-react-native";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, Button, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { useMenuNav } from "../navigation/useMenuNav";
import { useGetAssetsQuery, type AssetRow } from "../store/assetsApi";
import { useGetMyProfileQuery } from "../store/employeesApi";
import { radius, shadow, space, surface, toneFor, type Surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDate } from "../utils/date";

/** Condition, as the backend words it → how it should read. */
const CONDITION_TONE: Record<string, Surface> = {
  new: surface.success,
  good: surface.success,
  fair: surface.warning,
  poor: surface.danger,
  damaged: surface.danger,
};


function Fact({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-1">
      <Text style={{ color: c.textMuted }} className={T.nano} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: c.text }}
        className={`mt-0.5 ${T.cardTitleSm}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function AssetCard({ asset }: { asset: AssetRow }) {
  const { c, dark } = useTheme();
  const tone = CONDITION_TONE[String(asset.condition).toLowerCase()] ?? surface.neutral;
  const well = toneFor(tone, dark);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View
          style={{ backgroundColor: well.bg, borderRadius: radius.well }}
          className="h-11 w-11 items-center justify-center"
        >
          <Boxes size={20} strokeWidth={2} color={well.tint} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              style={{ color: c.text }}
              className={`flex-shrink ${T.cardTitleSm}`}
              numberOfLines={1}
            >
              {asset.name}
            </Text>
            {/* Flagged by IT as high-value — worth knowing before you leave it
                on a desk overnight. */}
            {asset.important ? (
              <Star size={12} strokeWidth={2.6} color={surface.warning.tint} />
            ) : null}
          </View>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {[asset.category, asset.id].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <Badge label={String(asset.condition)} tone={tone} />
      </View>

      <View
        style={{
          backgroundColor: c.fill,
          borderRadius: radius.well,
          paddingHorizontal: space.md,
          paddingVertical: space.sm + 2,
        }}
        className="mt-3 flex-row items-center gap-3"
      >
        <Fact
          label="Assigned"
          value={asset.assignedDate ? fmtDate(asset.assignedDate) : "—"}
        />
        <View style={{ backgroundColor: c.border }} className="h-7 w-px" />
        <Fact label="Serial" value={asset.serialNumber || "—"} />
        <View style={{ backgroundColor: c.border }} className="h-7 w-px" />
        <Fact label="Location" value={asset.location || "—"} />
      </View>

      {asset.warrantyExpiry || asset.insured ? (
        <View className="mt-3 flex-row items-center gap-1.5">
          <ShieldCheck size={12} strokeWidth={2.2} color={c.textFaint} />
          <Text style={{ color: c.textFaint }} className={T.micro} numberOfLines={1}>
            {[
              asset.insured ? "Insured" : null,
              asset.warrantyExpiry
                ? `Warranty to ${fmtDate(asset.warrantyExpiry)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My assets — company property currently in this employee's custody.
 *
 * Read-only by design. The assets API exposes create/return/repair, but every
 * one of those is a custodian-side action that has to be countersigned by IT:
 * letting an employee mark their own laptop "returned" from their phone would
 * put the register out of step with the shelf. Requesting new gear routes to
 * Tickets, which already has an approval trail.
 */
export default function AssetsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand } = useTheme();
  const go = useMenuNav();

  /**
   * `assigned_to_id` is an EMPLOYEE id, not a USER id.
   *
   * The two are different documents in this backend and the app holds both:
   * `selectCurrentUser` is the auth USER, while the asset register's custodian
   * ref carries `employee_id` / `designation` — the Employee shape (compare
   * `ManagerRef` in `employeesApi`). `TeamScreen` documents the same split and
   * bridges it for chat.
   *
   * Filtering by the user id matched nothing, so every employee with a laptop
   * on the register saw "Nothing assigned to you" — an empty list, not an
   * error, so there was nothing to suggest it was wrong.
   */
  const profile = useGetMyProfileQuery();
  const employeeId = profile.data?._id;

  // Skipped rather than fired with an empty id: `assigned_to_id=""` is dropped
  // by most query builders, and the request would come back with the WHOLE
  // company's asset register.
  const list = useGetAssetsQuery(
    { assigned_to_id: employeeId ?? "", limit: 100 },
    { skip: !employeeId },
  );

  const items = list.data ?? [];
  // The profile has to land before the asset query can even be asked.
  const loading = profile.isLoading || list.isLoading;
  const failed = profile.error ?? list.error;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="My Assets"
        subtitle={
          items.length
            ? `${items.length} item${items.length === 1 ? "" : "s"} in your custody`
            : "Company property assigned to you"
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              (list.isFetching && !list.isLoading) ||
              (profile.isFetching && !profile.isLoading)
            }
            onRefresh={() => {
              profile.refetch();
              list.refetch();
            }}
            tintColor={brand[600]}
          />
        }
      >
        {loading ? (
          <>
            <Skeleton height={150} radius={radius.card} />
            <Skeleton height={150} radius={radius.card} />
          </>
        ) : failed ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your assets"
            message={describeApiError(failed).title}
            actionLabel="Try again"
            onAction={() => {
              profile.refetch();
              list.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Boxes size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Nothing assigned to you"
            message="No laptop, phone or other company property is on the register against your name. Need something? Raise a ticket."
            actionLabel="Raise a request"
            onAction={() => go("tickets")}
          />
        ) : (
          items.map((a) => <AssetCard key={a._id} asset={a} />)
        )}

        {/* ── No "Your requests" section, deliberately ────────────────────
            A first pass rendered the employee's own rows from
            `/api/asset-requests` and narrowed them client-side on
            `requester_email`. That slice is the ADMIN list — its `ListArgs`
            accepts only status/search/page/limit, with no requester filter —
            so on any deployment where this token can read the collection, up
            to 50 OTHER employees' rows (name, email, department, stated
            reason, reviewer notes) would land in the device's Redux store and
            in network logs. Filtering the render does not un-fetch the data.

            The section comes back the day the backend grows a `/me` route or
            scopes the list per token. Until then the honest answer is not to
            ask. */}

        {/* The one action this screen offers, and it deliberately leaves the
            screen: there is no create endpoint on `/asset-requests`, and the
            ticket queue already has an approval trail behind it. */}
        {loading || failed ? null : (
          <Button
            label="Request new gear"
            variant="secondary"
            icon={<LifeBuoy size={18} strokeWidth={2} color={brand[700]} />}
            onPress={() => go("tickets")}
            style={{ marginTop: space.sm }}
          />
        )}
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
