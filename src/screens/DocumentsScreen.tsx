import { useNavigation } from "@react-navigation/native";
import {
  BadgeCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Lock,
  Plus,
  TriangleAlert,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { DocumentUploadSheet } from "../components/DocumentUploadSheet";
import { MaskedValue } from "../components/MaskedValue";
import { ScreenHeader } from "../components/ScreenHeader";
import { Badge, EmptyState, Skeleton } from "../components/ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import { useMenuNav } from "../navigation/useMenuNav";
import {
  useGetMyProfileQuery,
  type EmployeeDocType,
} from "../store/employeesApi";
import {
  radius,
  shadow,
  space,
  surface,
  toneFor,
  type Surface,
} from "../theme/colors";
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
 * The 48px square at the left of a card.
 *
 * For an image document it is the document — a scan of a PAN card and a scan of
 * a marksheet are the same FileText glyph otherwise, and "which one is this"
 * then costs a full-screen preview to answer. Anything that is not an image, or
 * an image whose link has expired, falls back to the glyph: a broken-image box
 * says nothing except that something is wrong.
 */
function Thumb({ row, tone }: { row: Row; tone: Surface }) {
  const [failed, setFailed] = useState(false);
  const image = Boolean(row.url) && isImageUrl(row.url!) && !failed;
  const Glyph = row.url && isImageUrl(row.url) ? ImageIcon : FileText;

  if (image) {
    return (
      <Image
        source={{ uri: row.url }}
        onError={() => setFailed(true)}
        resizeMode="cover"
        style={{
          height: 48,
          width: 48,
          borderRadius: 4,
          backgroundColor: tone.bg,
        }}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={{ backgroundColor: tone.bg, borderRadius: 4 }}
      className="h-12 w-12 items-center justify-center"
    >
      <Glyph size={20} strokeWidth={2} color={tone.tint} />
    </View>
  );
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
  // Verified is the only state the well colours for. Amber on every unchecked
  // row painted the whole list as a problem, when "HR has not got to it yet" is
  // the normal state of a document on the day it is uploaded.
  const tone = row.verified === true ? toneFor(surface.success, dark) : tint;

  const ext = row.url ? extensionOf(row.url).toUpperCase() : "";

  const body = (
    <View className="flex-row items-center gap-3">
      <Thumb row={row} tone={tone} />

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            style={{ color: c.text }}
            className={`shrink ${T.cardTitleSm}`}
            numberOfLines={1}
          >
            {row.label}
          </Text>

          {/* Only the good news gets a chip.
              "Pending" sat against every row on the screen — including the ones
              the employee had just uploaded correctly — and a list where every
              line is flagged amber reads as six problems rather than six
              documents safely on file. Verification is HR's queue, not the
              employee's task, so the row states the fact (it is here) and marks
              the exception (HR has checked it). */}
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
          ) : null}
        </View>

        {/* The number is the row's payload — it used to be the first fragment
            of a "•••• 9518 · PDF · Added 12 Aug" string, where the one fact
            somebody opened the screen to check was formatted exactly like the
            file extension next to it. Its own line, its own weight, and its
            own copy button. */}
        {row.number ? (
          <View className="mt-1">
            <MaskedValue value={row.number} label={row.label} />
          </View>
        ) : null}

        <Text
          style={{ color: c.textFaint }}
          className={`mt-0.5 ${T.micro}`}
          numberOfLines={1}
        >
          {[ext || null, row.uploadedAt ? `Added ${fmtDayShort(row.uploadedAt)}` : null]
            .filter(Boolean)
            .join(" · ") ||
            (row.number ? "" : row.url ? "On file" : "Not uploaded")}
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
            borderRadius: radius.well,
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

  /**
   * Each document is its own card.
   *
   * They were six rows inside one slab, split by hairlines — which is the right
   * shape for a table of one KIND of thing, and wrong for this: a passport photo,
   * a payroll CSV and a signed policy have nothing to do with each other except
   * that HR holds all three. Separate cards with real space between them say
   * "six separate things"; a divider says "six lines of one thing".
   */
  const card = {
    backgroundColor: c.card,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.md + 2,
  } as const;

  // Only a card with a file behind it is a button. Wrapping an unopenable one in
  // a Pressable is an affordance that lies.
  if (!row.url) return <View style={card}>{body}</View>;

  return (
    <Pressable
      onPress={() => onPreview(row)}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${row.label}`}
      style={({ pressed }) => ({ ...card, opacity: pressed ? 0.7 : 1 })}
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
        number: entry.number || undefined,
        url: entry.url || undefined,
        verified: null,
      });
    }

    for (const [i, d] of (data.documents ?? []).entries()) {
      out.push({
        key: `doc:${i}:${d.type}`,
        label: d.label || DOC_LABEL[d.type] || "Document",
        number: d.number || undefined,
        url: d.file_url || undefined,
        verified: Boolean(d.is_verified),
        uploadedAt: d.uploaded_at,
      });
    }

    return out;
  }, [profile.data]);

  // Counted, not scored. "0/6 verified" under the title turned a page about the
  // employee's paperwork into a report card on HR's backlog — the count is only
  // worth printing once there is something to print.
  const verified = rows.filter((r) => r.verified === true).length;

  // A frozen record refuses every write, uploads included. Better to say so on
  // the button than to let someone photograph an Aadhaar card and meet a 403.
  const locked = Boolean(profile.data?.is_lock);
  const canUpload = !locked && !profile.isLoading && !profile.error;

  const [uploadOpen, setUploadOpen] = useState(false);

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
            ? `${rows.length} on file${verified ? ` · ${verified} verified` : ""}`
            : "What HR holds for you"
        }
        onBack={() => navigation.goBack()}
        right={
          canUpload ? (
            <Pressable
              onPress={() => setUploadOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Upload a document"
              style={({ pressed }) => ({
                backgroundColor: brand[600],
                borderRadius: radius.button,
                opacity: pressed ? 0.85 : 1,
              })}
              className="h-10 w-10 items-center justify-center"
            >
              <Plus size={20} strokeWidth={2.4} color="#FFFFFF" />
            </Pressable>
          ) : null
        }
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
            <Skeleton height={72} radius={radius.card} />
            <Skeleton height={72} radius={radius.card} />
            <Skeleton height={72} radius={radius.card} />
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
            message={
              locked
                ? "Your record is locked by HR, so nothing can be added from here until they unlock it."
                : "Nothing has been filed against your record yet. Add your ID proofs, résumé or certificates and HR will verify them."
            }
            actionLabel={locked ? undefined : "Upload a document"}
            onAction={locked ? undefined : () => setUploadOpen(true)}
          />
        ) : (
          <View style={{ gap: space.md }}>
            {rows.map((r) => (
              <DocRow
                key={r.key}
                row={r}
                onPreview={setPreview}
                onDownload={download}
                downloading={busyKey === r.key}
              />
            ))}

            {/* The way in, at the end of the list rather than only in the bar.
                A header glyph is the first thing a returning user reaches for
                and the last thing a new one finds — someone who has just
                scrolled their six documents looking for the missing seventh is
                already looking at the bottom of the list. Dashed, so it reads as
                the empty slot after the cards rather than as a seventh one. */}
            {canUpload ? (
              <Pressable
                onPress={() => setUploadOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Upload a document"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: c.border,
                  borderStyle: "dashed",
                  borderRadius: 4,
                  paddingVertical: space.lg,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="flex-row items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={2.4} color={brand[600]} />
                <Text style={{ color: brand[600] }} className={T.buttonSm}>
                  Add a document
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Text
          style={{ color: c.textFaint }}
          className={`mt-4 leading-4 ${T.micro}`}
        >
          {locked
            ? "Tap a row to preview it, or the arrow to save a copy. Your record is locked by HR, so nothing can be added or replaced from here right now."
            : "Tap a row to preview it, or the arrow to save a copy. Anything you upload goes to HR to verify — ID numbers are shown part-masked on purpose."}
        </Text>
      </ScrollView>

      <BottomNav active={null} onSelect={go} />

      <DocumentPreview
        visible={preview !== null}
        url={preview?.url ?? null}
        label={preview?.label ?? "Document"}
        onClose={() => setPreview(null)}
      />

      {/* The sheet writes through `PATCH /employees/me`, which invalidates
          `MyProfile` — the list behind it refreshes itself, so there is no
          local copy of `documents[]` here to keep in step. */}
      <DocumentUploadSheet
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        profile={profile.data}
      />
    </View>
  );
}
