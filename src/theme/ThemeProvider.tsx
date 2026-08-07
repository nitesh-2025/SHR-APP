import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkScheme, lightScheme, toneFor, type Scheme, type Surface } from './colors';
import {
  DEFAULT_THEME,
  THEMES,
  surfaceOf,
  type Ramp,
  type ThemeName,
} from './themes';

const THEME_KEY = 'hrms:theme';
const MODE_KEY = 'hrms:theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  name: ThemeName;
  /** Primary ramp — `brand[600]` is the accent, `brand[50]` its tint. */
  brand: Ramp;
  /**
   * Tinted-surface recipe built from that ramp, AS AUTHORED — the 50/200/600/700
   * steps. Correct on a white canvas only. Reach for `tint` unless you are
   * painting on something you know is light.
   */
  primary: Surface;
  /**
   * The same recipe, already corrected for the active scheme.
   *
   * `primary.bg` is the ramp's 50 step: over `#0F172A` it is a near-white slab
   * that glows, which is how a pale-green disc ended up behind every active tab
   * icon in dark mode. This is `toneFor(primary, dark)` computed once here, so a
   * caller cannot forget to apply it — the mistake was repeated in 20 places
   * before this existed.
   */
  tint: Surface;
  /** Scheme-aware surfaces: `c.bg`, `c.card`, `c.text`, `c.border`, … */
  c: Scheme;
  dark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const fallbackRamp = THEMES[DEFAULT_THEME].ramp;

const ThemeContext = createContext<ThemeValue>({
  name: DEFAULT_THEME,
  brand: fallbackRamp,
  primary: surfaceOf(fallbackRamp),
  tint: surfaceOf(fallbackRamp),
  c: lightScheme,
  dark: false,
  mode: 'system',
  setMode: () => {},
});

/**
 * Accent + light/dark theming.
 *
 * NativeWind compiles `bg-*` classes at BUILD time, so neither a runtime accent
 * nor a runtime scheme can come from a Tailwind class — anything that re-tints
 * reads from this context and applies an inline style. Tailwind is still used
 * for layout, spacing and type, which never change.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [name] = useState<ThemeName>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let alive = true;
    // Only the light/dark choice is restored. The accent is no longer
    // user-selectable (the swatch row was removed), so a value left in storage
    // from the old picker must NOT keep overriding the app's default — that is
    // what pinned installs to blue after the default moved to green.
    AsyncStorage.removeItem(THEME_KEY).catch(() => {});
    AsyncStorage.getItem(MODE_KEY)
      .then((savedMode) => {
        if (!alive) return;
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode);
        }
      })
      .catch(() => {
        /* storage unavailable — stay on the defaults */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Fire-and-forget writes: the UI already switched, and a failed write only
  // means the choice doesn't survive a restart.
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const ramp = THEMES[name].ramp;
    const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
    const primary = surfaceOf(ramp);
    return {
      name,
      brand: ramp,
      primary,
      tint: toneFor(primary, dark),
      c: dark ? darkScheme : lightScheme,
      dark,
      mode,
      setMode,
    };
  }, [name, mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
