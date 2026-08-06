import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ChevronDown, ChevronUp, LifeBuoy, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { Button } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useMenuNav } from "../navigation/useMenuNav";
import { radius, shadow, space } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { T } from "../theme/type";

export type PolicyKind = "hr" | "privacy";

interface Section {
  title: string;
  body: string[];
}

/**
 * Policy copy lives in source, not behind an endpoint.
 *
 * There is no CMS on the backend and no `/policies` route, and rendering a
 * remote HTML blob inside a WebView would have meant shipping an unstyled page
 * that ignores both themes. Text in the app ships with the app: it is versioned
 * with the release, it renders in the app's own type, and it works offline —
 * which is exactly when someone reaches for the leave rules.
 *
 * When a policy endpoint does exist, swap the constant for a query; the layout
 * below takes an array either way.
 */
const HR_SECTIONS: Section[] = [
  {
    title: "Working hours",
    body: [
      "The standard weekday shift and its grace window are set on your work calendar — open Calendar from the menu to see the exact times that apply to you.",
      "Arriving after the grace window is marked Late. Arriving after the half-day threshold is marked as a half day.",
    ],
  },
  {
    title: "Attendance",
    body: [
      "Punch in when you start and punch out when you finish. One break per day is counted against worked hours.",
      "A day with no punch and no approved leave is an unauthorised absence, and it is what the month-closing deduction is computed from.",
      "Forgot to punch? Use Regularise on the Attendance screen the same week — your manager approves it.",
    ],
  },
  {
    title: "Leave",
    body: [
      "Sick / Emergency and Earned leave draw down from your balance. Unpaid leave does not, and is deducted from salary instead.",
      "Apply before the date wherever you can. Emergencies are the exception, not the pattern.",
      "A request stays yours to withdraw while it is Pending. Once approved, ask your manager.",
      "Weekly offs and declared holidays that fall inside a leave range still count as applied days.",
    ],
  },
  {
    title: "Company assets",
    body: [
      "Anything assigned to you is on the register under your name until IT records it as returned.",
      "Report loss or damage the same day through a ticket. Waiting makes it worse, never better.",
    ],
  },
  {
    title: "Conduct",
    body: [
      "Treat colleagues, customers and vendors with respect. Harassment of any kind ends employment.",
      "Company data stays on company systems. Do not forward customer records to personal accounts.",
      "Raise concerns early through your manager, HR, or a ticket. Nothing raised in good faith is held against you.",
    ],
  },
];

const PRIVACY_SECTIONS: Section[] = [
  {
    title: "What this app collects",
    body: [
      "Your employee profile as HR holds it: name, contact details, department, designation and the documents uploaded against your record.",
      "Attendance events — the time of each punch, and the device it came from.",
      "Location, but only at the moment you punch, and only to confirm the punch happened where it was meant to. The app does not track you between punches and does not run location in the background.",
    ],
  },
  {
    title: "What it does not collect",
    body: [
      "Your photos, contacts, messages or files. Photo access is used only for the picture you deliberately attach.",
      "Anything at all while you are logged out.",
    ],
  },
  {
    title: "Where it goes",
    body: [
      "To your employer's own HR backend, over an encrypted connection. It is not sold, and it is not shared with advertisers.",
      "Your session token is stored in the device keystore, not in plain storage, and is cleared on logout.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can view what is held about you from Profile, and correct most of it yourself.",
      "For anything you cannot edit — statutory numbers, salary, documents — raise a ticket to HR.",
      "On leaving the company your access ends immediately; the record is retained for the period the law requires.",
    ],
  },
];

const CONTENT: Record<
  PolicyKind,
  { title: string; subtitle: string; intro: string; sections: Section[] }
> = {
  hr: {
    title: "HR Policy",
    subtitle: "The rules, in plain words",
    intro:
      "A short version of the handbook — the parts that come up every week. The signed handbook HR issued on joining is the binding document; where the two differ, that one wins.",
    sections: HR_SECTIONS,
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "What this app knows about you",
    intro:
      "Written for the app specifically, not the company at large. If something here does not match what you were told, say so — that is a bug worth reporting.",
    sections: PRIVACY_SECTIONS,
  },
};

/* ── Accordion ────────────────────────────────────────────────────────────── */

/**
 * Collapsed by default, one open at a time.
 *
 * Five sections of body copy in a single scroll is a wall nobody reads. Titles
 * alone fit on one screen, which turns the page into a table of contents you
 * can act on.
 */
function SectionCard({
  section,
  open,
  onToggle,
}: {
  section: Section;
  open: boolean;
  onToggle: () => void;
}) {
  const { c, dark, brand } = useTheme();
  const Chevron: LucideIcon = open ? ChevronUp : ChevronDown;

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={section.title}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        className="flex-row items-center gap-3 px-4 py-4"
      >
        <Text style={{ color: c.text }} className={`flex-1 ${T.cardTitleSm}`}>
          {section.title}
        </Text>
        <Chevron size={17} strokeWidth={2.2} color={open ? brand[600] : c.textFaint} />
      </Pressable>

      {open ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
          {section.body.map((p, i) => (
            <Text
              key={i}
              style={{ color: c.textMuted }}
              className={`leading-[21px] ${T.secondary}`}
            >
              {p}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

export default function PolicyScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "Policy">>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const go = useMenuNav();

  const kind: PolicyKind = route.params?.kind ?? "hr";
  const content = CONTENT[kind];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title={content.title}
        subtitle={content.subtitle}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE + 16,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: c.textMuted }} className={`leading-[21px] ${T.secondary}`}>
          {content.intro}
        </Text>

        {content.sections.map((s, i) => (
          <SectionCard
            key={s.title}
            section={s}
            open={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}

        <Button
          label="Ask HR a question"
          variant="secondary"
          icon={<LifeBuoy size={18} strokeWidth={2} color={c.text} />}
          onPress={() => go("tickets")}
          style={{ marginTop: space.sm }}
        />
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
