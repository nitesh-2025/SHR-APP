# SHR-APP

Employee app for SHR — attendance, leave, team directory, birthdays, referrals
and company chat. React Native (Expo SDK 57) against the StaffCore backend.

## Run it

```bash
npm install
cp .env.example .env        # fill in EXPO_PUBLIC_BASE_URL
npx expo run:android        # dev build — Expo Go cannot load the native modules
```

`npx expo start` alone is enough once a dev build is installed. After editing
`.env`, restart Metro with `npx expo start -c` — Expo inlines `EXPO_PUBLIC_*`
at bundle time, so a running server keeps serving the old values.

## Build an APK without Android Studio

Push to `main` and GitHub Actions builds a release APK
(`.github/workflows/android.yml`); download it from the run's **Artifacts**
section. It is signed with the debug keystore — installable on any device, but
the Play Store needs a real one.

## Layout

```
src/
├── components/   shared UI (BottomNav, BottomSheet, cards, sheets)
├── screens/      one file per screen
├── hooks/        useRealtime (the one socket), usePresence, useKeyboardHeight
├── store/        RTK Query APIs + slices
├── theme/        colours, type scale, ThemeProvider
└── navigation/   RootNavigator
```

`DESIGN.md` is the design system — read it before adding UI.
