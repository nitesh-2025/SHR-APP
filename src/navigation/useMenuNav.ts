import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useCallback } from "react";

import { toast } from "../lib/toast";
import type { ProfileSection } from "../screens/ProfileEditScreen";
import type { RootStackParamList } from "./RootNavigator";

/**
 * One key → one destination, for every surface that shows a menu.
 *
 * The bottom bar, the quick-action rail, the drawer and the profile list all
 * speak the same string keys, and each screen used to keep its own `if/else`
 * chain. That is how "Tickets" ended up navigable from the drawer and dead from
 * the rail: adding a screen meant remembering every copy. There is one copy now.
 */
export type MenuKey =
  | "home"
  | "attendance"
  | "leaves"
  | "apply"
  | "profile"
  | "chat"
  | "team"
  | "birthday"
  | "refer"
  | "tickets"
  | "calendar"
  | "asset"
  | "payslip"
  | "performance"
  | "policy"
  | "privacy"
  | "documents"
  | "password"
  | "personal"
  | "bank"
  | "emergency"
  | "statutory"
  | "skills"
  | "more"
  | (string & {});

export function useMenuNav(options?: {
  /** Called for "more" — the host owns its own drawer state. */
  onMore?: () => void;
  /** Prefilled on the password-reset screen so nobody retypes their address. */
  email?: string;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { onMore, email } = options ?? {};

  return useCallback(
    (key: MenuKey) => {
      switch (key) {
        case "home":
          return navigation.navigate("Dashboard");
        case "attendance":
          return navigation.navigate("Attendance");
        // Both land on My Leave. The apply FORM lives on that screen now (its
        // own view in the header menu), so a separate "apply" destination would
        // be a second door into a room you can already see from the first —
        // and the balance, which decides how many days you ask for, is on the
        // screen you would have skipped past.
        case "leaves":
        case "apply":
          return navigation.navigate("Leave");
        case "profile":
          return navigation.navigate("Profile");
        case "chat":
          return navigation.navigate("Chats");
        case "team":
          return navigation.navigate("Team");
        case "birthday":
          return navigation.navigate("Birthdays");
        case "refer":
          return navigation.navigate("Referrals");
        case "tickets":
          return navigation.navigate("Tickets");
        case "calendar":
          return navigation.navigate("Holidays");
        case "asset":
          return navigation.navigate("Assets");
        case "payslip":
          return navigation.navigate("Payslip");
        case "documents":
          return navigation.navigate("Documents");
        case "performance":
          return navigation.navigate("Performance");
        case "policy":
          return navigation.navigate("Policy", { kind: "hr" });
        case "privacy":
          return navigation.navigate("Policy", { kind: "privacy" });

        // Changing a password and resetting one are the same OTP flow on the
        // backend, so there is no second screen to build — only a second way in.
        case "password":
          return navigation.navigate("ForgotPassword", { email });

        // Narrowed explicitly: `MenuKey` widens to `string` so callers can pass
        // a key the switch does not know yet, and TS cannot see that these
        // literals are exactly `ProfileSection` without being told.
        case "personal":
        case "bank":
        case "emergency":
        case "statutory":
        case "skills":
          return navigation.navigate("ProfileEdit", {
            section: key as ProfileSection,
          });

        case "more":
          return onMore?.();

        default:
          // Reached only by a menu entry whose screen genuinely does not exist
          // yet. A silent no-op reads as a broken button.
          toast.info("This screen is coming soon.");
      }
    },
    [navigation, onMore, email],
  );
}
