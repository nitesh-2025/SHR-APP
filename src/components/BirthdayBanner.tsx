import { LinearGradient } from 'expo-linear-gradient';
import { Cake, ChevronRight, PartyPopper } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, personUser } from './Avatar';
import { selectCurrentUser, useAppSelector } from '../store';
import { useGetUpcomingBirthdaysQuery } from '../store/employeesApi';
import { radius, shadow, space, surface } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../theme/type';

/** How many faces the stack shows before it starts counting instead. */
const FACES = 3;

/**
 * Today's birthdays, on the home screen.
 *
 * `mine` renders ONLY on the signed-in user's own birthday and `others` only
 * when someone else is celebrating — both render nothing on all the other days
 * of the year. That is the whole point: a permanent "no birthdays today" row
 * would spend a card of the home screen, every day, to say nothing.
 *
 * Two scopes because the two belong in different places. Being wished is the
 * first thing you should see; wishing someone else is a nudge that sits under
 * the day's actual work.
 *
 * Both scopes read the SAME cached query — RTK Query dedupes by argument, so
 * rendering both costs one request.
 */
export function BirthdayBanner({
  scope,
  onPress,
}: {
  scope: 'mine' | 'others';
  onPress: () => void;
}) {
  const { c, brand, dark } = useTheme();
  const me = useAppSelector(selectCurrentUser);

  // A day's window is all this needs. The full month lives on the Birthdays
  // screen; here the question is only "is anyone celebrating right now".
  const { data } = useGetUpcomingBirthdaysQuery({ days: 1 });

  const today = useMemo(() => (data ?? []).filter((b) => b.is_today), [data]);

  // Matched on the employee CODE: the session user's `_id` is a USER id while
  // this list carries EMPLOYEE ids.
  const isMine = useMemo(
    () => Boolean(me?.employee_id && today.some((b) => b.employee_id === me.employee_id)),
    [today, me],
  );

  const others = useMemo(
    () => today.filter((b) => b.employee_id !== me?.employee_id),
    [today, me],
  );

  /* ── Your own day ───────────────────────────────────────────────────── */

  if (scope === 'mine') {
    if (!isMine) return null;
    const first = me?.first_name?.trim() || 'there';

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="It is your birthday. Open birthdays"
        style={({ pressed }) => ({
          marginHorizontal: space.screen,
          marginBottom: space.lg,
          borderRadius: radius.card,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          ...shadow.card,
        })}
      >
        <LinearGradient
          colors={[brand[500], brand[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.card, padding: space.lg }}
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <PartyPopper size={22} strokeWidth={2.2} color="#FFFFFF" />
            </View>

            <View className="flex-1">
              <Text className={`text-white ${T.cardTitle}`} numberOfLines={1}>
                Happy birthday, {first}! 🎉
              </Text>
              <Text
                style={{ color: 'rgba(255,255,255,0.85)' }}
                className={`mt-0.5 ${T.micro}`}
                numberOfLines={1}
              >
                The whole team is wishing you today
              </Text>
            </View>

            <ChevronRight size={18} strokeWidth={2.4} color="rgba(255,255,255,0.9)" />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  /* ── Someone else's ─────────────────────────────────────────────────── */

  if (others.length === 0) return null;

  const faces = others.slice(0, FACES);
  const extra = others.length - faces.length;
  const lead = others[0].name?.split(' ')[0] ?? 'A teammate';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${others.length} ${
        others.length === 1 ? 'birthday' : 'birthdays'
      } today. Open birthdays`}
      style={({ pressed }) => ({
        marginHorizontal: space.screen,
        // The spacing lives here, not on a wrapper in the screen — a wrapper
        // with a margin still reserves that margin on the days this renders
        // nothing, which left a mystery gap under the attendance card.
        marginTop: space.lg,
        backgroundColor: dark ? c.card : surface.warning.bg,
        borderRadius: radius.card - 4,
        borderWidth: 1,
        borderColor: dark ? c.border : surface.warning.border,
        padding: space.lg,
        opacity: pressed ? 0.9 : 1,
        ...(dark ? shadow.none : shadow.soft),
      })}
      className="flex-row items-center gap-3"
    >
      {/* Overlapping faces, not a count: a birthday is about WHO, and three
          avatars say it faster than any label can. */}
      <View className="flex-row">
        {faces.map((p, i) => (
          <View
            key={p._id}
            style={{
              marginLeft: i === 0 ? 0 : -12,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: dark ? c.card : surface.warning.bg,
            }}
          >
            <Avatar user={personUser(p)} size={36} />
          </View>
        ))}
        {extra > 0 ? (
          <View
            style={{
              marginLeft: -12,
              width: 36,
              height: 36,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: dark ? c.card : surface.warning.bg,
              backgroundColor: surface.warning.tint,
            }}
            className="items-center justify-center"
          >
            <Text className={`text-white ${T.count}`} allowFontScaling={false}>
              +{extra}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        <Text style={{ color: c.text }} className={T.cardTitleSm} numberOfLines={1}>
          {others.length === 1
            ? `${lead}'s birthday today`
            : `${others.length} birthdays today`}
        </Text>
        <Text style={{ color: c.textMuted }} className={`mt-0.5 ${T.micro}`} numberOfLines={1}>
          Tap to send your wishes
        </Text>
      </View>

      <Cake size={18} strokeWidth={2.2} color={surface.warning.tint} />
    </Pressable>
  );
}
