/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // NativeWind maps `dark:` to the OS colour scheme by default. StaffCore used
  // `darkMode: "class"` with a manual toggle; the equivalent here is
  // `colorScheme` from nativewind, so the utility names stay identical.
  theme: {
    extend: {
      // ── Palette ───────────────────────────────────────────────────────────
      // Three accents, one neutral ramp. Mirrored in `src/theme/colors.ts` for
      // the props that need a raw string (SVG, Lucide, gradients) — NativeWind
      // reads this file at build time and cannot import TS, so both must move
      // together. Scale names are unchanged from the old green palette on
      // purpose: every existing `bg-brand-*` class re-themes for free.
      colors: {
        // Primary — teal. Identity, CTAs, anything "working / good".
        brand: {
          50: '#EFF7F5',
          100: '#DFEFEB',
          200: '#BFE0D7',
          300: '#94CBBB',
          400: '#64B39D',
          500: '#389E81', // base
          600: '#318B72', // primary CTA
          700: '#29755F',
          800: '#205C4B',
          900: '#184236',
        },
        // Secondary — orange. Attention, paused states, warm actions.
        accent: {
          50: '#FDF4EF',
          100: '#FAE7DC',
          200: '#F6D0B9',
          300: '#EFAD86',
          400: '#E7884E',
          500: '#E06216', // base
          600: '#CA5814',
          700: '#AA4A11',
          800: '#863B0D',
          900: '#652C0A',
        },
        // Tertiary — violet. Completed / archived / the categorical third.
        plum: {
          50: '#F5F0F8',
          100: '#EBE0F1',
          200: '#D8C2E4',
          300: '#B992CE',
          400: '#975DB6',
          500: '#73249D', // base
          600: '#65208A',
          700: '#551B74',
          800: '#43155B',
          900: '#300F42',
        },
        // App canvas (light mode). Dark mode surfaces come from `theme/colors`
        // at runtime — a Tailwind class cannot switch scheme.
        canvas: '#F8FAFC',
      },
      // Web keyframes/animations are intentionally NOT ported — RN has no CSS
      // animation engine. Motion belongs in Reanimated/Animated instead.
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
