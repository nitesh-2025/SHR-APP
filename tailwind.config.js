/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // NativeWind maps `dark:` to the OS colour scheme by default. StaffCore used
  // `darkMode: "class"` with a manual toggle; the equivalent here is
  // `colorScheme` from nativewind, so the utility names stay identical.
  theme: {
    extend: {
      colors: {
        // Brand — the logo's green. Scale names are unchanged from the earlier
        // palettes on purpose, so every existing `bg-brand-*` / `text-brand-*`
        // class re-themes without touching a single call site.
        brand: {
          50: '#f1f9f0',
          100: '#ddf0da',
          200: '#bce2b7',
          300: '#8ecd87',
          400: '#5dcb57', // off-green highlight
          500: '#39a935', // logo green
          600: '#2f8f2c', // primary CTA
          700: '#1f6b1f', // deep green
          800: '#175019',
          900: '#0f3512',
        },
        // Accent — the logo's navy. One cool counterweight to the greens; used
        // sparingly so the palette stays green-and-white, not multi-colour.
        accent: {
          50: '#eef1f6',
          100: '#d3dae7',
          200: '#a7b5cc',
          300: '#7288a9',
          400: '#455f89',
          500: '#22314a', // logo navy
          600: '#1b273b',
          700: '#131c2a',
        },
        // App canvas — off-white with a green cast. Pure white next to the
        // brand greens looks cold; this keeps the surface soft.
        canvas: '#f2f6f0',
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
