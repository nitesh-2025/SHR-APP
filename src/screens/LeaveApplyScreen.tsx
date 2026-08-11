import { StackActions, useNavigation } from "@react-navigation/native";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { LeaveApplyForm } from "../components/LeaveApplyForm";
import { ScreenHeader } from "../components/ScreenHeader";
import { space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Leave application as a pushed screen.
 *
 * The form itself lives in `LeaveApplyForm` — the same block the Leave screen
 * renders under its "Apply" tab, which is where people actually start from. This
 * route stays because the drawer and older links point at it, and because a
 * pushed screen is the right shape when applying is the ONLY thing you came to
 * do: nothing above the form, and back goes where you came from.
 */
export default function LeaveApplyScreen() {
  const navigation = useNavigation();
  const { c } = useTheme();

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Apply for Leave"
        subtitle="Your manager approves it"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: space.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LeaveApplyForm
            // REPLACE this form with the list rather than stacking it on top:
            // the question straight after submitting is "did it actually go",
            // and backing out of the answer should land on wherever you came
            // from, not on a form you have already filed.
            onApplied={() =>
              navigation.dispatch(StackActions.replace("LeaveRequests" as never))
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
