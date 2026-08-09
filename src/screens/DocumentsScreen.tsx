import { useNavigation } from "@react-navigation/native";
import {
  BadgeCheck,
  Download,
  FileText,
  Image as ImageIcon,
  TriangleAlert,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import {
  DocumentPreview,
  downloadDocument,
  extensionOf,
  isImageUrl,
} from "../components/DocumentPreview";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import { useMenuNav } from "../navigation/useMenuNav";
import {
  useGetMyProfileQuery,
  type EmployeeDocType,
} from "../store/employeesApi";
import { radius, shadow, space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDayShort } from "../utils/date";

/** Wire value → what a person calls it. */
const DOC_LABEL: Record<EmployeeDocType, string> = {
  pan_card: "PAN card",
  aadhaar_card: "Aadhaar card",
  resume: "Résumé",
  offer_letter: "Offer letter",
  education: "Education certificate",
  experience_letter: "Experience letter",
  bank_proof: "Bank proof",
  photo: "Photograph",
  other: "Document",
};

interface Row {
  key: string;
  label: string;
  /** ID number where the record carries one — masked, never shown in full. */
  number?: string;
  url?: string;
  /**
   * `null` when the record carries no verification flag at all.
   *
   * The statutory block (PAN, Aadhaar, UAN, PF, ESIC) has no `is_verified`
   * field, so an earlier pass defaulted those rows to `false` — which rendered
   * an amber "Pending" chip against IDs HR had already checked, and counted
   * them out of the "n verified" tally. Three states, not two: verified, not
   * verified, and never claimed either way.
   */
  verified: boolean | null;
  uploadedAt?: string;
}

/**
 * Show the last four characters only.
 *
 * A PAN or an Aadhaar number rendered in full sits in a screenshot, in a
 * screen-share, and over someone's shoulder on a train. The last four are
 * enough to confirm HR holds the right document, which is the only question
 * this screen exists to answer.
 */
function mask(value?: string): string | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  if (v.length <= 4) return v;
  return `•••• ${v.slice(-4)}`;
}

function DocRow({
  row,
  onPreview,
  onDownload,
  downloading,
}: {
  row: Row;
  onPreview: (row: Row) => void;
  onDownload: (row: Row) => void;
  downloading: boolean;
}) {
  const { c, dark, brand, tint } = useTheme();
  const tone = toneFor(
    row.verified === true
      ? surface.success
      : row.verified === false
        ? surface.warning
        : surface.neutral,
    dark,
  );

  // The glyph says what will happen when the row is tapped: a photo opens as a
  // picture, everything else opens as a document. Same well, different promise.
  const Glyph = row.url && isImageUrl(row.url) ? ImageIcon : FileText;
  const ext = row.url ? extensionOf(row.url).toUpperCase() : "";

  const body = (
    <View className="flex-row items-center gap-3">
      <View
        style={{ backgroundColor: tone.bg, borderRadius: radius.well - 2 }}
        className="h-11 w-11 items-center justify-center"
      >
        <Glyph size={19} strokeWidth={2} color={tone.tint} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            style={{ color: c.text }}
            className={`shrink ${T.cardTitleSm}`}
            numberOfLines={1}
          >
            {row.label}
          </Text>

          {row.verified === true ? (
            <Badge
              label="Verified"
              tone={surface.success}
              icon={
                <BadgeCheck
                  size={11}
                  strokeWidth={2.6}
                  color={surface.success.tint}
                />
              }
            />
          ) : row.verified === false ? (
            <Badge label="Pending" tone={surface.warning} />
          ) : (
            /* HR never stated a verification status for this one. "On file" is
               what the record actually says; "Pending" would be us inventing it. */
            <Badge label="On file" tone={surface.neutral} />
          )}
        </View>

        <Text
          style={{ color: c.textMuted }}
          className={`mt-0.5 ${T.micro}`}
          numberOfLines={1}
        >
          {[
            row.number,
            ext || null,
            row.uploadedAt ? `Added ${fmtDayShort(row.uploadedAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || (row.url ? "On file" : "Not uploaded")}
        </Text>
      </View>

      {/* Download sits on the row itself, not only inside the preview: the
          common case is "send HR my PAN", and that should not need a full-screen
          viewer opened and closed on the way. */}
      {row.url ? (
        <Pressable
          onPress={() => onDownload(row)}
          disabled={downloading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Download ${row.label}`}
          accessibilityState={{ busy: downloading }}
          style={({ pressed }) => ({
            backgroundColor: tint.bg,
            borderRadius: radius.well - 4,
            opacity: downloading ? 0.6 : pressed ? 0.7 : 1,
          })}
          className="h-9 w-9 items-center justify-center"
        >
          {downloading ? (
            <ActivityIndicator size="small" color={brand[600]} />
          ) : (
            <Download size={16} strokeWidth={2.2} color={brand[600]} />
          )}
        </Pressable>
      ) : null}
    </View>
  );

  // Only a row with a file behind it is a button. Wrapping an unopenable row in
  // a Pressable is an affordance that lies.
  if (!row.url) return <View className="py-1">{body}</View>;

  return (
    <Pressable
      onPress={() => onPreview(row)}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${row.label}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      className="py-1"
    >
      {body}
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * My documents — read-only.
 *
 * Built off `GET /employees/me` rather than the admin `/employees/documents`
 * route: the latter returns every employee's paperwork and exists for the HR
 * console. An employee needs their own row, and asking for it by identity is
 * both cheaper and impossible to over-fetch.
 */
export default function DocumentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();
  const go = useMenuNav();

  const profile = useGetMyProfileQuery();

  const rows = useMemo<Row[]>(() => {
    const data = profile.data;
    if (!data) return [];

    const out: Row[] = [];

    // Statutory IDs live outside `documents[]` on the record — same thing to a
    // person, two shapes on the wire.
    const statutory = data.statutory ?? {};
    const STATUTORY: { key: keyof typeof statutory; label: string }[] = [
      { key: "pan", label: "PAN" },
      { key: "aadhaar", label: "Aadhaar" },
      { key: "uan", label: "UAN" },
      { key: "pf", label: "PF" },
      { key: "esic", label: "ESIC" },
    ];

    for (const s of STATUTORY) {
      const entry = statutory[s.key];
      if (!entry?.number && !entry?.url) continue;
      out.push({
        key: `statutory:${String(s.key)}`,
        label: s.label,
        number: mask(entry.number),
        url: entry.url || undefined,
        verified: null,
      });
    }

    for (const [i, d] of (data.documents ?? []).entries()) {
      out.push({
        key: `doc:${i}:${d.type}`,
        label: d.label || DOC_LABEL[d.type] || "Document",
        number: mask(d.number),
        url: d.file_url || undefined,
        verified: Boolean(d.is_verified),
        uploadedAt: d.uploaded_at,
      });
    }

    return out;
  }, [profile.data]);

  // Only rows that actually carry a flag can be counted, and only those form
  // the denominator — "2 verified" out of seven when five never had a flag was
  // a support ticket waiting to happen.
  const flagged = rows.filter((r) => r.verified !== null);
  const verified = flagged.filter((r) => r.verified).length;

  // Which row's file is on screen, and which row is currently being fetched.
  // Keyed by row, not a boolean: two taps on two rows must not make both
  // spinners turn.
  const [preview, setPreview] = useState<Row | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const download = async (row: Row) => {
    if (!row.url) return;
    setBusyKey(row.key);
    try {
      await downloadDocument(row.url, row.label);
    } catch {
      toast.error("Download failed", "The stored link is not reachable.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Documents"
        subtitle={
          rows.length
            ? `${rows.length} on file${flagged.length ? ` · ${verified}/${flagged.length} verified` : ""}`
            : "What HR holds for you"
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profile.isFetching && !profile.isLoading}
            onRefresh={() => profile.refetch()}
            tintColor={brand[600]}
          />
        }
      >
        {profile.isLoading ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={72} radius={radius.card - 4} />
            <Skeleton height={72} radius={radius.card - 4} />
            <Skeleton height={72} radius={radius.card - 4} />
          </View>
        ) : profile.error ? (
          <EmptyState
            icon={
              <TriangleAlert size={32} strokeWidth={1.6} color={brand[600]} />
            }
            title="Could not load your documents"
            message={describeApiError(profile.error).title}
            actionLabel="Try again"
            onAction={() => profile.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} strokeWidth={1.6} color={brand[600]} />}
            title="Nothing on file yet"
            message="HR has not uploaded any documents against your record. Reach out to them if you think something should be here."
          />
        ) : (
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: c.border,
              padding: space.lg + 2,
              gap: space.md,
              // ...(dark ? shadow.none : shadow.card),
            }}
          >
            {rows.map((r, i) => (
              <View key={r.key}>
                <DocRow
                  row={r}
                  onPreview={setPreview}
                  onDownload={download}
                  downloading={busyKey === r.key}
                />
                {i === rows.length - 1 ? null : (
                  <View
                    style={{ backgroundColor: c.border, marginLeft: 56 }}
                    className="mt-3 h-px"
                  />
                )}
              </View>
            ))}
          </View>
        )}

        <Text
          style={{ color: c.textFaint }}
          className={`mt-4 leading-4 ${T.micro}`}
        >
          Tap a row to preview it, or the arrow to save a copy. Uploading and
          correcting documents is done by HR — ID numbers are shown part-masked
          on purpose.
        </Text>
      </ScrollView>

      <BottomNav active={null} onSelect={go} />

      <DocumentPreview
        visible={preview !== null}
        url={preview?.url ?? null}
        label={preview?.label ?? "Document"}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}
