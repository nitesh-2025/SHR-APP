import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import Constants from "expo-constants";
import {
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react-native";
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

/** The build this policy shipped in — printed under it, see the footer. */
const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

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

/**
 * Effective date of the privacy copy below.
 *
 * Stated, not implied: a policy with no date cannot be shown to have been in
 * force when a given piece of data was collected, and Play's data-safety review
 * asks for one. Bump this whenever the sections underneath change in substance.
 */
export const PRIVACY_EFFECTIVE = "12 August 2026";

/**
 * The app's privacy policy, in full.
 *
 * Written against the Google Play User Data policy, which wants a policy that
 * (a) names the data types collected, (b) states the purpose of each, (c) says
 * who it is shared with, (d) describes retention and deletion, and (e) gives a
 * way to reach a human. Each of those is a section below, in the order a
 * reviewer looks for them.
 *
 * Two things this copy deliberately does NOT do: claim a certification nobody
 * has audited, and promise a retention period the backend does not enforce. An
 * overstated policy is worse than a plain one — it is the version that gets
 * quoted back at you.
 */
const PRIVACY_SECTIONS: Section[] = [
  {
    title: "Who this app is for",
    body: [
      "SHR is a workplace app, issued by your employer to its own staff. You can only sign in with an account HR has created — there is no public sign-up.",
      "Your employer decides what is held about you and why; in data-protection terms they are the controller. This app is the tool that collects it on their behalf and shows it back to you.",
      "It is not directed at children and is not intended for anyone below the legal working age. We do not knowingly collect data from children.",
      "Effective from " + PRIVACY_EFFECTIVE + ". Where your signed employment contract or your local law says something different, that takes precedence over this page.",
    ],
  },
  {
    title: "Data the app collects",
    body: [
      "Identity and profile — name, employee ID, work and personal email, phone, date of birth, gender, marital status, blood group, address, family and emergency contacts, photograph, designation, department and joining date.",
      "Employment and payroll — shift, leave balances, the salary components and deductions shown on your payslip, and your bank and statutory numbers (PAN, Aadhaar, UAN, PF, ESIC) where you or HR have entered them.",
      "Documents — files you or HR upload against your record: ID proofs, certificates, letters, and the file type and upload date alongside them.",
      "Attendance and location — the time of every punch, break and punch-out, and a location captured AT THE MOMENT of a punch to confirm it happened where it was meant to.",
      "Messages — chat you send colleagues inside the app, and any photo you attach to it.",
      "Device and technical data — device model, OS version, app version, the device class you signed in from, and error diagnostics.",
      "That is the whole list. If a screen ever asks for something not named here, treat it as a bug and report it.",
    ],
  },
  {
    title: "Why each piece is collected",
    body: [
      "To run the employment relationship: attendance, leave, payroll, assets, performance and HR records. That is the app's only purpose.",
      "To keep your account secure — the device class and sign-in history are what let a login that should not be happening be spotted.",
      "To let colleagues reach each other: the directory, chat, and the birthday list.",
      "To fix faults: crash and error diagnostics, read in aggregate.",
      "Nothing here is used for advertising, for profiling you outside work, or to build a profile that is sold on. There is no advertising SDK in this app.",
    ],
  },
  {
    title: "Permissions, and what refusing costs",
    body: [
      "Location — requested only when you punch in or out, and read only at that instant. There is no background location: the app cannot follow you between punches. Refuse it and punches record without a location, which your employer's policy may then require a manager to regularise.",
      "Camera — used when you photograph a document or take a picture to send in a chat. Nothing is captured unless you press the shutter.",
      "Photos and files — used only for the one file you pick. The app does not scan, index or upload your gallery.",
      "Notifications — used for attendance reminders, leave decisions, tickets and messages. Refusing costs you those alerts and nothing else.",
      "Biometrics — optional, and only to unlock the app on this device. Your fingerprint or face never leaves the device and is never sent anywhere; the app receives a yes or no from the operating system, nothing more.",
      "Every one of these can be revoked in your device settings at any time, and the app keeps working with the matching feature switched off.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "You — your own record, from the Profile screen.",
      "Your employer's authorised staff: HR, your reporting manager and administrators, each limited by their role. Access is permission-controlled, not open to everyone with a login.",
      "Service providers who run the system on your employer's behalf — application hosting, database, file storage and push-notification delivery — under contract, and only to provide that service.",
      "A public authority, where a valid legal order requires it.",
      "It is never sold, rented or shared with advertisers or data brokers. There is no third-party analytics or ad network in this app.",
    ],
  },
  {
    title: "How it is protected",
    body: [
      "Everything travels over an encrypted HTTPS connection. Files live in access-controlled storage, not on a public URL anyone could guess.",
      "Your session token is held in the device's secure keystore — Keychain on iOS, Keystore on Android — never in plain app storage, and it is destroyed on logout.",
      "Access inside the company is role-based, and administrative actions are written to an audit log.",
      "ID numbers are shown part-masked in the app, so a screenshot or a glance over your shoulder does not expose them in full.",
      "No system is perfectly secure. If you think your account has been compromised, tell HR or IT immediately so the session can be revoked.",
    ],
  },
  {
    title: "How long it is kept",
    body: [
      "Attendance, leave and payroll records are kept for as long as employment, tax and labour law require your employer to keep them — typically some years after you leave.",
      "Chat messages and uploaded documents stay until your employer deletes them under its own retention schedule.",
      "Your login stops working the day your employment ends; the underlying record is retained for the statutory period, then deleted or anonymised.",
      "Diagnostics are short-lived and stop being tied to you once aggregated.",
    ],
  },
  {
    title: "Your rights, and how to use them",
    body: [
      "See what is held: open Profile — personal details, bank, statutory numbers, documents, attendance and payslips are all readable there.",
      "Correct it: most personal fields are editable from Profile. Anything HR owns — designation, salary, statutory numbers, verified documents — is corrected by raising a ticket.",
      "Ask for deletion: because this is an employment record, deletion is your employer's decision and is limited by the law that requires the record to exist. Requests go to HR, and you are entitled to an answer.",
      "Withdraw a permission: device settings, any time, without asking anyone.",
      "Complain: to HR first, and to your local data-protection authority if the answer does not satisfy you.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "If this policy changes in substance, the new version appears here with a new effective date on the next app update.",
      "Questions, corrections or a data request: raise a ticket from Support inside the app, or write to your HR team directly. A privacy question is not a nuisance — it is the point of this page.",
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
      "This is the app's own policy: what it collects, why, who sees it, how long it is kept, and how to get it corrected. It covers SHR specifically, not everything your employer holds on paper. If something here does not match what you were told, say so — that is a bug worth reporting.",
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
        borderRadius: 4,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
        // ...(dark ? shadow.none : shadow.soft),
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
        <Chevron
          size={17}
          strokeWidth={2.2}
          color={open ? brand[600] : c.textFaint}
        />
      </Pressable>

      {open ? (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingBottom: space.lg,
            gap: space.md,
          }}
        >
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
        <Text
          style={{ color: c.textMuted }}
          className={`leading-[21px] ${T.secondary}`}
        >
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

        {/* Which policy you actually read, and which build it shipped in.
            A privacy policy that cannot be pinned to a date and a version is
            not much use in the argument it exists for. */}
        <Text
          style={{ color: c.textFaint }}
          className={`mt-2 text-center ${T.micro}`}
        >
          {kind === "privacy"
            ? `Effective ${PRIVACY_EFFECTIVE} · SHR v${APP_VERSION}`
            : `SHR v${APP_VERSION}`}
        </Text>
      </ScrollView>

      <BottomNav active={null} onSelect={go} />
    </View>
  );
}
