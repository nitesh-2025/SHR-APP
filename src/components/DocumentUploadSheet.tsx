import * as DocumentPicker from "expo-document-picker";
import type * as ImagePickerTypes from "expo-image-picker";
import {
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  GraduationCap,
  IdCard,
  Image as ImageIcon,
  Landmark,
  Paperclip,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./BottomSheet";
import { Button } from "./ui";
import { toastApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import {
  useUpdateMyProfileMutation,
  useUploadMyFilesMutation,
  type EmployeeDocType,
  type EmployeeDocument,
  type EmployeeProfile,
} from "../store/employeesApi";
import { space, surface, toneFor } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/** The backend's field name for an upload — same as chat, tickets and referral. */
const UPLOAD_FIELD = "files";

/**
 * Bigger than this and the request is not worth starting.
 *
 * A phone camera pointed at an Aadhaar card produces 3–6 MB; anything past 15 MB
 * is a video or a scan nobody meant to send, and it would spend a minute on
 * mobile data only to come back as a 413 with no explanation attached.
 */
const MAX_BYTES = 15 * 1024 * 1024;

/** What the file picker will take. Images and the three office formats. */
const ACCEPTED = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface DocKind {
  type: EmployeeDocType;
  label: string;
  icon: LucideIcon;
  /** Whether a reference number means anything for this kind. */
  number?: boolean;
  /** Placeholder for that number field. */
  hint?: string;
}

/**
 * What an employee may put on their own record.
 *
 * Same nine values the HR console writes, in the order a person is likely to
 * need them — identity first, then the paperwork HR chases. `offer_letter` stays
 * on the list even though HR issues it: people are asked for their signed copy
 * often enough that leaving it out would only push them to file it under
 * "Something else".
 */
const KINDS: DocKind[] = [
  { type: "aadhaar_card", label: "Aadhaar card", icon: IdCard, number: true, hint: "12-digit number" },
  { type: "pan_card", label: "PAN card", icon: IdCard, number: true, hint: "ABCDE1234F" },
  { type: "photo", label: "Photograph", icon: ImageIcon },
  { type: "resume", label: "Résumé", icon: FileText },
  { type: "education", label: "Education", icon: GraduationCap, number: true, hint: "Roll / certificate no." },
  { type: "experience_letter", label: "Experience letter", icon: Briefcase },
  { type: "bank_proof", label: "Bank proof", icon: Landmark, number: true, hint: "Account number" },
  { type: "offer_letter", label: "Offer letter", icon: FileText },
  { type: "other", label: "Something else", icon: Paperclip, number: true },
];

/** Native module loaded on demand — see `pickImage` for why. */
function imagePicker(): typeof ImagePickerTypes {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-image-picker") as typeof ImagePickerTypes;
}

interface Picked {
  uri: string;
  name: string;
  mime: string;
  size?: number;
}

/** `1536000` → `1.5 MB`. Bytes are for logs, not for a person choosing a file. */
function fileSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip the extension — the label is read by a person, not opened by one. */
function niceName(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot === -1 ? name : name.slice(0, dot)).trim() || name;
}

/* ── Source button ────────────────────────────────────────────────────────── */

function SourceButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { c, brand } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: c.fill,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 4,
        paddingVertical: space.md,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
      className="items-center gap-1.5"
    >
      <Icon size={19} strokeWidth={2} color={brand[600]} />
      <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Sheet ────────────────────────────────────────────────────────────────── */

/**
 * Add a document to my own record.
 *
 * Two calls, in this order: the bytes go to `POST /employees/me/upload` and come
 * back as a URL, then `PATCH /employees/me` writes the `documents[]` entry that
 * points at it. Never the other way round — a row saved against a failed upload
 * is a document that exists everywhere except on disk.
 *
 * The whole array is sent on the PATCH because the API replaces it rather than
 * merging into it. Existing entries are passed through untouched (`_id`,
 * `uploaded_at` and the verification flag included) so re-filing one document
 * cannot reset the history of the other five.
 */
export function DocumentUploadSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  /** The record being appended to. `undefined` while it is still loading. */
  profile?: EmployeeProfile;
}) {
  const { c, brand, dark, tint } = useTheme();

  const [uploadFiles] = useUploadMyFilesMutation();
  const [updateProfile] = useUpdateMyProfileMutation();

  const [kind, setKind] = useState<DocKind>(KINDS[0]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [file, setFile] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);

  // A closed sheet keeps nothing. Re-opening it to last week's half-filled form
  // is how someone files their PAN under "Experience letter".
  useEffect(() => {
    if (visible) return;
    setKind(KINDS[0]);
    setTypeOpen(false);
    setLabel("");
    setNumber("");
    setFile(null);
    setBusy(false);
  }, [visible]);

  /**
   * The entry this upload will overwrite, if any.
   *
   * Re-uploading a document HR has not looked at yet REPLACES it: the common
   * case is a first photo that came out unreadable, and a list holding both
   * copies makes HR guess which one is current. A verified entry is never
   * touched — that one has been checked, and quietly dropping it would undo
   * someone else's work.
   */
  const replacing =
    kind.type === "other"
      ? -1
      : (profile?.documents ?? []).findIndex(
          (d) => d.type === kind.type && !d.is_verified,
        );

  const verifiedAlready = (profile?.documents ?? []).some(
    (d) => d.type === kind.type && d.is_verified,
  );

  const stage = (next: Picked) => {
    if (next.size && next.size > MAX_BYTES) {
      toast.error(
        "That file is too large",
        `Keep it under 15 MB — this one is ${fileSize(next.size)}.`,
      );
      return;
    }
    setFile(next);
    // The filename is the best label anyone has typed for this document, and it
    // is already typed. Only fills an empty box — never overwrites what the user
    // wrote themselves.
    if (kind.type === "other" && !label.trim()) setLabel(niceName(next.name));
  };

  const pickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      if (!asset) return;

      stage({
        uri: asset.uri,
        name: asset.name || "document",
        mime: asset.mimeType || "application/octet-stream",
        size: asset.size ?? undefined,
      });
    } catch {
      toast.error("Could not open the file picker.");
    }
  };

  const pickImage = async (source: "camera" | "library") => {
    try {
      const picker = imagePicker();
      const permission =
        source === "camera"
          ? await picker.requestCameraPermissionsAsync()
          : await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error(
          source === "camera"
            ? "Camera permission is needed to photograph a document."
            : "Photo permission is needed to attach an image.",
        );
        return;
      }

      const options: ImagePickerTypes.ImagePickerOptions = {
        mediaTypes: ["images"],
        // Higher than the chat composer's 0.7 on purpose: this image is an ID
        // someone in HR has to READ, and a re-encoded Aadhaar at 70 % is where
        // the last four digits stop being legible.
        quality: 0.85,
      };
      const result =
        source === "camera"
          ? await picker.launchCameraAsync(options)
          : await picker.launchImageLibraryAsync(options);

      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset) return;

      stage({
        uri: asset.uri,
        name: asset.fileName || `${kind.type}-${Date.now()}.jpg`,
        mime: asset.mimeType || "image/jpeg",
        size: asset.fileSize ?? undefined,
      });
    } catch {
      // A dev build made before these dependencies has no native picker — say so
      // instead of surfacing a "cannot find native module" stack.
      toast.error("Camera needs a fresh build of the app.");
    }
  };

  const submit = async () => {
    if (!file || busy) return;

    const finalLabel = label.trim() || kind.label;
    if (kind.type === "other" && !finalLabel) {
      toast.error("Give this document a name.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append(UPLOAD_FIELD, {
        uri: file.uri,
        name: file.name,
        type: file.mime,
        // RN's FormData takes this shape for a file; the DOM typings do not
        // describe it, hence the cast.
      } as unknown as Blob);

      const uploaded = await uploadFiles(form).unwrap();
      const url = uploaded[0]?.url;
      if (!url) throw new Error("upload returned nothing");

      const entry: EmployeeDocument = {
        type: kind.type,
        label: finalLabel,
        file_url: url,
        // Only ever sent when there is something to send: an empty string here
        // would blank a number HR had already keyed in on a replaced row.
        ...(number.trim() ? { number: number.trim() } : {}),
        // A fresh file has not been checked by anyone, whatever the row it
        // replaces used to say.
        is_verified: false,
      };

      const existing = profile?.documents ?? [];
      const next =
        replacing >= 0
          ? existing.map((d, i) => (i === replacing ? { ...d, ...entry } : d))
          : [...existing, entry];

      await updateProfile({ documents: next }).unwrap();

      toast.success(
        replacing >= 0 ? "Document replaced" : "Document uploaded",
        "HR will verify it from their end.",
      );
      onClose();
    } catch (e) {
      toast.error(...toastApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const warn = toneFor(surface.warning, dark);

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingTop: space.sm,
          paddingBottom: space.screen,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: c.text }} className={T.section}>
          Upload a document
        </Text>
        <Text style={{ color: c.textMuted }} className={`mt-1 ${T.secondary}`}>
          Say what it is, attach the file, and it lands on your record for HR to
          check.
        </Text>

        {/* ── What is it ─────────────────────────────────────────────────── */}
        <Text
          style={{ color: c.textFaint, letterSpacing: 0.7, marginTop: space.xl }}
          className={T.micro}
        >
          DOCUMENT TYPE
        </Text>

        {/* One field that opens a list, not nine chips.
            Wrapped chips gave the sheet three ragged rows of near-identical
            outlines and no single place that answered "what is this?" — the
            selected one had to be found by colour. A closed select states the
            answer in one line; the list is only on screen while it is being
            answered. */}
        <Pressable
          onPress={() => setTypeOpen((v) => !v)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Document type: ${kind.label}`}
          accessibilityState={{ expanded: typeOpen, disabled: busy }}
          style={({ pressed }) => ({
            marginTop: space.sm,
            height: 52,
            paddingHorizontal: space.md,
            backgroundColor: c.fill,
            borderWidth: 1,
            borderColor: typeOpen ? brand[600] : c.border,
            borderRadius: 4,
            opacity: busy ? 0.5 : pressed ? 0.7 : 1,
          })}
          className="flex-row items-center gap-2.5"
        >
          <View
            style={{ backgroundColor: tint.bg, borderRadius: 4 }}
            className="h-8 w-8 items-center justify-center"
          >
            <kind.icon size={16} strokeWidth={2} color={brand[600]} />
          </View>
          <Text style={{ color: c.text }} className={`flex-1 ${T.body}`} numberOfLines={1}>
            {kind.label}
          </Text>
          <ChevronDown
            size={18}
            strokeWidth={2.2}
            color={c.textFaint}
            style={{ transform: [{ rotate: typeOpen ? "180deg" : "0deg" }] }}
          />
        </Pressable>

        {typeOpen ? (
          <View
            style={{
              marginTop: space.xs,
              backgroundColor: c.fill,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {KINDS.map((k, i) => {
              const active = k.type === kind.type;
              const Icon = k.icon;
              return (
                <Pressable
                  key={k.type}
                  onPress={() => {
                    setKind(k);
                    setTypeOpen(false);
                    // The name box only ever holds something typed for
                    // "Something else" — carrying it onto "PAN card" would file
                    // the wrong title against the right type.
                    setLabel("");
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={k.label}
                  style={({ pressed }) => ({
                    height: 48,
                    paddingHorizontal: space.md,
                    backgroundColor: active ? tint.bg : pressed ? c.fill : "transparent",
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  })}
                  className="flex-row items-center gap-2.5"
                >
                  <Icon
                    size={17}
                    strokeWidth={2}
                    color={active ? brand[600] : c.textFaint}
                  />
                  <Text
                    style={{ color: active ? tint.text : c.text }}
                    className={`flex-1 ${active ? T.buttonSm : T.body}`}
                    numberOfLines={1}
                  >
                    {k.label}
                  </Text>
                  {active ? (
                    <Check size={16} strokeWidth={2.6} color={brand[600]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Two things worth saying before the file is chosen, not after it is
            sent: what this upload will overwrite, and what it will not. */}
        {replacing >= 0 ? (
          <Text style={{ color: c.textFaint }} className={`mt-3 ${T.micro}`}>
            You already have a {kind.label.toLowerCase()} waiting to be checked —
            this replaces it.
          </Text>
        ) : verifiedAlready ? (
          <Text style={{ color: warn.text }} className={`mt-3 ${T.micro}`}>
            HR has already verified a {kind.label.toLowerCase()}. This one is
            added alongside it, not over it.
          </Text>
        ) : null}

        {/* ── Name it (free-form kinds only) ─────────────────────────────── */}
        {kind.type === "other" ? (
          <View style={{ marginTop: space.lg }}>
            <Text style={{ color: c.textMuted }} className={T.label}>
              What is this document?
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              editable={!busy}
              placeholder="e.g. Rent agreement"
              placeholderTextColor={c.textFaint}
              autoCapitalize="sentences"
              style={{
                marginTop: 6,
                height: 50,
                paddingHorizontal: space.md,
                backgroundColor: c.fill,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 4,
                color: c.text,
                fontFamily: "Outfit_500Medium",
                fontSize: 14.5,
              }}
              accessibilityLabel="Document name"
            />
          </View>
        ) : null}

        {/* ── Reference number ───────────────────────────────────────────── */}
        {kind.number ? (
          <View style={{ marginTop: space.lg }}>
            <Text style={{ color: c.textMuted }} className={T.label}>
              Number <Text style={{ color: c.textFaint }}>· optional</Text>
            </Text>
            <TextInput
              value={number}
              onChangeText={setNumber}
              editable={!busy}
              placeholder={kind.hint ?? "Document number"}
              placeholderTextColor={c.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                marginTop: 6,
                height: 50,
                paddingHorizontal: space.md,
                backgroundColor: c.fill,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 4,
                color: c.text,
                fontFamily: "Outfit_500Medium",
                fontSize: 14.5,
              }}
              accessibilityLabel={`${kind.label} number`}
            />
          </View>
        ) : null}

        {/* ── The file ───────────────────────────────────────────────────── */}
        <Text
          style={{ color: c.textFaint, letterSpacing: 0.7, marginTop: space.xl }}
          className={T.micro}
        >
          FILE
        </Text>

        {file ? (
          <View
            style={{
              marginTop: space.sm,
              backgroundColor: c.fill,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 4,
              padding: space.md,
            }}
            className="flex-row items-center gap-3"
          >
            <View
              style={{ backgroundColor: tint.bg, borderRadius: 4 }}
              className="h-10 w-10 items-center justify-center"
            >
              {file.mime.startsWith("image/") ? (
                <ImageIcon size={18} strokeWidth={2} color={brand[600]} />
              ) : (
                <FileText size={18} strokeWidth={2} color={brand[600]} />
              )}
            </View>

            <View className="flex-1">
              <Text
                style={{ color: c.text }}
                className={T.cardTitleSm}
                numberOfLines={1}
              >
                {file.name}
              </Text>
              <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`}>
                {fileSize(file.size) ?? "Ready to upload"}
              </Text>
            </View>

            <Pressable
              onPress={() => setFile(null)}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove this file"
              style={({ pressed }) => ({ opacity: busy ? 0.4 : pressed ? 0.6 : 1 })}
              className="h-9 w-9 items-center justify-center"
            >
              <Trash2 size={16} strokeWidth={2} color={surface.danger.tint} />
            </Pressable>
          </View>
        ) : (
          /* Three sources rather than one "browse": on a phone the document is
             usually still lying on the desk, so the camera has to be a first
             choice and not something reached through the gallery. */
          <View className="mt-2.5 flex-row" style={{ gap: space.sm }}>
            <SourceButton
              icon={Camera}
              label="Camera"
              disabled={busy}
              onPress={() => pickImage("camera")}
            />
            <SourceButton
              icon={ImageIcon}
              label="Gallery"
              disabled={busy}
              onPress={() => pickImage("library")}
            />
            <SourceButton
              icon={FolderOpen}
              label="Files"
              disabled={busy}
              onPress={pickFile}
            />
          </View>
        )}

        <Text style={{ color: c.textFaint }} className={`mt-2.5 ${T.micro}`}>
          JPG, PNG, PDF, DOC or DOCX · up to 15 MB.
        </Text>

        <Button
          label={busy ? "Uploading…" : replacing >= 0 ? "Replace document" : "Upload document"}
          icon={<Upload size={18} strokeWidth={2.2} color="#FFFFFF" />}
          loading={busy}
          disabled={!file}
          onPress={submit}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
