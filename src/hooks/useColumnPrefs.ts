import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PinSide = 'left' | 'right';

/**
 * Persisted per-table column preferences (hidden + pinned side).
 *
 * Native port note: AsyncStorage is async, so the initial state can't be read
 * synchronously the way localStorage allowed. We start from `defaults` and swap
 * in the stored value once it loads — `loaded` tells callers whether what they
 * are looking at is the real preference yet, so a table doesn't persist its
 * default layout over a saved one on first paint.
 */
export interface ColumnPref {
  hidden: string[];
  pins: Record<string, PinSide>;
}

export function useColumnPrefs(
  storageKey: string,
  defaults: { hidden?: string[]; pins?: Record<string, PinSide> },
) {
  const defaultsRef = useRef<ColumnPref>({
    hidden: defaults.hidden || [],
    pins: defaults.pins || {},
  });

  const [pref, setPref] = useState<ColumnPref>(() => ({ ...defaultsRef.current }));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!cancelled && raw) {
          const p = JSON.parse(raw);
          if (Array.isArray(p?.hidden) && p?.pins && typeof p.pins === 'object') {
            setPref(p);
          }
        }
      } catch {
        /* ignore corrupt storage */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    // Don't write before the stored value has been read back, or the defaults
    // would clobber the user's saved layout on every mount.
    if (!loaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(pref)).catch(() => {
      /* ignore quota errors */
    });
  }, [storageKey, pref, loaded]);

  const isHidden = useCallback((k: string) => pref.hidden.includes(k), [pref.hidden]);
  const pinOf = useCallback(
    (k: string): PinSide | undefined => pref.pins[k],
    [pref.pins],
  );
  const isPinned = useCallback((k: string) => !!pref.pins[k], [pref.pins]);

  const toggleHide = useCallback(
    (k: string) =>
      setPref((p) => ({
        ...p,
        hidden: p.hidden.includes(k)
          ? p.hidden.filter((x) => x !== k)
          : [...p.hidden, k],
      })),
    [],
  );

  // side=null → unpin; otherwise pin to that edge.
  const setPin = useCallback((k: string, side: PinSide | null) => {
    setPref((p) => {
      const pins = { ...p.pins };
      if (side) pins[k] = side;
      else delete pins[k];
      return { ...p, pins };
    });
  }, []);

  const reset = useCallback(() => setPref({ ...defaultsRef.current }), []);

  return { pref, loaded, isHidden, isPinned, pinOf, toggleHide, setPin, reset };
}
