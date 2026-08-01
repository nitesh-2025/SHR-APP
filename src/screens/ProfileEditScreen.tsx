import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Skeleton } from '../components/ui';
import { describeApiError } from '../lib/apiError';
import { toast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  type EmployeeProfile,
  type UpdateEmployeeBody,
} from '../store/employeesApi';
import { radius, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

export type ProfileSection = 'personal' | 'bank' | 'emergency';

/* ── Field spec ───────────────────────────────────────────────────────────── */

type FieldKind = 'text' | 'email' | 'phone' | 'date' | 'choice';

interface FieldSpec {
  /** Dot path into the PATCH body — `emergency_contact.phone` nests one level. */
  path: string;
  label: string;
  placeholder: string;
  kind?: FieldKind;
  choices?: { value: string; label: string }[];
  /** Sentence-case for free text; names stay word-case; ids stay untouched. */
  caps?: 'none' | 'words' | 'sentences' | 'characters';
}

/**
 * What each section may change.
 *
 * Driven by a spec rather than hand-written inputs because all three sections
 * are the same form with different rows — and because `PATCH /employees/me`
 * silently ignores admin-owned fields, so the list of what an employee may edit
 * has to be stated somewhere the UI can actually see it. Employee id,
 * department, designation and status are deliberately absent: they are HR's to
 * set, and rendering them as inputs that never save is worse than not offering
 * them.
 */
const SECTIONS: Record<
  ProfileSection,
  { title: string; subtitle: string; fields: FieldSpec[] }
> = {
  personal: {
    title: 'Personal Information',
    subtitle: 'How the company reaches you, and who you are on paper',
    fields: [
      { path: 'phone', label: 'Phone', placeholder: '10-digit mobile', kind: 'phone', caps: 'none' },
      {
        path: 'personal_email',
        label: 'Personal email',
        placeholder: 'you@example.com',
        kind: 'email',
        caps: 'none',
      },
      { path: 'date_of_birth', label: 'Date of birth', placeholder: 'YYYY-MM-DD', kind: 'date', caps: 'none' },
      {
        path: 'gender',
        label: 'Gender',
        placeholder: 'Select',
        kind: 'choice',
        choices: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        path: 'marital_status',
        label: 'Marital status',
        placeholder: 'Select',
        kind: 'choice',
        choices: [
          { value: 'single', label: 'Single' },
          { value: 'married', label: 'Married' },
          { value: 'other', label: 'Other' },
        ],
      },
      { path: 'blood_group', label: 'Blood group', placeholder: 'e.g. O+', caps: 'characters' },
      { path: 'father_name', label: "Father's name", placeholder: 'Full name' },
      { path: 'mother_name', label: "Mother's name", placeholder: 'Full name' },
      { path: 'address', label: 'Address', placeholder: 'House, street, city, PIN', caps: 'sentences' },
      { path: 'location', label: 'Work location', placeholder: 'City / office', caps: 'words' },
    ],
  },
  emergency: {
    title: 'Emergency Contact',
    subtitle: 'Who the company calls if something happens at work',
    fields: [
      { path: 'emergency_contact.name', label: 'Contact name', placeholder: 'Full name' },
      {
        path: 'emergency_contact.relation',
        label: 'Relationship',
        placeholder: 'e.g. Spouse, Father',
      },
      {
        path: 'emergency_contact.phone',
        label: 'Contact phone',
        placeholder: '10-digit mobile',
        kind: 'phone',
        caps: 'none',
      },
    ],
  },
  bank: {
    title: 'Bank Details',
    subtitle: 'Where your salary is credited',
    fields: [
      {
        path: 'bank_details.account_holder_name',
        label: 'Account holder name',
        placeholder: 'Exactly as printed on the passbook',
      },
      {
        path: 'bank_details.account_number',
        label: 'Account number',
        placeholder: 'Account number',
        kind: 'phone',
        caps: 'none',
      },
      {
        path: 'bank_details.ifsc_code',
        label: 'IFSC code',
        placeholder: 'e.g. HDFC0001234',
        caps: 'characters',
      },
      { path: 'bank_details.bank_name', label: 'Bank name', placeholder: 'Bank' },
      { path: 'bank_details.branch', label: 'Branch', placeholder: 'Branch' },
    ],
  },
};

/* ── Path helpers ─────────────────────────────────────────────────────────── */

function readPath(source: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      source,
    );
  if (value === null || value === undefined) return '';
  // A date arrives as a full ISO stamp; the field edits the day only.
  return String(value).slice(0, path.endsWith('date_of_birth') ? 10 : undefined);
}

function writePath(target: Record<string, unknown>, path: string, value: string) {
  const keys = path.split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

/** `2026-08-01` and nothing else — the server stores a date, not a sentence. */
const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ── Input ────────────────────────────────────────────────────────────────── */

function FieldInput({
  spec,
  value,
  error,
  disabled,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const { c, brand, primary } = useTheme();

  if (spec.kind === 'choice') {
    return (
      <View>
        <Text style={{ color: c.textMuted }} className={T.label}>
          {spec.label}
        </Text>
        <View className="mt-1.5 flex-row" style={{ gap: space.sm }}>
          {(spec.choices ?? []).map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => (disabled ? undefined : onChange(active ? '' : o.value))}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={`${spec.label}: ${o.label}`}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 46,
                  backgroundColor: active ? primary.bg : c.fill,
                  borderRadius: radius.well,
                  borderWidth: 1,
                  borderColor: active ? brand[600] : 'transparent',
                  opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
                })}
                className="items-center justify-center"
              >
                <Text
                  style={{ color: active ? brand[700] : c.textMuted }}
                  className={T.buttonSm}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const multiline = spec.path === 'address';

  return (
    <View>
      <Text style={{ color: c.textMuted }} className={T.label}>
        {spec.label}
      </Text>
      <View
        style={{
          marginTop: 6,
          backgroundColor: c.fill,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: error ? surface.danger.tint : 'transparent',
          paddingHorizontal: space.lg,
          paddingVertical: multiline ? space.md : 0,
          minHeight: multiline ? 88 : 50,
          opacity: disabled ? 0.6 : 1,
        }}
        className={multiline ? '' : 'justify-center'}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          placeholder={spec.placeholder}
          placeholderTextColor={c.textFaint}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={
            spec.kind === 'phone'
              ? 'number-pad'
              : spec.kind === 'email'
                ? 'email-address'
                : 'default'
          }
          autoCapitalize={spec.caps ?? 'words'}
          autoCorrect={false}
          style={{ color: c.text, fontFamily: 'Outfit_500Medium', fontSize: 14.5 }}
          accessibilityLabel={spec.label}
        />
      </View>
      {error ? (
        <Text style={{ color: surface.danger.text }} className={`mt-1 ${T.micro}`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/**
 * Edit one section of my own record — `PATCH /employees/me`.
 *
 * Only CHANGED fields are sent. A PATCH that echoes back every value the form
 * loaded would overwrite anything HR edited between this screen opening and the
 * save, and it makes the audit trail claim ten fields changed when one did.
 */
export default function ProfileEditScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProfileEdit'>>();
  const insets = useSafeAreaInsets();
  const { c, brand, dark } = useTheme();

  const section = route.params?.section ?? 'personal';
  const spec = SECTIONS[section];

  const { data, isLoading, error, refetch } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateMyProfileMutation();

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** What the server currently holds, flattened onto this section's paths. */
  const original = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of spec.fields) out[f.path] = readPath(data as EmployeeProfile | undefined, f.path);
    return out;
  }, [data, spec]);

  // Seed the form once the record lands. Keyed on `original` so a pull-to-
  // refresh that changes nothing does not stomp on what is being typed.
  useEffect(() => {
    setValues(original);
  }, [original]);

  const locked = Boolean(data?.is_lock);

  const dirty = useMemo(
    () => spec.fields.filter((f) => (values[f.path] ?? '') !== (original[f.path] ?? '')),
    [spec, values, original],
  );

  const save = async () => {
    if (locked || dirty.length === 0) return;

    // Validate only what is being SENT — an old bad value already on the record
    // is not this save's problem to block.
    const found: Record<string, string> = {};
    for (const f of dirty) {
      const v = (values[f.path] ?? '').trim();
      if (!v) continue;
      if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        found[f.path] = 'That does not look like an email address.';
      }
      if (f.kind === 'date' && !isYmd(v)) {
        found[f.path] = 'Use YYYY-MM-DD, e.g. 1996-04-21.';
      }
      if (f.path === 'phone' && v.replace(/\D/g, '').length < 10) {
        found[f.path] = 'A phone number needs at least 10 digits.';
      }
      if (f.path === 'bank_details.ifsc_code' && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) {
        found[f.path] = 'An IFSC looks like HDFC0001234.';
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Kuch fields theek karne hain.');
      return;
    }

    // Only the changed paths. Nested ones rebuild their parent object, because
    // the API takes `emergency_contact` whole rather than by leaf.
    const body: Record<string, unknown> = {};
    for (const f of dirty) writePath(body, f.path, (values[f.path] ?? '').trim());

    // A nested group must carry its untouched siblings too — sending
    // `{ emergency_contact: { phone } }` would blank the name.
    for (const group of ['emergency_contact', 'bank_details']) {
      if (!body[group]) continue;
      const whole: Record<string, string> = {};
      for (const f of spec.fields) {
        if (!f.path.startsWith(`${group}.`)) continue;
        whole[f.path.split('.')[1]] = (values[f.path] ?? '').trim();
      }
      body[group] = whole;
    }

    try {
      await updateProfile(body as UpdateEmployeeBody).unwrap();
      toast.success('Profile updated');
      navigation.goBack();
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
            {spec.title}
          </Text>
          <Text style={{ color: c.textMuted }} className={T.caption} numberOfLines={1}>
            {dirty.length > 0
              ? `${dirty.length} unsaved ${dirty.length === 1 ? 'change' : 'changes'}`
              : spec.subtitle}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screen,
            paddingBottom: space.xxxl,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <>
              <Skeleton height={72} radius={radius.input} />
              <Skeleton height={72} radius={radius.input} />
              <Skeleton height={72} radius={radius.input} />
            </>
          ) : error ? (
            <EmptyState
              icon={<Lock size={32} strokeWidth={1.6} color={brand[600]} />}
              title="Could not load your profile"
              message={describeApiError(error).title}
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : (
            <>
              {/* A frozen record is not a failed save — say so BEFORE anyone
                  types a paragraph they cannot submit. */}
              {locked ? (
                <View
                  style={{
                    backgroundColor: dark ? c.card : surface.warning.bg,
                    borderRadius: radius.well,
                    borderWidth: 1,
                    borderColor: dark ? c.border : surface.warning.border,
                    padding: space.md,
                  }}
                  className="flex-row items-center gap-2.5"
                >
                  <Lock size={16} strokeWidth={2.2} color={surface.warning.tint} />
                  <Text style={{ color: c.text }} className={`flex-1 ${T.micro}`}>
                    Your record is locked by HR. You can read it here, but changes have
                    to go through them until it is unlocked.
                  </Text>
                </View>
              ) : null}

              {spec.fields.map((f) => (
                <FieldInput
                  key={f.path}
                  spec={f}
                  value={values[f.path] ?? ''}
                  error={errors[f.path]}
                  disabled={locked || saving}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [f.path]: v }));
                    if (errors[f.path]) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next[f.path];
                        return next;
                      });
                    }
                  }}
                />
              ))}
            </>
          )}
        </ScrollView>

        {/* ── Save ───────────────────────────────────────────────────────
            Disabled until something actually changed: a live Save on an
            untouched form invites a PATCH that says nothing. */}
        {!isLoading && !error ? (
          <View
            style={{
              paddingHorizontal: space.screen,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.md,
              backgroundColor: c.card,
              borderTopWidth: 1,
              borderTopColor: c.border,
            }}
          >
            <Button
              label={dirty.length > 0 ? `Save ${dirty.length} change${dirty.length === 1 ? '' : 's'}` : 'Save'}
              loading={saving}
              disabled={locked || dirty.length === 0}
              onPress={save}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
