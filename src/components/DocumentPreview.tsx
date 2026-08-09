import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import {
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toast } from "../lib/toast";
import { radius, space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

/* ── File type ────────────────────────────────────────────────────────────── */

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"];

/**
 * Extension from a URL, ignoring the query string.
 *
 * Signed S3/Cloudinary links carry `?X-Amz-Signature=…` after the filename, and
 * a naive `split('.').pop()` on those returns the tail of a signature — which is
 * how every document ended up classified as "other".
 */
export function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.includes(extensionOf(url));
}

function mimeOf(url: string): string {
  const ext = extensionOf(url);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (IMAGE_EXT.includes(ext)) return "image/jpeg";
  if (ext === "doc" || ext === "docx") return "application/msword";
  return "application/octet-stream";
}

/* ── Download ─────────────────────────────────────────────────────────────── */

/**
 * Pull the file into the app's cache, then hand it to the system share sheet.
 *
 * There is no "save straight to Downloads" here on purpose: on Android that
 * needs the Storage Access Framework (a folder picker of its own) and on iOS the
 * concept does not exist. The share sheet already contains "Save to Files",
 * Drive, WhatsApp and print — one dialog that does what every user meant by
 * "download", on both platforms.
 */
export async function downloadDocument(url: string, label: string) {
  const dir = new Directory(Paths.cache, "documents");
  try {
    // `create()` throws when the directory is already there — which it is on
    // every download after the first.
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    /* already exists — nothing to do */
  }

  const out = await File.downloadFileAsync(url, dir);

  if (!(await Sharing.isAvailableAsync())) {
    toast.success("Downloaded", label);
    return;
  }

  await Sharing.shareAsync(out.uri, {
    mimeType: mimeOf(url),
    dialogTitle: label,
    UTI: extensionOf(url) === "pdf" ? "com.adobe.pdf" : "public.item",
  });
}

/* ── Zoomable image ───────────────────────────────────────────────────────── */

const MAX_ZOOM = 4;

/**
 * Pinch, pan and double-tap on the preview.
 *
 * An Aadhaar scan is unreadable at screen width — a preview of an ID document
 * that cannot be zoomed is a thumbnail with extra steps.
 */
function ZoomableImage({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    saved.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1) reset();
      else saved.value = scale.value;
    });

  // Only meaningful once zoomed in — at 1× there is nothing outside the frame
  // to pan to, and swallowing the drag there would fight the close gesture.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (saved.value <= 1) return;
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (saved.value > 1) reset();
      else {
        scale.value = withTiming(2.5);
        saved.value = 2.5;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  const gesture = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan),
  );

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center px-10">
        <FileText size={34} strokeWidth={1.6} color="rgba(255,255,255,0.6)" />
        <Text className="mt-3 text-center font-ui text-[14px] text-white/80">
          This image could not be loaded
        </Text>
        <Text className="mt-1 text-center font-ui-regular text-[12px] text-white/50">
          The stored link may have expired. Try Download instead.
        </Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className="flex-1 items-center justify-center">
        <Animated.Image
          source={{ uri }}
          style={[{ width: "100%", height: "100%" }, style]}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
        {loading ? (
          <View className="absolute">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

/* ── Sheet ────────────────────────────────────────────────────────────────── */

/**
 * Full-screen document preview.
 *
 * Images render inline and zoomable. Anything else (PDF, DOC) opens in the
 * in-app browser: rendering a PDF natively would mean bundling a WebView or a
 * PDF engine, and Chrome Custom Tabs / SFSafariViewController already do it
 * without leaving the app or adding 8 MB to the binary.
 */
export function DocumentPreview({
  visible,
  url,
  label,
  onClose,
}: {
  visible: boolean;
  /** `null` closes the sheet — a row with no file behind it never opens it. */
  url: string | null;
  label: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { brand } = useTheme();
  const [busy, setBusy] = useState(false);

  // A new document must not inherit the previous one's spinner.
  useEffect(() => {
    if (!visible) setBusy(false);
  }, [visible]);

  if (!url) return null;

  const image = isImageUrl(url);
  const ext = extensionOf(url).toUpperCase();

  const openExternally = async () => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: brand[700],
        controlsColor: "#FFFFFF",
        enableBarCollapsing: true,
        showTitle: true,
      });
    } catch {
      toast.error("Could not open this file", "The stored link is not reachable.");
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      await downloadDocument(url, label);
    } catch {
      toast.error("Download failed", "The file could not be fetched.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
    >
      {/* Gestures inside a Modal need their own root on Android — the one in
          App.tsx does not reach into the modal's separate view host. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0F14" }}>
        {/* ── Bar ───────────────────────────────────────────────────────── */}
        <View
          style={{
            paddingTop: insets.top + space.sm,
            paddingHorizontal: space.lg,
            paddingBottom: space.md,
          }}
          className="flex-row items-center gap-3"
        >
          <View className="flex-1">
            <Text
              className="font-ui-semibold text-[15px] text-white"
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text className="mt-0.5 font-ui-regular text-[11.5px] text-white/55">
              {ext ? `${ext} · ` : ""}
              {image ? "Pinch or double-tap to zoom" : "Opens in the in-app viewer"}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              backgroundColor: "rgba(255,255,255,0.12)",
            })}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <X size={17} strokeWidth={2.2} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        {image ? (
          <ZoomableImage uri={url} />
        ) : (
          <View className="flex-1 items-center justify-center px-10">
            <View
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              className="h-20 w-20 items-center justify-center rounded-3xl"
            >
              <FileText size={34} strokeWidth={1.6} color="#FFFFFF" />
            </View>
            <Text className="mt-4 text-center font-ui-semibold text-[15px] text-white">
              {ext || "File"} document
            </Text>
            <Text className="mt-1.5 text-center font-ui-regular text-[13px] leading-5 text-white/60">
              This one is not an image, so it opens in the in-app viewer. You can
              also download it and keep a copy.
            </Text>

            <Pressable
              onPress={openExternally}
              accessibilityRole="button"
              accessibilityLabel={`Open ${label}`}
              style={({ pressed }) => ({
                marginTop: space.xl,
                backgroundColor: brand[600],
                borderRadius: radius.button,
                opacity: pressed ? 0.85 : 1,
              })}
              className="h-12 flex-row items-center justify-center gap-2 px-6"
            >
              <Maximize2 size={17} strokeWidth={2.2} color="#FFFFFF" />
              <Text className={`text-white ${T.button}`}>Open viewer</Text>
            </Pressable>
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            gap: space.md,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
          }}
          className="flex-row"
        >
          <Pressable
            onPress={openExternally}
            accessibilityRole="button"
            accessibilityLabel="Open in viewer"
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderRadius: radius.button,
              opacity: pressed ? 0.7 : 1,
            })}
            className="h-12 flex-row items-center justify-center gap-2"
          >
            <ExternalLink size={17} strokeWidth={2} color="#FFFFFF" />
            <Text className={`text-white ${T.button}`}>Open</Text>
          </Pressable>

          <Pressable
            onPress={download}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Download ${label}`}
            accessibilityState={{ busy }}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: brand[600],
              borderRadius: radius.button,
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            })}
            className="h-12 flex-row items-center justify-center gap-2"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Download size={17} strokeWidth={2.2} color="#FFFFFF" />
            )}
            <Text className={`text-white ${T.button}`}>
              {busy ? "Preparing…" : "Download"}
            </Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
