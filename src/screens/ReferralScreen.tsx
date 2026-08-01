import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  Briefcase,
  Building2,
  ChevronLeft,
  IndianRupee,
  MapPin,
  Search,
  Share2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
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
import { Badge, Button, EmptyState, RangeChip, Segmented, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
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
import { radius, shadow, space, surface, type Surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';
import { fmtDayShort } from '../utils/date';

type Tab = 'roles' | 'mine';

/** The pipeline as a referrer sees it. `rejected` is an exit, not a step. */
const TRACK: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];

const STAGE_SURFACE: Record<CandidateStage, Surface> = {
  applied: surface.neutral,
  screening: surface.info,
  interview: surface.warning,
  offer: surface.purple,
  hired: surface.success,
  rejected: surface.danger,
};

const nameOfDept = (v: Job['department_id']): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return null;
  return v.department_name ?? null;
};

const titleOfJob = (v: Candidate['job_id']): string => {
  if (!v) return 'A role';
  return typeof v === 'string' ? 'A role' : (v.title ?? 'A role');
};

/* ── Field ────────────────────────────────────────────────────────────────── */

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={{ color: c.textMuted }} className={T.label}>
        {label}
      </Text>
      <View
        style={{
          marginTop: 6,
          backgroundColor: c.fill,
          borderRadius: radius.input,
          paddingHorizontal: space.lg,
          paddingVertical: multiline ? space.md : 0,
          minHeight: multiline ? 90 : 50,
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
          accessibilityLabel={label}
        />
      </View>
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

function JobCard({
  job,
  onRefer,
  onShare,
}: {
  job: Job;
  onRefer: () => void;
  onShare: () => void;
}) {
  const { c, brand, primary, dark } = useTheme();
  const dept = nameOfDept(job.department_id);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.lg,
        ...(dark ? shadow.none : shadow.soft),
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text style={{ color: c.text }} className={T.cardTitle} numberOfLines={2}>
            {job.title}
          </Text>
          <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`} numberOfLines={1}>
            {EMPLOYMENT_LABEL[job.employment_type] ?? job.employment_type}
            {job.experience ? ` · ${job.experience}` : ''}
          </Text>
        </View>

        {/* Openings is the number that decides whether it is worth referring
            anyone at all, so it gets the badge. */}
        <Badge
          label={`${job.openings} ${job.openings === 1 ? 'opening' : 'openings'}`}
          tone={primary}
        />
      </View>

      {dept || job.location || job.salary_range ? (
        <View className="mt-2.5 flex-row flex-wrap items-center" style={{ gap: space.md }}>
          {dept ? <Meta icon={Building2} text={dept} /> : null}
          {job.location ? <Meta icon={MapPin} text={job.location} /> : null}
          {job.salary_range ? <Meta icon={IndianRupee} text={job.salary_range} /> : null}
        </View>
      ) : null}

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
            height: 42,
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
            height: 42,
            width: 42,
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
 * One referred candidate, with where they have reached.
 *
 * The track is the whole point of this tab: a referrer's question is never
 * "what did I submit", it is "what happened to them". A rejected candidate
 * drops the track entirely — walking a dead pipeline is worse than being told
 * plainly that it ended.
 */
function ReferralCard({ candidate }: { candidate: Candidate }) {
  const { c, brand, dark } = useTheme();
  const tone = STAGE_SURFACE[candidate.stage] ?? surface.neutral;
  const rejected = candidate.stage === 'rejected';
  const reached = TRACK.indexOf(candidate.stage);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.card - 4,
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
        <Badge label={STAGE_LABEL[candidate.stage] ?? candidate.stage} tone={tone} />
      </View>

      {rejected ? (
        <Text style={{ color: c.textMuted }} className={`mt-3 ${T.secondary}`}>
          {candidate.rejected_reason
            ? `Not taken forward — ${candidate.rejected_reason}`
            : 'Not taken forward this time. Thanks for the referral.'}
        </Text>
      ) : (
        <View className="mt-3.5">
          {/* Segments, not a bar: five named steps, and the one you are on has
              to be readable without counting pixels. */}
          <View className="flex-row" style={{ gap: 4 }}>
            {TRACK.map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: i <= reached ? brand[600] : c.fill,
                }}
              />
            ))}
          </View>
          <View className="mt-1.5 flex-row justify-between">
            {TRACK.map((s, i) => (
              <Text
                key={s}
                style={{ color: i === reached ? brand[600] : c.textFaint }}
                className={T.nano}
                allowFontScaling={false}
              >
                {STAGE_LABEL[s]}
              </Text>
            ))}
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
  const { c, brand, primary, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);

  const [tab, setTab] = useState<Tab>('roles');
  const [query, setQuery] = useState('');
  const [stageOpen, setStageOpen] = useState(false);
  const [stage, setStage] = useState<CandidateStage | 'all'>('all');

  /** The job the referral form is open for. */
  const [referTo, setReferTo] = useState<Job | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' });

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
   * MINE, verified on the client.
   *
   * `referrer_code` goes to the server as a hint, but the filter is re-applied
   * here on purpose: a backend that does not know the param would answer with
   * the entire candidate pipeline, and an employee must never see people they
   * did not refer.
   */
  const mine = useMemo(() => {
    const all = candidates.data?.items ?? [];
    const ownedByMe = all.filter(
      (x) => myCode && (x.referrer_code === myCode || x.referred_by === me?._id),
    );
    return stage === 'all' ? ownedByMe : ownedByMe.filter((x) => x.stage === stage);
  }, [candidates.data, myCode, me, stage]);

  const hiredCount = useMemo(
    () => (candidates.data?.items ?? []).filter(
      (x) => (x.referrer_code === myCode || x.referred_by === me?._id) && x.stage === 'hired',
    ).length,
    [candidates.data, myCode, me],
  );

  const totalMine = useMemo(
    () =>
      (candidates.data?.items ?? []).filter(
        (x) => myCode && (x.referrer_code === myCode || x.referred_by === me?._id),
      ).length,
    [candidates.data, myCode, me],
  );

  const shareJob = async (job: Job) => {
    const dept = nameOfDept(job.department_id);
    const lines = [
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
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      toast.error('Share nahi ho paya.');
    }
  };

  const submit = async () => {
    if (!referTo) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Candidate ka naam chahiye.");
      return;
    }
    try {
      await createCandidate({
        name,
        job_id: referTo._id,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: 'referral',
        referred_by: me?._id,
        referrer_name: [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim() || undefined,
        referrer_code: myCode,
        referrer_email: me?.email,
        referral_note: form.note.trim() || undefined,
      }).unwrap();

      setReferTo(null);
      setForm({ name: '', phone: '', email: '', note: '' });
      toast.success(`${name} referred 🎉`);
      // Straight to the tab that now has something new in it — a success toast
      // over the form you just filled leaves you wondering where it went.
      setTab('mine');
    } catch (e) {
      toast.error(describeApiError(e).title);
    }
  };

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
          <Text style={{ color: c.textMuted }} className={T.caption} numberOfLines={1}>
            {tab === 'roles'
              ? `${openRoles.length} open ${openRoles.length === 1 ? 'role' : 'roles'}`
              : `${totalMine} referred${hiredCount ? ` · ${hiredCount} hired` : ''}`}
          </Text>
        </View>

        {tab === 'mine' ? (
          <RangeChip
            label={stage === 'all' ? 'All' : STAGE_LABEL[stage]}
            a11y={`Stage ${stage === 'all' ? 'all' : STAGE_LABEL[stage]}. Change stage`}
            onPress={() => setStageOpen(true)}
          />
        ) : null}
      </View>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: space.screen, paddingBottom: space.lg }}>
        <Segmented<Tab>
          segments={[
            { key: 'roles', label: 'Open Roles', count: openRoles.length },
            { key: 'mine', label: 'My Referrals', count: totalMine },
          ]}
          value={tab}
          onChange={setTab}
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
        {tab === 'roles' ? (
          <>
            {/* ── Pitch ──────────────────────────────────────────────────
                No rupee figure here on purpose: the app has no endpoint that
                knows the reward, and a number nobody can verify is the fastest
                way to lose trust in the whole screen. */}
            <View
              style={{
                marginHorizontal: space.screen,
                marginBottom: space.lg,
                backgroundColor: dark ? c.card : primary.bg,
                borderRadius: radius.card - 4,
                borderWidth: 1,
                borderColor: dark ? c.border : primary.border,
                padding: space.lg,
              }}
              className="flex-row items-center gap-3"
            >
              <View
                style={{ backgroundColor: brand[600], borderRadius: radius.well }}
                className="h-11 w-11 items-center justify-center"
              >
                <Users size={20} strokeWidth={2.2} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text style={{ color: c.text }} className={T.cardTitleSm}>
                  Know someone good?
                </Text>
                <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`}>
                  Refer them to an open role and track every stage right here.
                </Text>
              </View>
            </View>

            {/* ── Search ─────────────────────────────────────────────────── */}
            <View
              style={{
                marginHorizontal: space.screen,
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
                  <Skeleton height={170} radius={radius.card - 4} />
                  <Skeleton height={170} radius={radius.card - 4} />
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
                    onRefer={() => {
                      setForm({ name: '', phone: '', email: '', note: '' });
                      setReferTo(j);
                    }}
                    onShare={() => shareJob(j)}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: space.screen, gap: space.md }}>
            {candidates.isLoading ? (
              <>
                <Skeleton height={120} radius={radius.card - 4} />
                <Skeleton height={120} radius={radius.card - 4} />
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
                title={
                  stage === 'all' ? 'No referrals yet' : `Nobody at ${STAGE_LABEL[stage]}`
                }
                message={
                  stage === 'all'
                    ? 'Refer someone to an open role and their progress shows up here, stage by stage.'
                    : 'Try another stage, or refer someone new.'
                }
                actionLabel={stage === 'all' ? 'See open roles' : 'Show all'}
                onAction={
                  stage === 'all' ? () => setTab('roles') : () => setStage('all')
                }
              />
            ) : (
              mine.map((x) => <ReferralCard key={x._id} candidate={x} />)
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Refer form ───────────────────────────────────────────────────
          A sheet, not a screen: it is four fields against a role you already
          chose, and pushing a whole screen for that loses the context the
          heading depends on. */}
      <BottomSheet
        visible={Boolean(referTo)}
        onClose={() => (submitting ? undefined : setReferTo(null))}
        maxHeightRatio={0.9}
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
            {referTo?.title}
            {nameOfDept(referTo?.department_id) ? ` · ${nameOfDept(referTo?.department_id)}` : ''}
          </Text>

          <View style={{ marginTop: space.xl, gap: space.lg }}>
            <Field
              label="Candidate name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Full name"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Field
              label="Email"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
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

          <Text style={{ color: c.textFaint }} className={`mt-4 leading-4 ${T.micro}`}>
            Your name and employee ID go with the referral, so recruitment knows
            who to credit. You can follow every stage under My Referrals.
          </Text>

          <View style={{ marginTop: space.xl }}>
            <Button
              label="Send referral"
              icon={<UserPlus size={18} strokeWidth={2.2} color="#FFFFFF" />}
              loading={submitting}
              disabled={!form.name.trim()}
              onPress={submit}
            />
          </View>
        </ScrollView>
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
                  backgroundColor: active ? primary.bg : c.fill,
                  borderRadius: radius.well,
                  opacity: pressed ? 0.7 : 1,
                })}
                className="h-12 flex-row items-center justify-between px-4"
              >
                <Text
                  style={{ color: active ? brand[700] : c.text }}
                  className={T.cardTitleSm}
                >
                  {s === 'all' ? 'All stages' : STAGE_LABEL[s]}
                </Text>
                {s !== 'all' ? (
                  <View
                    style={{ backgroundColor: STAGE_SURFACE[s].tint }}
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
