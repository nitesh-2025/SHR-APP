import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  FileText,
  Camera,
  IndianRupee,
  MapPin,
  MessageCircle,
  Users2,
  Search,
  Send,
  Share2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { Button, EmptyState, RangeChip, Skeleton } from '../components/ui';
import { ViewMenu } from '../components/ViewMenu';
import { CAREERS_URL, REFERRAL_REWARD } from '../config/env';
import { describeApiError, toastApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { selectCurrentUser, useAppSelector } from '../store';
import {
  useCreateCandidateMutation,
  useGetCandidatesQuery,
  useGetJobsQuery,
  CANDIDATE_STAGES,
  EMPLOYMENT_LABEL,
  STAGE_LABEL,
  type Candidate,
  type CandidateStage,
  type Job,
} from '../store/recruitmentApi';
import { radius, shadow, space, surface, toneFor, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDayShort } from '../utils/date';

type Tab = 'roles' | 'mine';

/**
 * The pipeline as a REFERRER sees it. `rejected` is an exit, not a step, so it
 * never appears on the rail — walking someone down a dead track is worse than
 * being told plainly that it ended.
 */
const TRACK: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];

const STAGE_SURFACE: Record<CandidateStage, Surface> = {
  applied: surface.neutral,
  screening: surface.info,
  interview: surface.warning,
  offer: surface.purple,
  hired: surface.success,
  rejected: surface.danger,
};

/**
 * A resume arrives as a LINK, not as bytes.
 *
 * The form used to open a file picker and upload the CV through
 * `POST /employees/me/upload`. Two things were wrong with that on a phone: the
 * CV is almost never ON the phone — it is in the referrer's Drive, or in the
 * candidate's WhatsApp — and an upload turns a 20-second form into a wait on
 * mobile data that can fail after everything else is filled in.
 *
 * A shared link costs one paste, is what people already have to hand, and stays
 * current if the candidate updates the document.
 */
const LINK_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;

/** `drive.google.com/…` → `https://drive.google.com/…`, so a bare paste works. */
function normaliseLink(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Where a role can be sent, and what each channel is actually good for.
 *
 * Brand colours, not the app's green: these are other people's logos and a row
 * of identical green discs would say nothing at a glance. Lucide has no brand
 * marks, so the glyph is generic and the COLOUR does the identifying.
 */
const SHARE_CHANNELS: {
  key: 'whatsapp' | 'linkedin' | 'instagram' | 'more';
  label: string;
  hint: string;
  icon: LucideIcon;
  bg: string;
}[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Opens with the post already written',
    icon: MessageCircle,
    bg: '#25D366',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    hint: 'Posts the careers link to your feed',
    icon: Users2,
    bg: '#0A66C2',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    hint: 'Story or DM, through the share sheet',
    icon: Camera,
    bg: '#E1306C',
  },
  {
    key: 'more',
    label: 'Somewhere else',
    hint: 'Mail, Telegram, copy — the system sheet',
    icon: Share2,
    bg: '#64748B',
  },
];

const nameOfDept = (v: Job['department_id']): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return null;
  return v.department_name ?? null;
};

const titleOfJob = (v: Candidate['job_id']): string => {
  if (!v) return 'A role';
  return typeof v === 'string' ? 'A role' : (v.title ?? 'A role');
};

/** `15000` → `₹15,000`. Indian grouping, no decimals — this is a bonus, not a bill. */
const inr = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digitsOf = (v: string) => v.replace(/\D/g, '');

/* ── Pipeline rail — the screen's signature ───────────────────────────────── */

/**
 * Five segments, one per stage, equal width.
 *
 * This is the one shape the screen repeats, and it does two jobs: on a card it
 * reports where ONE person has reached, and in the "how it works" strip it
 * teaches what the five stages even are. Same object, two zoom levels — nobody
 * has to learn the pipeline twice.
 *
 * The old version tried to caption all five segments underneath at 10px in a
 * `justify-between` row. Two failures in one: 10px is below the type scale, and
 * `justify-between` does not line captions up with equal-width flex segments —
 * the first hugged the left edge and the last the right, so no label sat under
 * the segment it named. The rail now carries POSITION only; the stage is named
 * once, in a line of readable text beside it.
 */
function PipelineRail({
  reached,
  color,
  track,
}: {
  /** Index into `TRACK`. `-1` fills nothing. */
  reached: number;
  color: string;
  track: string;
}) {
  return (
    <View className="flex-row" style={{ gap: 3 }} accessible={false}>
      {TRACK.map((s, i) => (
        <View
          key={s}
          style={{
            flex: 1,
            height: 5,
            borderRadius: radius.pill,
            backgroundColor: i <= reached ? color : track,
          }}
        />
      ))}
    </View>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

/**
 * The ink band. Deliberately the SAME gradient as the attendance hero
 * (`brand[700] → brand[900]`) rather than a new colour for this screen — one
 * deep-ink hero per screen is the app's language, and a second brand hue here
 * would make Referrals look like a different product.
 *
 * It answers the two questions an employee opens this screen with, in the order
 * they ask them: "what do I get" and "where do my people stand".
 */
function Hero({
  sent,
  inPlay,
  hired,
}: {
  sent: number;
  inPlay: number;
  hired: number;
}) {
  const { brand } = useTheme();

  return (
    <LinearGradient
      colors={[brand[700], brand[900]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: space.screen,
        borderRadius: radius.card,
        padding: space.lg + 2,
        ...shadow.card,
      }}
    >
      <Text
        className={`${T.badge} text-white/85`}
        style={{ letterSpacing: 0.6 }}
        allowFontScaling={false}
      >
        REFERRAL PROGRAMME
      </Text>

      {/* The reward is the headline ONLY when it is configured. With no number
          on file the headline falls back to the count, which is always true —
          an invented bonus figure is the one thing on this screen an employee
          would quote back at HR. See `config/env.REFERRAL_REWARD`. */}
      {REFERRAL_REWARD > 0 ? (
        <>
          <Text className={`mt-2 ${T.kpiHero} text-white`} numberOfLines={1}>
            {inr(REFERRAL_REWARD)}
          </Text>
          <Text className={`${T.body} text-white/75`}>
            paid to you when your referral joins
          </Text>
        </>
      ) : (
        <>
          <Text className={`mt-2 ${T.kpiHero} text-white`} numberOfLines={1}>
            {sent}
          </Text>
          <Text className={`${T.body} text-white/75`}>
            {sent === 1 ? 'person referred by you' : 'people referred by you'}
          </Text>
        </>
      )}

      <View className="mt-5 flex-row items-center">
        {[
          { label: 'Referred', value: sent },
          { label: 'In play', value: inPlay },
          { label: 'Hired', value: hired },
        ].map((stat, i) => (
          <View key={stat.label} className="flex-1 flex-row items-center">
            {i > 0 ? <View className="h-9 w-px bg-white/20" /> : null}
            <View className="flex-1 items-center">
              <Text className={`${T.button} text-white`} allowFontScaling={false}>
                {stat.value}
              </Text>
              <Text className={`mt-0.5 ${T.secondary} text-white/70`}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

/* ── How it works ─────────────────────────────────────────────────────────── */

const STEPS = [
  { icon: Briefcase, title: 'Pick a role', hint: 'Anything open below' },
  { icon: Send, title: 'Send their details', hint: 'Name, contact, CV' },
  { icon: Users, title: 'Track every stage', hint: 'Right here, live' },
];

/**
 * Shown only to somebody with nothing in the pipeline yet.
 *
 * This is the answer to "how do I actually refer someone" — the question the
 * old pitch panel ("Know someone good?") raised and then did not answer. It
 * disappears the moment the first referral exists, because from then on the
 * cards themselves are the better explanation.
 */
function HowItWorks() {
  const { c, brand, tint, dark } = useTheme();

  return (
    <View
      style={{
        marginHorizontal: space.screen,
        marginTop: space.lg,
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <Text style={{ color: c.text }} className={T.cardTitleSm}>
        How referring works
      </Text>

      {/* Three equal columns. The step ORDER carries the sequence — numbered
          discs on top of icons would be two counting systems in one row. */}
      <View className="mt-3.5 flex-row" style={{ gap: space.sm }}>
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <View key={step.title} className="flex-1 items-center">
              <View
                style={{ backgroundColor: tint.bg, borderRadius: radius.well }}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon size={18} strokeWidth={2.2} color={brand[600]} />
              </View>
              <Text
                style={{ color: c.text }}
                className={`mt-2 text-center ${T.micro}`}
                numberOfLines={2}
              >
                {step.title}
              </Text>
              <Text
                style={{ color: c.textFaint }}
                className={`mt-0.5 text-center ${T.nano}`}
                numberOfLines={2}
              >
                {step.hint}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: space.lg }}>
        <PipelineRail reached={-1} color={brand[600]} track={c.fill} />
        <Text style={{ color: c.textMuted }} className={`mt-2 ${T.caption}`}>
          Applied → Screening → Interview → Offer → Hired. You see each move.
        </Text>
      </View>
    </View>
  );
}

/* ── Field ────────────────────────────────────────────────────────────────── */

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  required,
  error,
  hint,
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  required?: boolean;
  error?: string;
  /** Rendered under the input — replaced by the error when there is one. */
  hint?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const { c, dark } = useTheme();
  const bad = toneFor(surface.danger, dark);

  return (
    <View>
      <View className="flex-row items-center gap-1">
        <Text style={{ color: c.textMuted }} className={T.label}>
          {label}
        </Text>
        {/* A required field says so up front. The old form disabled Submit and
            left you to work out which of four inputs was the problem. */}
        {required ? (
          <Text style={{ color: bad.tint }} className={T.label}>
            *
          </Text>
        ) : null}
      </View>

      <View
        style={{
          marginTop: 6,
          backgroundColor: c.fill,
          borderRadius: radius.input,
          borderWidth: 1,
          // A hairline, always — not only in the error state. Fill-on-white is
          // a box you can only locate by its placeholder text, which is exactly
          // what a form should not make you do.
          borderColor: error ? bad.tint : c.border,
          paddingHorizontal: space.md + 2,
          paddingVertical: multiline ? space.md : 0,
          minHeight: multiline ? 96 : 50,
        }}
        className={multiline ? '' : 'justify-center'}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={{ color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14.5 }}
          accessibilityLabel={required ? `${label}, required` : label}
        />
      </View>

      {/* The error REPLACES the hint rather than stacking under it — two lines
          of guidance, one contradicting the other, is how a field ends up
          taller than the input it explains. */}
      {error ? (
        <Text style={{ color: bad.text }} className={`mt-1 ${T.micro}`}>
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={{ color: c.textFaint }}
          className={`mt-1 leading-4 ${T.micro}`}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Job card ─────────────────────────────────────────────────────────────── */

function Meta({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center gap-1">
      <Icon size={11} strokeWidth={2} color={c.textFaint} />
      <Text style={{ color: c.textMuted }} className={T.micro} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/**
 * One open role.
 *
 * The openings count used to be a BRAND-tinted badge. With a brand button in
 * the same card and a brand-tinted panel above the list, three accents were
 * competing on every row — and an accent that appears everywhere stops reading
 * as "this is the action". Openings is now plain meta alongside location and
 * salary, which leaves the Refer button as the only accent in the card.
 */
function JobCard({
  job,
  onRefer,
  onShare,
}: {
  job: Job;
  onRefer: () => void;
  onShare: () => void;
}) {
  const { c, brand, dark } = useTheme();
  const dept = nameOfDept(job.department_id);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <Text style={{ color: c.text }} className={T.cardTitle} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`} numberOfLines={1}>
        {EMPLOYMENT_LABEL[job.employment_type] ?? job.employment_type}
        {job.experience ? ` · ${job.experience}` : ''}
      </Text>

      <View className="mt-2.5 flex-row flex-wrap items-center" style={{ gap: space.md }}>
        <Meta
          icon={Users}
          text={`${job.openings} ${job.openings === 1 ? 'opening' : 'openings'}`}
        />
        {dept ? <Meta icon={Building2} text={dept} /> : null}
        {job.location ? <Meta icon={MapPin} text={job.location} /> : null}
        {job.salary_range ? <Meta icon={IndianRupee} text={job.salary_range} /> : null}
      </View>

      {job.description ? (
        <Text style={{ color: c.textMuted }} className={`mt-2.5 ${T.secondary}`} numberOfLines={3}>
          {job.description}
        </Text>
      ) : null}

      <View className="mt-3.5 flex-row items-center" style={{ gap: space.sm }}>
        <Pressable
          onPress={onRefer}
          accessibilityRole="button"
          accessibilityLabel={`Refer someone for ${job.title}`}
          style={({ pressed }) => ({
            flex: 1,
            height: 44,
            backgroundColor: brand[600],
            borderRadius: radius.pill,
            opacity: pressed ? 0.85 : 1,
          })}
          className="flex-row items-center justify-center gap-2"
        >
          <UserPlus size={16} strokeWidth={2.4} color="#FFFFFF" />
          <Text className="font-ui-semibold text-[13.5px] text-white">Refer someone</Text>
        </Pressable>

        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={`Share the ${job.title} opening`}
          style={({ pressed }) => ({
            height: 44,
            width: 44,
            backgroundColor: c.fill,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          })}
          className="items-center justify-center"
        >
          <Share2 size={17} strokeWidth={2.2} color={c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

/* ── Referral card ────────────────────────────────────────────────────────── */

/**
 * One referred candidate, and where they have reached.
 *
 * A referrer's question is never "what did I submit", it is "what happened to
 * them" — so the stage gets a full line of readable text, and the rail beside
 * it carries the sense of distance travelled.
 */
function ReferralCard({ candidate }: { candidate: Candidate }) {
  const { c, dark } = useTheme();
  const tone = toneFor(STAGE_SURFACE[candidate.stage] ?? surface.neutral, dark);
  const rejected = candidate.stage === 'rejected';
  const reached = TRACK.indexOf(candidate.stage);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
            {candidate.name}
          </Text>
          <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`} numberOfLines={1}>
            {titleOfJob(candidate.job_id)}
            {candidate.createdAt ? ` · referred ${fmtDayShort(candidate.createdAt)}` : ''}
          </Text>
        </View>

        {candidate.resume_url ? (
          <FileText size={14} strokeWidth={2} color={c.textFaint} />
        ) : null}
      </View>

      {rejected ? (
        <View
          style={{
            marginTop: space.md,
            backgroundColor: tone.bg,
            borderRadius: radius.well,
            borderWidth: 1,
            borderColor: tone.border,
            padding: space.md,
          }}
        >
          <Text style={{ color: tone.text }} className={T.caption}>
            {candidate.rejected_reason
              ? `Not taken forward — ${candidate.rejected_reason}`
              : 'Not taken forward this time. Thanks for the referral.'}
          </Text>
        </View>
      ) : (
        <View className="mt-3.5">
          <PipelineRail reached={reached} color={tone.tint} track={c.fill} />

          {/* One readable line replaces five 10px captions. It names the stage
              AND says how far along that is, which the rail alone cannot. */}
          <View className="mt-2 flex-row items-center gap-1.5">
            <View
              style={{ backgroundColor: tone.tint }}
              className="h-1.5 w-1.5 rounded-full"
            />
            <Text style={{ color: tone.text }} className={T.caption}>
              {STAGE_LABEL[candidate.stage]}
            </Text>
            <Text style={{ color: c.textFaint }} className={T.caption}>
              · step {reached + 1} of {TRACK.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Referrals — open roles to refer into, and what happened to the people you
 * already sent.
 *
 * A referred candidate is a NORMAL candidate that knows who sent them: same
 * pipeline, same stages, plus the referrer fields. There is no parallel
 * referral record to keep in sync, which is why the progress you see here is
 * the recruiter's actual board rather than a copy of it.
 */
export default function ReferralScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { c, brand, tint, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);

  const [tab, setTab] = useState<Tab>('roles');
  const [query, setQuery] = useState('');
  const [stageOpen, setStageOpen] = useState(false);
  const [stage, setStage] = useState<CandidateStage | 'all'>('all');

  /** The job the referral form is open for. */
  /**
   * The role a referral is filed against, and whether the form is open.
   *
   * Two pieces of state, not one. The sheet used to BE `referTo`: open it by
   * choosing a job, close it by clearing the job — which meant the form could
   * only ever be reached from a job card, and on a day with no open roles there
   * was no way to refer anybody at all. Now the form opens on its own and the
   * role is a field inside it.
   */
  const [referTo, setReferTo] = useState<Job | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Which job's share sheet is open, by id. */
  const [shareJobId, setShareJobId] = useState<string | null>(null);
  /** Whether the in-sheet role list is expanded. */
  const [rolePick, setRolePick] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    note: '',
    resume: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const jobs = useGetJobsQuery({ status: 'open', limit: 50 });
  const myCode = me?.employee_id;

  const candidates = useGetCandidatesQuery(
    { referrer_code: myCode, limit: 100 },
    { skip: !myCode },
  );
  const [createCandidate, { isLoading: submitting }] = useCreateCandidateMutation();

  const openRoles = useMemo(() => {
    const all = jobs.data?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((j) =>
      [j.title, j.location, j.experience, nameOfDept(j.department_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [jobs.data, query]);

  /**
   * The job whose share sheet is open.
   *
   * Held as an ID rather than the object: the list re-fetches while the sheet
   * is up, and a captured object would go stale the moment HR edits the role
   * out from under it. Looked up against the UNFILTERED list, because the
   * search box can narrow `openRoles` while the sheet is still open.
   */
  const shareJob = useMemo(
    () => (jobs.data?.items ?? []).find((j) => j._id === shareJobId) ?? null,
    [jobs.data, shareJobId],
  );

  /**
   * Everyone I referred, verified on the client.
   *
   * `referrer_code` goes to the server as a hint, but the filter is re-applied
   * here on purpose: a backend that does not know the param would answer with
   * the entire candidate pipeline, and an employee must never see people they
   * did not refer.
   */
  const ownedByMe = useMemo(
    () =>
      (candidates.data?.items ?? []).filter(
        (x) => myCode && (x.referrer_code === myCode || x.referred_by === me?._id),
      ),
    [candidates.data, myCode, me],
  );

  const mine = useMemo(
    () => (stage === 'all' ? ownedByMe : ownedByMe.filter((x) => x.stage === stage)),
    [ownedByMe, stage],
  );

  const stats = useMemo(
    () => ({
      sent: ownedByMe.length,
      hired: ownedByMe.filter((x) => x.stage === 'hired').length,
      // "In play" is what a referrer actually wants counted: still moving.
      inPlay: ownedByMe.filter((x) => x.stage !== 'hired' && x.stage !== 'rejected').length,
    }),
    [ownedByMe],
  );

  /**
   * The post, once — every channel sends the same words.
   *
   * The link is only in it when `EXPO_PUBLIC_CAREERS_URL` is configured. An
   * invented careers URL is worse than none: it is the one line a candidate
   * would actually tap, and a 404 on it is the referrer's credibility, not
   * ours.
   */
  const messageFor = (job: Job): string => {
    const dept = nameOfDept(job.department_id);
    return [
      `We're hiring: ${job.title}`,
      dept ? `Team: ${dept}` : null,
      job.location ? `Location: ${job.location}` : null,
      job.experience ? `Experience: ${job.experience}` : null,
      job.salary_range ? `Package: ${job.salary_range}` : null,
      '',
      job.description?.trim() || null,
      '',
      `Interested? Send me your CV and I'll refer you.${
        me?.first_name ? ` — ${me.first_name}` : ''
      }`,
      CAREERS_URL ? '' : null,
      CAREERS_URL || null,
    ]
      .filter((l) => l !== null)
      .join('\n');
  };

  /**
   * Open a channel with the post already written.
   *
   * What each one actually supports, which is not the same for the three:
   *
   *  · **WhatsApp** takes the text. `whatsapp://send?text=` opens the app's
   *    contact picker with the message loaded; `wa.me` is the fallback for a
   *    phone without WhatsApp installed and lands on the same flow in a
   *    browser.
   *
   *  · **LinkedIn** shares a URL, never text — `share-offsite` has no text
   *    parameter, and there is no deep link that pre-fills the composer. With a
   *    careers URL configured it posts that; without one there is nothing
   *    honest to hand it, so it falls back to the system sheet.
   *
   *  · **Instagram** has no text-sharing entry point at all — its deep links
   *    take images and stories. The system sheet is the only route that
   *    reaches it, and Instagram appears in that sheet.
   *
   * So: WhatsApp gets a real deep link, and the other two are routed to the
   * share sheet rather than being given buttons that quietly do nothing.
   */
  const shareTo = async (job: Job, channel: 'whatsapp' | 'linkedin' | 'instagram' | 'more') => {
    const message = messageFor(job);
    setShareJobId(null);

    try {
      if (channel === 'whatsapp') {
        const text = encodeURIComponent(message);
        const app = `whatsapp://send?text=${text}`;
        const web = `https://wa.me/?text=${text}`;
        const ok = await Linking.canOpenURL(app).catch(() => false);
        await Linking.openURL(ok ? app : web);
        return;
      }

      if (channel === 'linkedin' && CAREERS_URL) {
        await Linking.openURL(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(CAREERS_URL)}`,
        );
        return;
      }

      if (channel === 'instagram') {
        toast.info('Pick Instagram in the share sheet');
      }

      await Share.share({ message });
    } catch {
      toast.error('Share nahi ho paya.');
    }
  };

  /** `job` omitted = opened from the header, with the role still to pick. */
  const openForm = (job?: Job) => {
    setForm({ name: '', phone: '', email: '', note: '', resume: '' });
    setErrors({});
    setReferTo(job ?? null);
    // Straight to the list when nothing is chosen yet: the role is the one
    // field that cannot be typed, and a collapsed picker on an empty form is a
    // step nobody knows they have to take.
    setRolePick(!job);
    setFormOpen(true);
  };

  const closeForm = () => {
    // Not while the referral is in flight — a sheet that vanishes mid-send
    // leaves the referrer with no idea whether it went.
    if (submitting) return;
    setFormOpen(false);
    setRolePick(false);
  };

  /**
   * Everything the form refuses to send, checked in one place.
   *
   * The contact rule is the important one: `name` was the only requirement
   * before, so a referral could reach recruitment with no phone AND no email —
   * a record nobody can act on, which reads to the referrer as "I sent it and
   * nothing happened".
   */
  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    if (!referTo) found.role = 'Pick the role you are referring them for.';

    // Only checked when there is something to check — a resume is optional, but
    // a link that is not a link is a dead end recruitment cannot open.
    const link = form.resume.trim();
    if (link && !LINK_RE.test(normaliseLink(link))) {
      found.resume = 'That does not look like a link. Paste the full URL.';
    }
    if (!name) found.name = 'Their name is needed.';
    if (!phone && !email) {
      const message = 'Give at least one — recruitment has to reach them.';
      found.phone = message;
      found.email = message;
    }
    if (phone && digitsOf(phone).length < 10) {
      found.phone = 'A mobile number needs at least 10 digits.';
    }
    if (email && !isEmail(email)) {
      found.email = 'That does not look like an email address.';
    }
    return found;
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Kuch fields theek karne hain.');
      return;
    }

    const name = form.name.trim();
    try {
      await createCandidate({
        name,
        // Checked by `validate` above — the API has no shape for a referral
        // without a role, so the form refuses to send one rather than posting
        // a body the backend will reject.
        job_id: referTo!._id,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        resume_url: normaliseLink(form.resume) || undefined,
        source: 'referral',
        referred_by: me?._id,
        referrer_name: [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim() || undefined,
        referrer_code: myCode,
        referrer_email: me?.email,
        referral_note: form.note.trim() || undefined,
      }).unwrap();

      setFormOpen(false);
      setRolePick(false);
      setReferTo(null);
      setForm({ name: '', phone: '', email: '', note: '', resume: '' });
      setErrors({});
      toast.success(`${name} referred 🎉`);
      // Straight to the tab that now has something new in it — a success toast
      // over the form you just filled leaves you wondering where it went.
      setTab('mine');
    } catch (e) {
      toast.error(...toastApiError(e));
    }
  };

  const busy = submitting;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.screen,
          paddingBottom: space.lg,
        }}
        className="flex-row items-center gap-3"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} strokeWidth={2.2} color={c.text} />
        </Pressable>

        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.section} numberOfLines={1}>
            Referrals
          </Text>
          {/* With the strip gone this line is the only thing saying which
              view you are on, so it names it before it counts it. */}
          <Text style={{ color: c.textMuted }} className={T.caption} numberOfLines={1}>
            {tab === 'roles'
              ? `Open roles · ${openRoles.length}`
              : `My referrals · ${stats.sent}${stats.hired ? ` · ${stats.hired} hired` : ''}`}
          </Text>
        </View>

        {tab === 'mine' ? (
          <RangeChip
            label={stage === 'all' ? 'All' : STAGE_LABEL[stage]}
            a11y={`Stage ${stage === 'all' ? 'all' : STAGE_LABEL[stage]}. Change stage`}
            onPress={() => setStageOpen(true)}
          />
        ) : null}

        {/* Both views AND the one action, behind a single glyph.
            The strip below the header carried the views and a green "Refer"
            button sat up here — three controls competing for a 360dp row, with
            the button clipping off the right edge. Referring is the thing this
            screen is FOR, so it is the last row of the same menu rather than a
            fourth control. */}
        <ViewMenu<Tab>
          value={tab}
          onChange={setTab}
          options={[
            {
              key: 'roles',
              label: 'Open roles',
              hint: 'What the company is hiring for',
              icon: Briefcase,
              count: openRoles.length,
            },
            {
              key: 'mine',
              label: 'My referrals',
              hint: 'Who you sent, and where they got to',
              icon: Users,
              count: stats.sent,
            },
          ]}
          actions={[
            {
              key: 'refer',
              label: 'Refer a candidate',
              hint: 'Pick a role and send their details',
              icon: UserPlus,
              onPress: () => openForm(),
            },
          ]}
          // Somebody of yours is mid-pipeline and you are not looking at them.
          badge={tab !== 'mine' && stats.inPlay > 0}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={
              tab === 'roles'
                ? jobs.isFetching && !jobs.isLoading
                : candidates.isFetching && !candidates.isLoading
            }
            onRefresh={() => (tab === 'roles' ? jobs.refetch() : candidates.refetch())}
            tintColor={brand[600]}
          />
        }
      >
        {/* The hero sits on BOTH tabs. It is the screen's anchor — the reward
            and your standing do not change because you switched view. */}
        <Hero sent={stats.sent} inPlay={stats.inPlay} hired={stats.hired} />

        {tab === 'roles' ? (
          <>
            {stats.sent === 0 && !candidates.isLoading ? <HowItWorks /> : null}

            {/* ── Search ─────────────────────────────────────────────────── */}
            <View
              style={{
                marginHorizontal: space.screen,
                marginTop: space.lg,
                marginBottom: space.lg,
                backgroundColor: c.card,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: c.border,
              }}
              className="h-12 flex-row items-center gap-2.5 px-3.5"
            >
              <Search size={17} strokeWidth={2} color={c.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search roles"
                placeholderTextColor={c.textFaint}
                style={{ flex: 1, color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14 }}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search open roles"
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <X size={16} strokeWidth={2.4} color={c.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
              {jobs.isLoading ? (
                <>
                  <Skeleton height={190} radius={radius.card} />
                  <Skeleton height={190} radius={radius.card} />
                </>
              ) : jobs.error ? (
                <EmptyState
                  icon={<Briefcase size={32} strokeWidth={1.6} color={brand[600]} />}
                  title="Could not load open roles"
                  message={describeApiError(jobs.error).title}
                  actionLabel="Try again"
                  onAction={() => jobs.refetch()}
                />
              ) : openRoles.length === 0 ? (
                <EmptyState
                  icon={<Briefcase size={32} strokeWidth={1.6} color={brand[600]} />}
                  title={query ? 'No role matches that' : 'No open roles right now'}
                  message={
                    query
                      ? `Nothing open matches "${query.trim()}".`
                      : 'Nothing is hiring at the moment. This fills up as soon as HR opens a position.'
                  }
                  actionLabel={query ? 'Clear search' : undefined}
                  onAction={query ? () => setQuery('') : undefined}
                />
              ) : (
                openRoles.map((j) => (
                  <JobCard
                    key={j._id}
                    job={j}
                    onRefer={() => openForm(j)}
                    onShare={() => setShareJobId(j._id)}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          <View
            style={{
              paddingHorizontal: space.screen,
              paddingTop: space.lg,
              gap: space.md,
            }}
          >
            {candidates.isLoading ? (
              <>
                <Skeleton height={120} radius={radius.card} />
                <Skeleton height={120} radius={radius.card} />
              </>
            ) : candidates.error ? (
              <EmptyState
                icon={<Users size={32} strokeWidth={1.6} color={brand[600]} />}
                title="Could not load your referrals"
                message={describeApiError(candidates.error).title}
                actionLabel="Try again"
                onAction={() => candidates.refetch()}
              />
            ) : mine.length === 0 ? (
              <EmptyState
                icon={<UserPlus size={32} strokeWidth={1.6} color={brand[600]} />}
                title={stage === 'all' ? 'No referrals yet' : `Nobody at ${STAGE_LABEL[stage]}`}
                message={
                  stage === 'all'
                    ? 'Refer someone to an open role and their progress shows up here, stage by stage.'
                    : 'Try another stage, or refer someone new.'
                }
                actionLabel={stage === 'all' ? 'Refer someone' : 'Show all'}
                onAction={
                  stage === 'all' ? () => openForm() : () => setStage('all')
                }
              />
            ) : (
              mine.map((x) => <ReferralCard key={x._id} candidate={x} />)
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Refer form ───────────────────────────────────────────────────
          A sheet, not a screen: it is a few fields against a role you already
          chose, and pushing a whole screen for that loses the context the
          heading depends on. `avoidKeyboard` because a Modal gets none from
          the OS, and without it the last two fields are typed into blind. */}
      <BottomSheet
        visible={formOpen}
        onClose={closeForm}
        maxHeightRatio={0.9}
        avoidKeyboard
      >
        <ScrollView
          // Shrinks into whatever the panel allows and scrolls inside it. An
          // unbounded ScrollView in a capped sheet measures to its own content,
          // overflows, and is clipped without ever becoming scrollable — the
          // same failure documented in `PunchSheet`.
          style={{ flexShrink: 1, flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.screen }}
        >
          <Text style={{ color: c.text }} className={T.section}>
            Refer a candidate
          </Text>
          <Text style={{ color: c.textMuted }} className={`mt-1 ${T.secondary}`}>
            {referTo
              ? `${referTo.title}${
                  nameOfDept(referTo.department_id)
                    ? ` · ${nameOfDept(referTo.department_id)}`
                    : ''
                }`
              : 'Pick the role, then tell recruitment who they should meet.'}
          </Text>

          <View style={{ marginTop: space.lg, gap: space.lg }}>
            {/* ── Role ─────────────────────────────────────────────────────
                A field, not a precondition. Opening this form from a job card
                fills it in; opening it from the header leaves it to be chosen
                here — and either way the referral goes against a real opening,
                because the API has nowhere to put one that does not. */}
            <View>
              <Text style={{ color: c.textMuted }} className={T.label}>
                Role <Text style={{ color: surface.danger.tint }}>*</Text>
              </Text>

              <Pressable
                onPress={() => setRolePick((v) => !v)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ expanded: rolePick, disabled: busy }}
                accessibilityLabel={
                  referTo ? `Role: ${referTo.title}. Change it` : 'Pick a role'
                }
                style={({ pressed }) => ({
                  marginTop: 6,
                  minHeight: 50,
                  backgroundColor: c.fill,
                  borderRadius: radius.input,
                  borderWidth: 1,
                  borderColor: errors.role
                    ? surface.danger.tint
                    : rolePick
                      ? brand[600]
                      : c.border,
                  paddingHorizontal: space.md + 2,
                  opacity: pressed || busy ? 0.7 : 1,
                })}
                className="flex-row items-center gap-2.5"
              >
                <Briefcase
                  size={17}
                  strokeWidth={2}
                  color={referTo ? brand[600] : c.textFaint}
                />
                <Text
                  style={{ color: referTo ? c.text : c.textFaint }}
                  className={`flex-1 ${T.body}`}
                  numberOfLines={1}
                >
                  {referTo ? referTo.title : 'Choose an open role'}
                </Text>
                <ChevronDown
                  size={18}
                  strokeWidth={2.2}
                  color={c.textFaint}
                  style={{ transform: [{ rotate: rolePick ? '180deg' : '0deg' }] }}
                />
              </Pressable>

              {errors.role ? (
                <Text
                  style={{ color: surface.danger.tint }}
                  className={`mt-1 ${T.micro}`}
                >
                  {errors.role}
                </Text>
              ) : null}

              {rolePick ? (
                <View
                  style={{
                    marginTop: space.xs,
                    backgroundColor: c.fill,
                    borderRadius: radius.input,
                    borderWidth: 1,
                    borderColor: c.border,
                    overflow: 'hidden',
                  }}
                >
                  {openRoles.length === 0 ? (
                    <Text
                      style={{ color: c.textMuted, padding: space.lg }}
                      className={T.micro}
                    >
                      Nothing is open right now. A referral has to go against a
                      live opening — this fills up as soon as HR posts one.
                    </Text>
                  ) : (
                    openRoles.map((j, i) => {
                      const active = referTo?._id === j._id;
                      const dept = nameOfDept(j.department_id);
                      return (
                        <Pressable
                          key={j._id}
                          onPress={() => {
                            setReferTo(j);
                            setRolePick(false);
                            setErrors((e) => {
                              const next = { ...e };
                              delete next.role;
                              return next;
                            });
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={j.title}
                          style={({ pressed }) => ({
                            paddingHorizontal: space.lg,
                            paddingVertical: space.md,
                            backgroundColor: active
                              ? tint.bg
                              : pressed
                                ? c.bg
                                : 'transparent',
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: c.border,
                          })}
                          className="flex-row items-center gap-2.5"
                        >
                          <View className="flex-1">
                            <Text
                              style={{ color: active ? tint.text : c.text }}
                              className={T.cardTitleSm}
                              numberOfLines={1}
                            >
                              {j.title}
                            </Text>
                            {dept || j.location ? (
                              <Text
                                style={{ color: c.textMuted }}
                                className={`mt-0.5 ${T.micro}`}
                                numberOfLines={1}
                              >
                                {[dept, j.location].filter(Boolean).join(' · ')}
                              </Text>
                            ) : null}
                          </View>
                          {active ? (
                            <Check size={16} strokeWidth={2.6} color={brand[600]} />
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>

            <Field
              label="Candidate name"
              required
              error={errors.name}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Full name"
            />
            <Field
              label="Phone"
              error={errors.phone}
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Field
              label="Email"
              error={errors.email}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* ── Resume ───────────────────────────────────────────────────
                A link, not an upload. Optional, but the single thing that moves
                a referral fastest — a recruiter with a CV can screen today. */}
            <Field
              label="Resume link"
              error={errors.resume}
              value={form.resume}
              onChangeText={(v) => setForm((f) => ({ ...f, resume: v }))}
              placeholder="Paste a Drive / Dropbox link"
              keyboardType="default"
              autoCapitalize="none"
              hint="Set sharing to “anyone with the link” — recruitment cannot request access on your behalf."
            />

            <Field
              label="Why them?"
              value={form.note}
              onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
              placeholder="How you know them, what they're good at…"
              multiline
              autoCapitalize="sentences"
            />
          </View>

          <View style={{ marginTop: space.xl }}>
            <Button
              label="Send referral"
              icon={<UserPlus size={18} strokeWidth={2.2} color="#FFFFFF" />}
              loading={submitting}
              disabled={busy}
              onPress={submit}
            />
          </View>

          {/* Under the button, not above it. This is the small print on what
              pressing it does — read after the commitment is in view, and it
              stops pushing the button off a keyboard-shortened sheet. */}
          <Text
            style={{ color: c.textFaint }}
            className={`mt-3 text-center leading-4 ${T.micro}`}
          >
            Your name and employee ID go with the referral, so recruitment knows
            who to credit. Follow every stage under My referrals.
          </Text>
        </ScrollView>
      </BottomSheet>

      {/* ── Share to ──────────────────────────────────────────────────────
          Named channels rather than only the system sheet: "share this role"
          is, in practice, three specific apps, and making someone hunt for
          WhatsApp in a grid of thirty targets every time is the difference
          between a role being passed on and not. */}
      <BottomSheet
        visible={Boolean(shareJob)}
        onClose={() => setShareJobId(null)}
        maxHeightRatio={0.6}
      >
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text style={{ color: c.text }} className={T.section}>
            Share this role
          </Text>
          <Text
            style={{ color: c.textMuted }}
            className={`mb-1 ${T.secondary}`}
            numberOfLines={2}
          >
            {shareJob?.title}
            {nameOfDept(shareJob?.department_id ?? null)
              ? ` · ${nameOfDept(shareJob?.department_id ?? null)}`
              : ''}
          </Text>

          {SHARE_CHANNELS.map((ch) => (
            <Pressable
              key={ch.key}
              onPress={() => (shareJob ? shareTo(shareJob, ch.key) : undefined)}
              accessibilityRole="button"
              accessibilityLabel={`${ch.label}. ${ch.hint}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingHorizontal: space.md,
                paddingVertical: space.md,
                borderRadius: radius.well,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.well,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ch.bg,
                }}
              >
                <ch.icon size={18} strokeWidth={2.2} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text }} className={T.cardTitleSm}>
                  {ch.label}
                </Text>
                <Text
                  style={{ color: c.textMuted }}
                  className={`mt-0.5 ${T.micro}`}
                  numberOfLines={1}
                >
                  {ch.key === 'linkedin' && !CAREERS_URL
                    ? 'Needs a careers link — opens the share sheet'
                    : ch.hint}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* ── Stage filter ─────────────────────────────────────────────────── */}
      <BottomSheet visible={stageOpen} onClose={() => setStageOpen(false)} maxHeightRatio={0.6}>
        <View style={{ padding: space.screen, gap: space.sm }}>
          <Text style={{ color: c.text }} className={T.section}>
            Filter by stage
          </Text>
          {(['all', ...CANDIDATE_STAGES] as (CandidateStage | 'all')[]).map((s) => {
            const active = s === stage;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  setStage(s);
                  setStageOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  backgroundColor: active ? tint.bg : c.fill,
                  borderRadius: radius.well,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="h-12 flex-row items-center justify-between px-4"
              >
                <Text
                  style={{ color: active ? tint.text : c.text }}
                  className={T.cardTitleSm}
                >
                  {s === 'all' ? 'All stages' : STAGE_LABEL[s]}
                </Text>
                {s !== 'all' ? (
                  <View
                    style={{ backgroundColor: toneFor(STAGE_SURFACE[s], dark).tint }}
                    className="h-2 w-2 rounded-full"
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
