/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // NativeWind maps `dark:` to the OS colour scheme by default. StaffCore used
  // `darkMode: "class"` with a manual toggle; the equivalent here is
  // `colorScheme` from nativewind, so the utility names stay identical.
  theme: {
    extend: {
      // ── No colour palette here. On purpose. ───────────────────────────────
      //
      // This file used to define a SECOND brand system — `brand-*` teal,
      // `accent-*` orange, `plum-*` violet, `canvas` — alongside the runtime
      // ramps in `src/theme/`. Two palettes in one app is how an interface
      // starts looking assembled rather than designed, and it had already
      // leaked: the login error banner was painted orange while every other
      // failure in the app was red.
      //
      // Colour cannot live here anyway. NativeWind compiles these classes at
      // BUILD time, so a Tailwind colour can never follow the light/dark
      // scheme or a runtime accent — the two things this app's colour system
      // is built on. `bg-brand-600` was a value frozen at compile time
      // pretending to be a token.
      //
      // So colour has exactly one home: `src/theme/colors.ts` (neutral ramp,
      // semantic surfaces, scheme) and `src/theme/themes.ts` (the primary
      // ramp), both read through `useTheme()` and applied as inline styles.
      // Tailwind keeps what genuinely never changes: layout, spacing, type.
      //
      // Tailwind's own defaults (`text-white`, `bg-black/40`, `text-slate-500`)
      // still resolve — nothing was removed from the base theme, only the
      // duplicate brand system that was extending it.
      //
      // Web keyframes/animations are likewise NOT ported — RN has no CSS
      // animation engine. Motion belongs in Reanimated.
      fontFamily: {
        // Named by ROLE, not weight. In React Native a weight comes from the
        // font FILE, so `font-bold` (which only emits font-weight) does nothing
        // for a custom family — and naming a family "bold" would collide with
        // Tailwind's own font-weight utility of the same name.
        display: ['Outfit_700Bold'],
        ui: ['Outfit_500Medium'],
        'ui-semibold': ['Outfit_600SemiBold'],
        'ui-regular': ['Outfit_400Regular'],
      },
    },
  },
  plugins: [],
};
