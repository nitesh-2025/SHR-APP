import { AlertCircle, Send } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { BottomSheet } from "./BottomSheet";
import { Button } from "./ui";
import { describeApiError } from "../lib/apiError";
import { toast } from "../lib/toast";
import {
  useCreateRegularizationMutation,
  type RegularizationType,
} from "../store/attendanceApi";
import { radius, space, surface } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";
import { fmtDate } from "../utils/date";

/**
 * Ordered by how often a day actually goes wrong, not by the enum's order in
 * the schema — a forgotten punch is the overwhelming majority of these.
 */
const TYPES: { key: RegularizationType; label: string }[] = [
  { key: "missing_clock_out", label: "Forgot to clock out" },
  { key: "missing_clock_in", label: "Forgot to clock in" },
  { key: "wrong_time", label: "Wrong time recorded" },
  { key: "late_waiver", label: "Late — please waive" },
  { key: "work_from_home", label: "Worked from home" },
  { key: "on_duty", label: "On duty / field work" },
];

/**
 * Ask an admin to fix a day.
 *
 * The employee cannot edit their own attendance — that is the point of an audit
 * trail — so this raises a request against one date and leaves the decision
 * with the reviewer. `POST /attendance/regularizations`.
 */
export function RegularizeSheet({
  visible,
  date,
  onClose,
}: {
  visible: boolean;
  /** `YYYY-MM-DD`. Empty while the sheet is closed. */
  date: string;
  onClose: () => void;
}) {
  const { c, brand, tint } = useTheme();
  const { height: sheetHeight } = useWindowDimensions();
  const [create, { isLoading }] = useCreateRegularizationMutation();

  const [type, setType] = useState<RegularizationType>("missing_clock_out");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // Every open is a fresh request. Carrying the last one's reason over is how
  // people end up submitting the wrong explanation for the wrong day.
  useEffect(() => {
    if (visible) {
      setType("missing_clock_out");
      setReason("");
      setError("");
    }
  }, [visible]);

  const submit = async () => {
    setError("");
    if (!reason.trim()) {
      setError("Please write a short reason — the reviewer only sees this.");
      return;
    }
    try {
      await create({ date, type, reason: reason.trim() }).unwrap();
      toast.success("Request sent", "Your manager will review it.");
      onClose();
    } catch (e) {
      setError(describeApiError(e).title);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.88}>
      {/* An EXPLICIT maxHeight, not `flexShrink`.
          `BottomSheet` caps the panel and nothing more. A ScrollView does not
          report its content as its own intrinsic height, so leaving it to flex
          shrink inside that cap is unreliable — it kept measuring tall enough
          to push the footer past the panel's bottom edge, where the rounded
          panel clipped it away. Bounding the scroller directly leaves the
          footer a guaranteed place to stand. */}
      <ScrollView
        style={{ maxHeight: sheetHeight * 0.56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.screen, paddingTop: space.sm }}
      >
        <Text style={{ color: c.text }} className={T.section}>
          Regularize
        </Text>
        <Text style={{ color: c.textMuted }} className={`mt-1 ${T.secondary}`}>
          {fmtDate(date)}
        </Text>

        {error ? (
          <View
            style={{
              backgroundColor: surface.danger.bg,
              borderRadius: radius.well,
            }}
            className="mt-4 flex-row items-start gap-2.5 px-4 py-3"
          >
            <AlertCircle
              size={17}
              strokeWidth={2}
              color={surface.danger.tint}
            />
            <Text
              style={{ color: surface.danger.text }}
              className={`flex-1 leading-5 ${T.secondary}`}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <Text style={{ color: c.textMuted }} className={`mt-5 ${T.label}`}>
          What happened?
        </Text>

        {/* A wrapping chip set, not a dropdown: six options are few enough to
            show at once, and seeing them all is what tells someone which one
            their situation is. */}
        <View className="mt-2.5 flex-row flex-wrap" style={{ gap: space.sm }}>
          {TYPES.map((t) => {
            const active = t.key === type;
            return (
              <Pressable
                key={t.key}
                onPress={() => setType(t.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  backgroundColor: active ? tint.bg : c.fill,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? brand[600] : "transparent",
                  opacity: pressed ? 0.75 : 1,
                })}
                className="px-3.5 py-2"
              >
                <Text
                  style={{ color: active ? brand[700] : c.textMuted }}
                  className={T.badge}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ color: c.textMuted }} className={`mt-5 ${T.label}`}>
          Reason
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Tell your manager what to correct and why."
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            minHeight: 96,
            marginTop: space.sm,
            backgroundColor: c.fill,
            borderRadius: radius.input,
            color: c.text,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
          }}
          className={T.body}
        />
      </ScrollView>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          style={{
            backgroundColor: "#22C55E",
          }}
          label={isLoading ? "Sending…" : "Send request"}
          icon={<Send size={18} strokeWidth={2} color="#FFFFFF" />}
          loading={isLoading}
          variant="danger"
          onPress={submit}
        />
      </View>
    </BottomSheet>
  );
}
