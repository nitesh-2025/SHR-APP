import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  LifeBuoy,
  ShieldCheck,
  Star,
  TriangleAlert,
} from "lucide-react-native";
import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, Button, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { useMenuNav } from "../navigation/useMenuNav";
import { selectCurrentUser, useAppSelector } from "../store";
import {
  useGetAssetRequestsQuery,
  type AssetRequest,
} from "../store/assetRequestsApi";
import { useGetAssetsQuery, type AssetRow } from "../store/assetsApi";
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

const REQUEST_TONE: Record<string, { label: string; tone: Surface }> = {
  pending: { label: "Pending", tone: surface.warning },
  approved: { label: "Approved", tone: surface.info },
  fulfilled: { label: "Fulfilled", tone: surface.success },
  rejected: { label: "Rejected", tone: surface.purple },
  cancelled: { label: "Cancelled", tone: surface.neutral },
};

const URGENCY_TONE: Record<string, Surface> = {
  low: surface.neutral,
  medium: surface.info,
  high: surface.danger,
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
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View
          style={{ backgroundColor: well.bg, borderRadius: radius.well - 2 }}
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
          borderRadius: radius.well - 4,
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

/* ── Request row ──────────────────────────────────────────────────────────── */

function RequestCard({ request }: { request: AssetRequest }) {
  const { c, dark } = useTheme();
  const status = REQUEST_TONE[String(request.status).toLowerCase()] ?? {
    label: request.status,
    tone: surface.neutral,
  };
  const urgency = URGENCY_TONE[String(request.urgency).toLowerCase()];

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
            {request.quantity > 1 ? `${request.quantity} × ` : ""}
            {request.item}
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mt-0.5 ${T.micro}`}
            numberOfLines={1}
          >
            {[
              request.category,
              `Raised ${fmtDate(request.createdAt)}`,
              request.needed_by ? `Needed by ${fmtDate(request.needed_by)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <Badge label={status.label} tone={status.tone} />
      </View>

      {request.reason ? (
        <Text
          style={{ color: c.textMuted }}
          className={`mt-2.5 leading-5 ${T.secondary}`}
          numberOfLines={2}
        >
          {request.reason}
        </Text>
      ) : null}

      <View className="mt-3 flex-row items-center gap-2">
        {urgency ? <Badge label={`${request.urgency} urgency`} tone={urgency} /> : null}
      </View>

      {/* The reviewer's verdict, in their words. A bare "Rejected" chip with no
          reason is the fastest way to generate a follow-up ticket. */}
      {request.review_note ? (
        <View
          style={{
            backgroundColor: toneFor(status.tone, dark).bg,
            borderRadius: radius.well - 4,
            padding: space.md,
          }}
          className="mt-3"
        >
          <Text style={{ color: toneFor(status.tone, dark).text }} className={T.nano}>
            Reviewer
          </Text>
          <Text style={{ color: c.text }} className={`mt-0.5 ${T.secondary}`}>
            {request.review_note}
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
  const user = useAppSelector(selectCurrentUser);
  const go = useMenuNav();

  // Skipped rather than fired with an empty id: `assigned_to_id=""` is dropped
  // by most query builders, and the request would come back with the WHOLE
  // company's asset register.
  const list = useGetAssetsQuery(
    { assigned_to_id: user?._id ?? "", limit: 100 },
    { skip: !user?._id },
  );

  const items = list.data ?? [];

  /**
   * Requests raised for this employee.
   *
   * `/asset-requests` takes no `requester_id` filter, so the narrowing happens
   * here on email. That is a DISPLAY filter, not a security boundary — the
   * backend still decides what it hands back for this token, exactly as it does
   * for the ticket queue. If the server ever widens that, this screen shows
   * fewer rows rather than more.
   */
  const requestsQuery = useGetAssetRequestsQuery(
    { limit: 50 },
    { skip: !user?.email },
  );

  const requests = useMemo(() => {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return [];
    return (requestsQuery.data?.items ?? []).filter(
      (r) => r.requester_email?.trim().toLowerCase() === email,
    );
  }, [requestsQuery.data, user?.email]);

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
            refreshing={list.isFetching && !list.isLoading}
            onRefresh={() => list.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {list.isLoading ? (
          <>
            <Skeleton height={150} radius={radius.card - 4} />
            <Skeleton height={150} radius={radius.card - 4} />
          </>
        ) : list.error ? (
          <EmptyState
            icon={<TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Could not load your assets"
            message={describeApiError(list.error).title}
            actionLabel="Try again"
            onAction={() => list.refetch()}
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

        {/* ── Requests ───────────────────────────────────────────────────
            Only when there are some. An "Open requests (0)" heading on a
            screen that cannot create one is a dead section. */}
        {requests.length > 0 ? (
          <>
            <Text style={{ color: c.text }} className={`mt-2 ${T.section}`}>
              Your requests
            </Text>
            {requests.map((r) => (
              <RequestCard key={r._id} request={r} />
            ))}
          </>
        ) : null}

        {/* The one action this screen offers, and it deliberately leaves the
            screen: there is no create endpoint on `/asset-requests`, and the
            ticket queue already has an approval trail behind it. */}
        {list.isLoading || list.error ? null : (
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
