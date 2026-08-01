# SHR — Design Specification (Figma Handoff)

**App:** SHR (`app.json` → `expo.name: "SHR"`, slug `shr`, package `com.anonymous.brokerapp`)
**Type:** Employee-facing HR mobile app (attendance, leave, notifications)
**Stack:** Expo SDK 57 · React Native 0.86 · NativeWind 4 (Tailwind 3) · Reanimated 4 · Lucide icons
**Orientation:** Portrait only · **Themes:** Light + Dark (`userInterfaceStyle: automatic`)

This document is the single source of truth for rebuilding the app in Figma. Every
number here is read directly from the code — nothing is approximated.

---

## 0. Figma file setup

### Pages

| Page | Contents |
|------|----------|
| `00 · Cover` | App name, version, owner, last updated |
| `01 · Foundations` | Color styles/variables, type styles, effects, grid, icon set |
| `02 · Components` | All library components + variants + states |
| `03 · Screens — Light` | Every screen, light mode |
| `04 · Screens — Dark` | Every screen, dark mode |
| `05 · Flows` | Prototype wiring (login → dashboard → attendance/leave) |
| `06 · Motion` | Animation specs + reference GIFs |

### Frames

| Device | Size | Use |
|--------|------|-----|
| iPhone 14/15 Pro | **393 × 852** | Primary design frame |
| Android reference | **360 × 800** | Density check (narrowest supported) |
| Large | **430 × 932** | Overflow check |

**Safe areas (design against these):**
- Top inset: **59 px** (iOS notch) / **24 px** (Android status bar)
- Bottom inset: **34 px** (iOS home indicator) / **0–24 px** (Android nav)
- Code always adds `insets.top` / `insets.bottom` on top of its own padding.

### Layout grid
- Screen side padding: **20 px** (`space.screen`) — applies to almost every screen.
- Column grid: **4 columns**, 20 px margins, 12 px gutter (used by the Quick Actions grid).
- Baseline: **8 px** spacing system (see §3).

---

## 1. Design principles (from the code comments — keep these)

1. **One primary accent carries the whole app.** Status meaning comes from the
   semantic set (success / warning / danger / info / purple), never from a second
   decorative brand hue.
2. **Depth comes from soft elevation, never heavy borders.** A 1px hairline is
   used only where two surfaces of the same color meet.
3. **In dark mode the shadow is dropped and the hairline nearly disappears** —
   elevation is implied by surface lightness instead.
4. **Never a blank screen.** Every empty list has an EmptyState with a glyph, one
   line of what happened, one line of what to do, and the action itself.
5. **Loading = skeleton, not spinner.** A skeleton shows the SHAPE of what is
   coming, so the layout does not jump when data lands.
6. **Actions are named, never hidden.** Mid-shift a user must never guess where
   Break and Clock Out live. Hierarchy comes from fill vs outline, not from hiding.
7. **One motion language.** Every overlay rises from the bottom (BottomSheet).
   Nothing slides in from the side.
8. **Minimum touch target 44 × 44.** Small controls get `hitSlop` — in Figma,
   draw an invisible 44px hit box around anything smaller.

---

## 2. Color

> ⚠️ **Important — two palettes exist in the codebase today.**
> - **Runtime palette** (`src/theme/themes.ts` + `src/theme/colors.ts`) drives everything
>   read through `useTheme()` → `brand[…]`, `c.*`, `surface.*`. **Default = Green.**
> - **Tailwind palette** (`tailwind.config.js`) defines `brand-*` (teal), `accent-*`
>   (orange), `plum-*` (violet) for build-time NativeWind classes. Only a few places
>   use it — notably the Login error banner (`bg-accent-50 / border-accent-200 / text-accent-700`).
>
> **Design decision needed:** unify on one. Recommended → keep the runtime Green
> ramp as brand and re-map the Tailwind `accent-*` usage to `warning`. Both are
> documented below so nothing is lost.

### 2.1 Primary / brand ramp — **Green (active default)**

`DEFAULT_THEME = 'green'`. `brand[600]` is the CTA color, `brand[50]` its tint.

| Token | Hex | Used for |
|-------|-----|----------|
| `brand/50` | `#F0FDF4` | Lightest tint (rare) |
| `brand/100` | `#DCFCE7` | Notification unread icon well |
| `brand/200` | `#BBF7D0` | Tinted borders, splash spinner |
| `brand/300` | `#86EFAC` | Login wave layer 2 |
| `brand/400` | `#4ADE80` | Login wave / bubble |
| `brand/500` | `#22C55E` | Focus ring on inputs |
| **`brand/600`** | **`#16A34A`** | **Primary CTA, active tab, links, icons** |
| `brand/700` | `#15803D` | Pressed / gradient end, secondary button text |
| `brand/800` | `#166534` | Attendance card gradient end |
| `brand/900` | `#14532D` | — |

**Alternate ramps** (defined, currently not user-selectable — flip `DEFAULT_THEME` to re-skin):

| Name | 500 | 600 | 700 |
|------|-----|-----|-----|
| Blue | `#3B7BF6` | `#2563EB` | `#1D4FD8` |
| Purple | `#A855F7` | `#9333EA` | `#7E22CE` |
| Amber | `#F59E0B` | `#D97706` | `#B45309` |
| Red | `#EF4444` | `#DC2626` | `#B91C1C` |

### 2.2 Neutral ramp (Slate — the only grey family)

| Token | Hex |
|-------|-----|
| `neutral/50` | `#F8FAFC` |
| `neutral/100` | `#F1F5F9` |
| `neutral/200` | `#E2E8F0` |
| `neutral/300` | `#CBD5E1` |
| `neutral/400` | `#94A3B8` |
| `neutral/500` | `#64748B` |
| `neutral/600` | `#475569` |
| `neutral/700` | `#334155` |
| `neutral/800` | `#1E293B` |
| `neutral/900` | `#0F172A` |

### 2.3 Semantic ramps (meaning only — never decoration)

| Family | 50 | 100 | 200 | 500 | 600 | 700 |
|--------|----|-----|-----|-----|-----|-----|
| **success** | `#ECFDF5` | `#D1FAE5` | `#A7F3D0` | `#10B981` | `#059669` | `#047857` |
| **warning** | `#FFFBEB` | `#FEF3C7` | `#FDE68A` | `#F59E0B` | `#D97706` | `#B45309` |
| **danger** | `#FEF2F2` | `#FEE2E2` | `#FECACA` | `#EF4444` | `#DC2626` | `#B91C1C` |
| **info** | `#EFF6FF` | `#DBEAFE` | `#BFDBFE` | `#3B82F6` | `#2563EB` | `#1D4ED8` |
| **purple** | `#FAF5FF` | `#F3E8FF` | `#E9D5FF` | `#A855F7` | `#9333EA` | `#7E22CE` |

### 2.4 Surface recipe (the pattern that makes badges/wells/chips a family)

Every tinted element is built from a 4-part recipe: `bg` + `border` + `tint` (icon/dot) + `text`.
**In Figma make each of these a component variant, not a one-off fill.**

| Surface | bg | border | tint | text |
|---------|----|--------|------|------|
| `success` | `#ECFDF5` | `#A7F3D0` | `#10B981` | `#047857` |
| `warning` | `#FFFBEB` | `#FDE68A` | `#F59E0B` | `#B45309` |
| `danger` | `#FEF2F2` | `#FECACA` | `#EF4444` | `#B91C1C` |
| `purple` | `#FAF5FF` | `#E9D5FF` | `#A855F7` | `#7E22CE` |
| `info` | `#EFF6FF` | `#BFDBFE` | `#3B82F6` | `#1D4ED8` |
| `neutral` | `#F1F5F9` | `#E2E8F0` | `#94A3B8` | `#64748B` |
| `muted` (disabled/"soon") | `#F8FAFC` | `#E2E8F0` | `#CBD5E1` | `#94A3B8` |
| `primary` (from brand ramp) | `#F0FDF4` | `#BBF7D0` | `#16A34A` | `#15803D` |

### 2.5 Scheme surfaces — build these as Figma **variable modes** (Light / Dark)

| Variable | Light | Dark | Meaning |
|----------|-------|------|---------|
| `bg` | **`#F5F5F5`** (white smoke) | `#0F172A` | App canvas |
| `card` | `#FFFFFF` | `#1E293B` | Raised surface (cards, sheets, bars) |
| `fill` | `#F1F5F9` | `#243044` | Recessed fill — inputs, tracks, skeletons |
| `border` | `#E2E8F0` | `rgba(255,255,255,0.06)` | Hairline |
| `text` | `#0F172A` | `#FFFFFF` | Primary text |
| `textMuted` | `#64748B` | `#94A3B8` | Secondary text |
| `textFaint` | `#94A3B8` | `#64748B` | Tertiary / disabled |
| `scrim` | `rgba(15,23,42,0.45)` | `rgba(2,6,23,0.62)` | Modal backdrop |

### 2.6 Tailwind-only palette (build-time classes — document, then migrate)

| Family | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|--------|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| `brand` (teal) | `#EFF7F5` | `#DFEFEB` | `#BFE0D7` | `#94CBBB` | `#64B39D` | `#389E81` | `#318B72` | `#29755F` | `#205C4B` | `#184236` |
| `accent` (orange) | `#FDF4EF` | `#FAE7DC` | `#F6D0B9` | `#EFAD86` | `#E7884E` | `#E06216` | `#CA5814` | `#AA4A11` | `#863B0D` | `#652C0A` |
| `plum` (violet) | `#F5F0F8` | `#EBE0F1` | `#D8C2E4` | `#B992CE` | `#975DB6` | `#73249D` | `#65208A` | `#551B74` | `#43155B` | `#300F42` |
| `canvas` | `#F8FAFC` | | | | | | | | | |

---

## 3. Spacing, radii, elevation

### 3.1 Spacing scale (8px system — use only these)

| Token | px | Typical use |
|-------|----|-------------|
| `xs` | 4 | Icon gaps |
| `sm` | 8 | Chip gaps, tight stacks |
| `md` | 12 | Card gaps, list gaps |
| `lg` | 16 | Card inner padding base |
| `xl` | 20 | Section spacing |
| `xxl` | 24 | Major section spacing |
| `xxxl` | 32 | — |
| `screen` | **20** | **Screen side padding (constant)** |

Card padding in practice: `space.lg + 2` = **18 px**.

### 3.2 Corner radii

| Token | px | Applied to |
|-------|----|-----------|
| `card` | **24** | Cards, gradient hero, balance tiles, timeline cards |
| `card − 4` | **20** | Quick-action cards |
| `button` | **18** | Buttons, back button, logout row |
| `input` | **18** | Text inputs, type selector |
| `well + 2` | **18** | KPI tiles (Today's Overview) |
| `well` | **16** | Icon wells, inner wells, header icon buttons |
| `well − 4` | **12** | Icon well inside a quick-action card |
| `pill` | **999** | Badges, chips, progress bars, FAB, grab handle |
| Bottom sheet top corners | **28** | `borderTopLeftRadius` / `borderTopRightRadius` |
| Login field | **16** (`rounded-2xl`) | Email / password / submit |
| Header icon button (bell/menu) | **14** | 44×44 square |
| Notification icon well | **12** (`rounded-xl`) | 36×36 |

### 3.3 Elevation (Figma effect styles — **light mode only**, dark = none)

| Style | Color | Opacity | Blur | Y | Android elevation |
|-------|-------|---------|------|---|-------------------|
| `shadow/soft` | `#0F172A` | **5 %** | **14** | **+4** | 1 |
| `shadow/card` | `#0F172A` | **8 %** | **24** | **+8** | 3 |
| `shadow/floating` | `#0F172A` | **14 %** | **36** | **+12** | 12 |
| `shadow/sheet` | `#0F172A` | **18 %** | **32** | **−8** | 20 |
| `shadow/none` | — | — | — | — | — |

> Rule: in Dark mode every card shadow is removed and a 1px `border` hairline is
> added instead (`borderWidth: dark ? 1 : 0` on tiles / inputs).
>
> Use **`shadow/soft`** for cards that appear in a group — the shortcut rail, the
> week chart. Four `shadow/card` blocks side by side stack into visible grey haze
> under the whole row.

---

## 4. Typography

**Family: Outfit** (`@expo-google-fonts/outfit`). React Native picks weight from the
font FILE, so families are named by ROLE, not weight.

| Class | Font file | Weight | Figma text style name |
|-------|-----------|--------|-----------------------|
| `font-display` | `Outfit_700Bold` | 700 | `Display` |
| `font-ui-semibold` | `Outfit_600SemiBold` | 600 | `UI / Semibold` |
| `font-ui` | `Outfit_500Medium` | 500 | `UI / Medium` |
| `font-ui-regular` | `Outfit_400Regular` | 400 | `UI / Regular` |

### 4.0 The canonical scale — `src/theme/type.ts`

**One system, one file.** Every text node pulls a class string from the `T` object;
nothing hand-writes a size. Hierarchy comes from **size and whitespace**, not from
reaching for Bold everywhere.

| Token | Class | Size / LH | Weight | Use |
|-------|-------|-----------|--------|-----|
| `T.appTitle` | `font-display` | 30 / 36 | Bold 700 | Wordmark, app-level title |
| `T.screenTitle` | `font-display` | **28 / 34** | Bold 700 | The one big heading per screen — "Nitesh 👋", "My Attendance", "My Leave", "Profile" |
| `T.section` | `font-ui-semibold` | 18 | SemiBold 600 | "Quick Actions", "Today's Overview" |
| `T.cardTitle` | `font-ui-semibold` | 16 | SemiBold 600 | Card / list-row titles |
| `T.cardTitleSm` | `font-ui-semibold` | 14 | SemiBold 600 | Title in a dense card |
| `T.kpiHero` | `font-display` | **38 / 46** | Bold 700 | The stopwatch |
| `T.kpi` | `font-display` | 26 / 32 | Bold 700 | Standard KPI figure |
| `T.kpiSm` | `font-display` | 20 / 28 | Bold 700 | KPI in a compact tile |
| `T.button` | `font-ui-semibold` | 15 | SemiBold 600 | Button labels |
| `T.buttonSm` | `font-ui-semibold` | 13.5 | SemiBold 600 | Card-sized button |
| `T.body` | `font-ui` | 14 | Medium 500 | Normal reading text |
| `T.secondary` | `font-ui-regular` | 13 | Regular 400 | Supporting text — muted |
| `T.caption` | `font-ui-regular` | 12 | Regular 400 | Timestamps, hints — faint |
| `T.micro` | `font-ui-regular` | 11 | Regular 400 | Legends. Sparingly |
| `T.nano` | `font-ui-regular` | 10 | Regular 400 | **Below scale.** Only the hint line in a 4-across shortcut card |
| `T.label` | `font-ui-semibold` | 13 | SemiBold 600 | Field labels above inputs |
| `T.badge` | `font-ui-semibold` | 12 | SemiBold 600 | Status chips |
| `T.navActive` | `font-ui` | 13 | Medium 500 | Active tab label |
| `T.navInactive` | `font-ui-regular` | 12 | Regular 400 | Inactive tab label |

**Rules**
- Only Outfit, only 400 / 500 / 600 / 700. No other family, no other weight.
- Default letter spacing everywhere. The single exception is the hero card's
  `TODAY'S STATUS` eyebrow at **+0.6**, because it is set in caps.
- Left-align everything. Centre only hero numbers, empty states and splash text.
  Never justify.
- **Never bold a navigation label.** Active state is colour + the pill behind the
  icon, never weight.

**Text colours**

| Role | Light | Dark |
|------|-------|------|
| Primary | `#0F172A` | `#FFFFFF` |
| Secondary | `#64748B` | `#94A3B8` |
| Caption | `#94A3B8` | `#64748B` |

> **Deviation to review:** the spec asked for nav labels at 15 (active) / 13
> (inactive). At 15 px, "Attendance" is ~78 px wide and a five-tab bar on a 393 px
> screen gives each tab ~78 px — every label truncates. Shipped at **13 / 12**,
> Medium weight, which honours "never bold" and still fits. Say the word and I'll
> push it to 15/13 with a four-tab bar instead.

### 4.1 Legacy per-screen sizes (being migrated to §4.0)

| Role | Size | Line height | Weight | Color | Where |
|------|------|-------------|--------|-------|-------|
| Screen title (home) | **28** | 36 | Display 700 | `text` | "Good Morning 👋" |
| Login heading | **26** | 32 | Display 700 | `#0F172A` | "Welcome back" |
| Balance tile value | **26** | 32 | Display 700 | `text` / white | "12 / 18" |
| Pushed screen title | **22** | 28 | Display 700 | `text` | "My Attendance", "My Leave" |
| Attendance clock-in time | **22** | 28 | Display 700 | white | "09:32 AM" |
| Stat card value | **22** | 28 | Display 700 | `text` | "18" |
| Ring percentage | **19** | auto | Display 700 | white | "62%" |
| Section header | **18** | auto | UI Semibold | `text` | "Quick Actions" |
| Sheet title | **17** | auto | Display / UI Semibold | `text` | "Notifications", "Show days" |
| Card title / list title | **16** | auto | UI Semibold | `text` | Leave type, account name |
| Attendance card header | **15** | auto | UI Semibold | white | "Today's Attendance" |
| Body / input text | **15** | auto | UI Medium | `text` | Inputs, drawer rows |
| Button label | **15** | auto | UI Semibold | per variant | Primary buttons |
| Detail value | **15** | auto | UI Semibold | `text` | Clock in / out times |
| FAB label | **14.5** | auto | UI Semibold | white | "Leave" |
| Body secondary | **14** | auto | UI Regular | `textMuted` | Greeting subtitle |
| Card button label | **13.5** | auto | UI Semibold | white/brand700 | "Clock In" |
| Field label | **13** | auto | UI Semibold | `textMuted` | "Leave type", "Email" |
| Meta / caption | **12.5** | auto | UI Regular / Semibold | `textMuted` | Chips, dates, subtitles |
| Small caption | **12** | auto | UI Medium | `textFaint` | Date line, badge label |
| Micro | **11–11.5** | 16 | UI Regular | `textFaint` | Hints, legend, tab labels |
| Nano | **10–10.5** | auto | UI Semibold | white/faint | Status pill, weekday header |

`allowFontScaling={false}` is set on: ring %, badge counts, tab labels, checkmarks.
In Figma these stay fixed size regardless of accessibility scaling.

---

## 5. Iconography

- **Library:** [Lucide](https://lucide.dev) (`lucide-react-native`) — import the
  Lucide Figma plugin, do not redraw.
- **Default stroke width:** `2`. Emphasis: `2.2`. Heavy (checkmarks): `2.4–3`.
  Illustrative/empty-state: `1.6–1.8`.

| Context | Size |
|---------|------|
| Empty state glyph | 32 |
| Back chevron (screen header) | 24 |
| Bottom nav icon | 22 |
| Header bell / menu | 20–21 |
| Section "view all" chevron | 15 |
| Drawer row icon | 19 |
| Stat card icon | 19 |
| Quick action tile icon | 18 |
| Notification row icon | 17 |
| Card button icon | 17 |
| Badge / detail label icon | 11–13 |

**Icons in use:** Home, CalendarDays, ClipboardList, LifeBuoy, Menu, MoreHorizontal,
Users, Boxes, Receipt, Bell, BellOff, MessageSquare, Timer, TimerReset, CalendarCheck,
Clock3, LogIn, LogOut, Coffee, Play, MapPin, Smartphone, ListFilter, ChevronLeft,
ChevronRight, Plus, X, Check, Send, AlertCircle, Sun, Moon, SunMoon, Gift, FileText,
Building2, BadgeCheck, List.

---

## 6. Component library

Build each of these as a Figma component with the variants listed.

### 6.1 Card
Base container. **The only container in the app.**

| Prop | Value |
|------|-------|
| Fill | `card` |
| Radius | 20 |
| Border | 1px `border` |
| Padding | 18 (`padded=true`) or 0 (`padded=false`) |
| Effect | `shadow/card` (light) · none (dark) |

**Variants:** `padded` = true/false · `mode` = light/dark

---

### 6.2 Button

Height **52**, radius **16**, horizontal padding **20**, icon + label gap **10**,
centered row, label = UI Semibold 15, icon 20.

| Variant | Fill | Label color | Border |
|---------|------|-------------|--------|
| **primary** | `brand/600` `#16A34A` | `#FFFFFF` | none |
| **secondary** | light: `brand/50` · dark: `rgba(255,255,255,0.06)` | light: `brand/700` · dark: `#FFFFFF` | none |
| **ghost** | transparent | `textMuted` | 1px `border` |
| **danger** | light: `#FEF2F2` · dark: `rgba(239,68,68,0.14)` | `#EF4444` | none |

**States:** default · pressed (opacity **0.85**) · disabled/loading (opacity **0.55**)
· loading (spinner replaces the icon, label may read "Submitting…").
**Width:** `full` = stretch, or hug content.

---

### 6.3 Badge (status pill)

Radius pill · padding **10 h / 4 v** · gap **6** · dot **6 × 6** circle in `tint`
(replaceable by an icon) · label UI Semibold **12** in `text` of the surface.
**Variants:** one per surface (success / warning / danger / purple / info / neutral / muted / primary).

---

### 6.4 IconWell

Square (radius **16**) or circle (`round`), fill = surface `bg`, icon color = surface `tint`.
Sizes in use: **38** (quick actions), **44** (default), **36** (notification, radius 12).

---

### 6.5 ProgressBar

Track = `fill` (or `rgba(255,255,255,0.28)` on filled cards) · bar = passed color ·
radius pill · heights: **8** default, **5** on balance tiles. Value clamped 0–1.

---

### 6.6 Skeleton

Fill = `fill` · default radius **10** (or 20 to match a card) · **pulse opacity 0.5 → 1.0**,
850 ms, ease-in-out quad, infinite alternate.
Standard skeleton sizes: attendance hero **h 230 / r 20**, balance tile **168 × 124 / r 20**,
stat card **h 116**, calendar **h 280**, leave row **h 110**.

---

### 6.7 SectionHeader

Row, side padding **20**, bottom margin **12**.
Left: title UI Semibold **18** in `text`.
Right (optional): action label UI Semibold **13** in `brand/600` + ChevronRight 15.
Pressed → opacity 0.6.

---

### 6.8 EmptyState

Centered, top padding **48**, horizontal padding **40**.
- Circle **80 × 80**, fill `primary.bg`, icon 32 stroke 1.6 in `brand/600`
- Title: UI Semibold **16**, `text`, margin-top 16
- Message: UI Regular **13** / line-height 20, `textMuted`, margin-top 6, centered
- Optional Button (hug width), margin-top 20

---

### 6.9 Avatar

Circle, fill `brand/600`. Sizes: **44** (drawer), **52** (account card).
Photo fills the circle; on missing/failed image → **initials**, white, bold,
font-size = `size × 0.36`. Optional `ring` = 2px `rgba(255,255,255,0.7)` border.

---

### 6.10 BottomSheet (the one overlay pattern)

| Property | Value |
|----------|-------|
| Panel fill | `card` |
| Top corners | **28** |
| Max height | **86 %** of screen (Notifications 78 %, Filter 45 %) |
| Bottom padding | safe-area bottom + 8 |
| Effect | `shadow/sheet` |
| Scrim | `scrim` token, fades in with the panel |
| Grab handle | **40 × 4**, radius pill, `border` color, centered, padding 10 top / 4 bottom |

**Motion:** open **300 ms** ease-out-cubic (translateY sheetHeight → 0);
close **210 ms** ease-in-quad. Drag-to-dismiss on the handle only; dismiss at
**28 %** of sheet height or flick velocity **> 950**; otherwise spring back
(damping 20, stiffness 240, mass 0.6). Scrim opacity is tied to panel offset.

---

### 6.11 BottomNav (floating tab bar)

Pinned to bottom, full width, fill `card`, top border 1px `border`, `shadow/floating`,
bar height **64** + safe-area bottom. **Screens must reserve 76 px of bottom clearance.**

**4 tabs + a centre punch button:**
**Home · Attendance — ( + ) — Leaves · Profile**
Icons: **House · CalendarCheck · Plus · TreePalm · UserRound**.

> Icons are chosen for what they MEAN, not for the module's name: a calendar with a
> **tick** is days you showed up, a **palm tree** is days you did not. Two plain
> calendars side by side would have been the same silhouette twice.

**Bar:** fill `card`, height **66** + safe-area bottom, **top corners 28**,
`shadow/floating`. **No top border in light mode** — the shadow already separates the
bar from the canvas, and a hairline under a 28 px curve reads as a seam. Dark mode
adds the 1px `border` back, since it has no shadow to do the job.

| Element | Spec |
|---------|------|
| Icon slot | **48 × 32**, centred |
| Icon | 22 · active stroke **2.2** with **`fill` = `primary.bg`** (the pale tint) · inactive stroke 1.8, `fill: none` |
| Active disc | Behind the glyph, fills the 48 × 32 slot, radius pill, fill `primary.bg` |
| Label | active `T.navActive` (11.5, Medium) · inactive `T.navInactive` (11.5, Regular) |
| Active colour | `brand/600` |
| Inactive colour | `neutral/400` (light) · `textMuted` (dark) |
| Centre slot | An empty **72 px** spacer in the row, so the four tabs stay evenly spaced instead of crowding under the button |

> **Fill with the pale tint, stroke with the accent.** Lucide ships no filled
> variants, and filling with the *stroke* colour flattens the tick out of the
> calendar and the door out of the house — a solid blob, not an icon.

**Punch button (FAB)**

| Property | Value |
|----------|-------|
| Size | **58 × 58**, radius 29, fill `brand/600`, Plus **26 stroke 2.6** white |
| Ring | **5px border in the BAR's colour (`card`)** — the circle reads as punched *through* the bar rather than stuck on top of it |
| Lift | **9 px** above the bar's top edge — see below |
| Effect | `shadow/card` |
| Press | Scale **0.92**, spring (damping 18, stiffness 320) |
| Action | Opens the **PunchSheet** (§6.18) — owned by the bar itself, so every screen gets punching for free |

> **The lift is deliberately small.** A FAB hoisted half its height above the bar
> floats away from it and starts looking like a dropped sticker. Sitting mostly
> *inside* the bar, just cresting the edge, is what reads as one object.

**Motion on tab change** — spring (damping **12**, stiffness **260**, mass **0.6**),
deliberately under-damped so the change is *felt*; a critically damped curve here
reads as a fade rather than a switch. Three things move together:

| Layer | From → To |
|-------|-----------|
| Icon lift | translateY **0 → −3** |
| Icon scale | **1 → 1.1** |
| Disc behind icon | opacity **0 → 1**, scale **0.6 → 1.0** |

---

### 6.12 ScreenHeader (pushed screens)

Padding: top = safe-area + 12, sides 20, bottom 16. Fill `bg`. Row, gap 12.
- Back button: **40 × 40**, radius 16, fill `card`, ChevronLeft 20 in `text`, pressed 0.6
- Title: Display **22 / 28**, `text`, 1 line
- Subtitle: UI Regular **12.5**, `textMuted`, 1 line
- Optional trailing slot

---

### 6.13 NotificationButton / MenuButton

**NotificationButton — 44 × 44 hit area, no fill, no border.** Just the glyph:
Bell **22 stroke 2** in `text` (`#FFFFFF` on the `onDark` variant).

> A boxed bell next to a round avatar read as two unrelated controls. Bare, the
> glyph sits on the canvas and the avatar is the only object in the corner.

**Unread badge:** top 4 / right 2, height **18**, min-width 18, radius pill,
fill `danger/500` `#EF4444`, **2px border in the CANVAS colour (`bg`)** — a white
ring on a white-smoke page is a visible halo — label UI Semibold **9** white, `99+` cap.

**MenuButton — 44 × 44**, radius **14**, 1px border `primary.border`, fill `card`.
Icon 21 stroke 2.2 `brand/600`. Not used on the dashboard; kept for screens that
need a drawer affordance of their own.

**Motion:** press-in scales to **0.93** over 130 ms, ease-out-quad.

---

### 6.14 ProfileButton (header avatar)

**44 × 44 circle** — deliberately not a rounded square like the bell beside it: an
avatar reads as a person, and a photo cropped into a squircle next to an icon button
reads as another icon.

| Element | Spec |
|---------|------|
| Container | 44 × 44, radius **22**, 1px border `primary.border`, fill `card` |
| Avatar inside | **36**, circular, photo or initials fallback |
| Duty dot *(when clocked in)* | **12 × 12** circle, bottom-right, fill `success/500` `#10B981`, **2px border in `bg`** so it stays legible over the backdrop glow |
| Press | Scale **0.93**, 130 ms ease-out-quad (matches NotificationButton) |

Pairs with NotificationButton in a row with **10 px** gap.

---

### 6.15 DateField (inline date picker — not a modal)

**Trigger:** label UI Semibold 12.5 `#475569`, margin-bottom 6.
Control **h 48**, radius 16, white fill, 1px border `neutral/200` → `brand/500` when open.
Inside: 28 × 28 rounded-lg well (fill `primary.bg`, 1px `primary.border`) with
CalendarDays 14 in `brand/600`, gap 8, value text UI Medium 13.5 `#0F172A`.

**Expanded grid** (renders in place, margin-top 8): white card, radius 16,
1px `neutral/100`, padding 12.
- Month nav row: two 28 × 28 circles (fill `primary.bg`, chevrons 15 `brand/600`),
  center label UI Semibold 13 `#0F172A`
- Weekday header: 7 columns, UI Semibold 10, `neutral/400`, centered
- Day cell: **14.28 % × 36**; inner **32 × 32** circle — selected = `brand/600` fill,
  white text; disabled = `neutral/300`; normal = `neutral/700`; text UI Medium 12.5

---

### 6.15 Segmented control

Two-or-three-way switch between views of the **same** data. Not tabs, not a filter:
a filter narrows a list, this swaps how the list is drawn.

| Element | Spec |
|---------|------|
| Track | Fill `fill`, **h 48**, radius **20**, padding **4**, **gap 6**, full width |
| Thumb | Absolute, **width = (track − 8 − 6×(n−1)) / n**, **h 40**, radius **16**, stride = width + 6. Light: fill `card` + `shadow/soft`. **Dark: fill `brand/600`** — a white chip on a dark track is a hole punched in the surface, not a raised control |
| Segment | flex 1, equal width, no background of its own |

> **The 6px gap matters.** Without it the thumb's edge lands flush against the next
> label and the two options read as one block that happens to be half-shaded. The gap
> is what makes them two choices.
| Active label | `T.cardTitleSm` (14 SemiBold) in `text` (light) / `#FFFFFF` (dark) |
| Inactive label | `T.body` (14 Medium) in `textMuted` |
| Count pill | Optional, after the label, gap 6. **h 20, min-width 20**, radius pill, padding-x 5. Active: fill `brand/600`, `T.count` (11) white. Inactive: fill `border`, `T.count` `textMuted`. Caps at `99+` |

> The count is a **circle**, not a rounded rectangle. `minWidth` lets a three-digit
> count stretch it into a pill, but the common single digit stays round — counting
> badges read as round, label chips read as pills, and this is a count.
| Press | opacity 0.75 |

**Motion:** the thumb **slides** to the tapped segment — `translateX`, **260 ms**,
ease-out-cubic. First layout lands with no animation; animating in from 0 on mount
reads as the control repositioning itself, which it is not.

> A raised chip inside a recessed track is the same physical metaphor as a real
> toggle — which is why nobody has to be taught how to read it. And the thumb
> *slides* rather than the background jumping: same pixels either way, but a slide
> says the two options are one control.

**In use:** Attendance → **Roster · Attendance**.

---

### 6.16 ConfirmSheet

`src/components/ConfirmSheet.tsx` — exports `ConfirmSheet`, plus `ConfirmStat` /
`ConfirmDivider` for the detail well. **In use:** Leave → Withdraw request.
PunchSheet's clock-out confirm is the same spec but stays inline: it is a *step*
inside a sheet that is already open, not a second overlay on top of one.

**One component for every "are you sure" in the app**, so a consequential tap always
asks the same way. Built on BottomSheet (`maxHeightRatio 0.6`), never `Alert.alert` —
the system dialog cannot carry the app's type, its accent or a busy state on the
confirm button, and it looks like a different product on each platform.

| Element | Spec |
|---------|------|
| Padding | 20 sides, top 12 |
| Icon well | **56 × 56**, radius pill, centred, fill = tone's surface `bg`, icon 26 stroke 2 in the tone's ink |
| Title | `T.cardTitle`, `text`, centred, margin-top 16 |
| Message | `T.secondary`, `textMuted`, centred, line-height 20, margin-top 8 |
| Detail slot | Optional node, margin-top 16. Used for a summary well: fill `fill`, radius 16, padding-y 12, columns split by a 1px `border` divider h 32 |
| Buttons | Row, gap 12, margin-top 24. **Cancel = `ghost`, flex 1** · **Confirm = `primary` (or `danger` when tone is danger), flex 1**. Both `numberOfLines={1}` |

**Tones:** `default` (primary/brand) · `danger` · `warning`.
**Loading:** the sheet stays open with a spinner on the confirm button; cancel disables.

> **Both buttons name their own outcome** — defaults are **"Yes, continue"** and
> **"No, cancel"**, never a bare "Cancel" opposite a bare "OK". A sheet whose only
> labelled choice is the way out reads as if there is no way forward.
>
> Cancel sits first and carries no fill. Weight marks the consequential choice, not
> position.

**In use — Clock Out:**
title "Clock out for today?" · message "This ends your shift. You will need an admin
to reopen the day." · confirm **"Yes, Clock Out"** · cancel **"No, not yet"**.

---

### 6.18 PunchSheet

Every punch in one place, opened from the bottom bar's centre button.

> The actions used to live on the attendance card, which meant they only existed on
> the home screen — an employee on the Leave tab had to navigate back just to clock
> out. Here they are one tap from anywhere, and the card goes back to being what it
> reads as: a status card.

BottomSheet, `maxHeightRatio 0.62`, padding 20 (top 8), gap 8.

| Element | Spec |
|---------|------|
| Title | "Attendance" — `T.section` |
| Summary well | Fill `fill`, radius 16, padding-y 12. Three columns split by 1px `border` dividers h 32: **Clocked in** · **Worked** · **Remaining**, each `T.micro` `textMuted` over `T.cardTitleSm` `text` |
| Action row | Fill `fill`, radius 16, padding 16 h / 14 v, gap 12. Icon well **40 × 40**, radius 12, **solid tone `tint`**, icon 20 stroke 2.2 **white**. Label `T.cardTitleSm` `text` → hint `T.caption` `textMuted` |
| Busy | The tapped row's well swaps its icon for a white spinner; every row disables |
| Day complete | No rows — a single centred `T.secondary` line, "Day complete — nothing left to punch." |

**Rows by state:**

| State | Rows |
|-------|------|
| No record | **Clock In** · "Start your day" · success |
| Clocked in, break unused | **Start Break** · "Pauses the clock" · warning — then **Clock Out** |
| Clocked in, break spent | **Clock Out** only |
| On break | **Resume Work** · "Restarts the clock" · info — then **Clock Out** |
| Clocked out | none |

**Clock Out closes this sheet first, then opens the ConfirmSheet** — a confirm stacked
on top is two modals deep, which Android dismisses in the wrong order.

> **One break a day.** Once a break has been both opened and closed
> (`break_out.at && break_in.at`), Start Break stops rendering. Offering an action the
> rule will reject is worse than not offering it — and the backend counts every break
> against worked hours.

---

### 6.17 Toast

Neutral card — **the severity is carried only by the icon and the progress bar**,
never by tinting the whole card.

| Token | Light | Dark |
|-------|-------|------|
| surface | `rgba(255,255,255,0.97)` | `rgba(28,30,34,0.97)` |
| border | `#E9EDF2` | `#33373E` |
| title | `#0F172A` | `#F8FAFC` |
| description | `#64748B` | `#9BA3AF` |
| close | `#94A3B8` | `#7C848F` |
| progress track | `rgba(15,23,42,0.06)` | `rgba(255,255,255,0.09)` |
| shadow | `#0F172A` @ 10 % | `#000000` @ 45 % |

| Kind | Accent (light) | Accent (dark) |
|------|----------------|---------------|
| success | `#10B981` | `#34D399` |
| error | `#EF4444` | `#F87171` |
| warning | `#F59E0B` | `#FBBF24` |
| info | `#3B82F6` | `#60A5FA` |

---

### 6.19 RangeChip (header dropdown trigger)

`ui.tsx`. The control that opens a picker sheet from a screen header — month, year,
any short filter. Attendance and Leave both use it, so "tap the chip, pick from a
sheet" is learned once.

| Element | Spec |
|---------|------|
| Shape | **h 36**, radius pill, padding-x 12, row gap 4 |
| Fill | `primary.bg` — tinted, never outlined: it shares its row with a title, and a bordered control there reads as an input the header does not have |
| Label | `T.badge` in `brand/700`, 1 line, `allowFontScaling={false}` |
| Affordance | ChevronDown **14** stroke 2.6 `brand/700` |
| Pressed | opacity 0.75 |
| a11y | Label must state the current value AND the verb — "Year 2026. Change year" |

---

## 7. Screens

### 7.1 Login (`LoginScreen`)

Background **white** + animated wave backdrop pinned to the bottom.
Content is vertically centered in a scroll view: side padding **24**,
top = safe-area + 24, bottom = safe-area + 24.

**Anatomy (top → bottom):**

| # | Element | Spec |
|---|---------|------|
| 1 | Logo | `assets/logo.png`, **200 × 180**, contain, centered, padding-bottom 40 |
| 2 | Heading | "Welcome back" — Display **26 / 32**, `#0F172A`, centered |
| 3 | Subhead | "Sign in to your account to continue." — UI Regular 14 / 20, `#64748B`, centered, margin-top 6 |
| 4 | Error banner *(conditional)* | margin-top 20, radius 16, fill `accent/50` `#FDF4EF`, 1px `accent/200` `#F6D0B9`, padding 16 h / 14 v. Left: 16 × 16 circle `accent/500` `#E06216` with white "!" 10. Text UI Medium 13 / 20 `accent/700` `#AA4A11` |
| 5 | "Email" label | UI Semibold 13, `#334155`, margin-top 28, margin-bottom 8 |
| 6 | Email field | **h 56**, radius 16, white, 1px `neutral/200` → `brand/500` on focus, padding-x 16, text UI Medium 15 `#0F172A`, placeholder `neutral/400` |
| 7 | "Password" label | as above, margin-top 20 |
| 8 | Password field | same as email + trailing "Show/Hide" text button, UI Semibold 12, `brand/600` |
| 9 | Remember me | margin-top 20, row, self-start. Box **22 × 22**, radius 6 (`rounded-md`), 2px border → checked = fill+border `brand/600` with white ✓ 12. Label UI Medium 13 `#475569`, margin-left 10 |
| 10 | Submit | **h 54**, radius 16, fill `brand/600`, centered white UI Semibold 15. Loading → opacity 0.6 + spinner + "Signing in…" |
| 11 | Footer note | "Trouble signing in? Please contact your HR admin." — UI Regular 12 / 16, `#94A3B8`, centered, margin-top 24 |

**Login backdrop (decorative, non-interactive):**
Field height = `min(screenHeight × 0.4, 340)`, anchored bottom, clipped.
- Vertical wash gradient: `rgba(57,169,53,0)` → `0.07` @55 % → `0.14` bottom
- 3 blurred bubbles: 14 px @ x16 % y62 % `brand/400`; 8 px @ x78 % y70 % `brand/500`;
  20 px @ x86 % y50 % `brand/200` — opacity 0.5
- 3 wave crests (very wide, short boxes with huge top radius → elliptical arcs):

| Layer | Width | Height | Bottom | Rotate | Gradient |
|-------|-------|--------|--------|--------|----------|
| Back | 260 % | 132 | −24 | −3° | `brand/100` → `brand/200` |
| Mid | 230 % | 116 | −44 | +2.5° | `brand/300` → `brand/400` |
| Front | 290 % | 104 | −66 | −1.5° | `brand/500` → `brand/700` |

**Motion:** waves rise + fade in (950 ms ease-out-cubic, staggered 0 / 120 / 240 ms);
bubbles rise 40 px over 1100 ms; wash fades over 1200 ms. Submit button carries an
idle **light sweep**: a 45 %-width band, gradient `rgba(255,255,255,0)` → `0.28` → `0`,
travelling left→right on a 1800 ms loop (hidden while loading).

---

### 7.2 Dashboard / Home (`DashboardScreen`)

Canvas `bg`. Scroll view; bottom padding = safe-area + **76** + 16.
Pull-to-refresh tint = `brand/600`.

| # | Block | Spec |
|---|-------|------|
Canvas is flat **white smoke `#F5F5F5`** — no ornament, no gradient wash. The
decorative SVG backdrop was built and then removed: against pure-white cards it
tinted the whole page green and fought the hero card for attention.

| # | Block | Spec |
|---|-------|------|
| 1 | **Greeting bar** | Padding: top = safe-area + 12, sides 20, bottom 20. Row, **items-start**, space-between. **Left (flex, pr 12):** "Good morning," `T.body` `textMuted` → first name + 👋 `T.screenTitle` `text` margin-top 2, 1 line. **Right cluster** (gap 10, margin-top 8 so it sits level with the name): NotificationButton + ProfileButton |
| 2 | **Attendance hero** | Directly under the greeting — see 7.2.1 |
| 3 | **Quick Actions** | margin-top 24. SectionHeader → View all. Scrolling rail — see 7.2.2 |
| 4 | **This Week Summary** | margin-top 24. SectionHeader → View all — see 7.2.5 |
| 5 | **Leave Balance** | margin-top 24. SectionHeader → View all. Horizontal scroll of BalanceTiles, side padding 20, gap 12 |
| 6 | **BottomNav** | active = `home` |

> **Two lines of greeting, not three.** The tagline ("Have a great day at work")
> said nothing the app did not already know, and it pushed the attendance card down
> by a full row of type to do it.

> **No menu button on the home screen.** The greeting owns the whole left side. The
> drawer already has a home in the bottom bar's "More" tab, and a hamburger competing
> with the name made the top of the screen read as chrome instead of as a welcome.
> `MenuButton` still exists as a component for any screen that needs it.

#### 7.2.1 Attendance hero card (`AttendanceCard`) — the visual centre of the app

**Not a white card.** A filled linear gradient: **`brand/700` → `brand/900`**
(`#15803D` → `#14532D`), diagonal **0,0 → 1,1**, radius **24**, margin-x 20,
padding 18, `shadow/card`. Height ≈ **194**.

> Deep and muted, **not** the bright ramp mid-tone. A saturated green at this size
> stops being a surface and starts being a signal.

| Row | Contents |
|-----|----------|
| Top row (**items-start**) | **Left column (flex, pr 12):** eyebrow `TODAY'S STATUS` `T.badge` **caps** letter-spacing **+0.6** `rgba(255,255,255,0.85)` → stopwatch `05:42:36` `T.kpiHero` white margin-top 10 → **status line** `T.body` `rgba(255,255,255,0.75)`. **Right:** goal ring **96 × 96**, aligned to the TOP |
| Punch row (margin-top 20) | **Three equal columns across the full card width**, centre-aligned, split by two **1px `rgba(255,255,255,0.2)` dividers, h 36**. Each: value `T.button` white (`--:--` placeholder) → label `T.secondary` `rgba(255,255,255,0.7)`. Order: **Check In · Break · Check Out** |
| Goal ring | **96 × 96**, stroke **9**, track `rgba(255,255,255,0.22)`, **arc `#FBBF24` (amber)**, round cap, starts 12 o'clock clockwise. Centre: "73%" `T.kpiSm` white + "of goal" `T.nano` `rgba(255,255,255,0.75)` |

> **No status chip.** It was only ever a word, and the line under the stopwatch
> carries that word for free — which buys the ring the whole top-right instead of a
> slot below the header.
>
> **The ring is capped at 96 and lifted to the top.** At 112, sharing a row with the
> punches, it claimed the entire right half and squeezed the times into truncation.

**Status line** (replaces the chip — it has to say what the number *is* and what
state the day is in, or a frozen stopwatch just looks broken):

| State | Line |
|-------|------|
| Clocked in | `Hours Worked` |
| On break | `On break · clock paused` |
| Clocked out | `Day complete` |
| No record | `Not clocked in yet` |
| Error | the API error title |

**Break column value:** running break → the time it started; finished break → its
duration (`01h 00m`); nothing taken → `--:--`. Empty, never zero.

**Why the arc is amber:** it is the only thing on this card that is a *measure*
rather than a *fact*, and against a deep green fill amber is the one accent that
stays legible without introducing a second status colour.

**The stopwatch is live** — `HH:MM:SS`, ticking every second while clocked in, frozen
during a break and at the clocked-out value. It is derived on the client from
`clock_in.at` minus closed breaks, because the server only recomputes
`total_work_minutes` on a punch.

**This card has no buttons.** Every punch lives on the bottom bar's centre button
(§6.11 / §6.18). The card exists on one screen; the punch has to exist on all of them.

**State matrix (design all six):**

| State | Hero stopwatch | Status line | Middle punch column |
|-------|----------------|-------------|---------------------|
| No record | `00:00:00` | Not clocked in yet | Break `--:--` |
| Clocked in | **worked**, live | Hours Worked | Break (total) |
| **On break** | **the BREAK timer**, live | On break · work paused | **Worked** (frozen total) |
| **On break, over the allowance** | break timer in **`#FBBF24`** | `On break · over 50m`, also amber | Worked |
| Clocked out | final worked total | Day complete | Break (total) |
| Error | `00:00:00` | the API error title | Break `--:--` |
| Loading | — | Skeleton h 176 / r 24, margin-x 20 | — |

> **Mid-break the hero becomes the break stopwatch.** A frozen worked-total answers
> "how much have I done"; mid-break the live question is "how long have I been gone",
> and that is the only number still moving. The worked total does not vanish — the
> middle punch column takes it over, so neither number is ever off-screen.
>
> **Overrun** is `EXPO_PUBLIC_LONG_BREAK_MIN` (default **50 min**). Past it the timer
> and its label turn amber — the same amber as the goal arc. No alert, no toast: the
> number going warm is the whole message.
>
> The ticker runs at 1 s for **both** `clocked_in` and `on_break`.

> Labels are **"Break"** and **"Resume"**, not "Start Break" / "End Break" — at
> 13.5 px neither survived a half-width button beside "Clock Out" on a 360 dp
> screen. The icon (Coffee vs Play) already says start-vs-resume. Every punch
> label is `numberOfLines={1}` and `allowFontScaling={false}`: a wrapped button
> label is the loudest possible way to say the layout was never checked.

**Clock Out asks first** — see §6.17. It is the one punch that cannot be undone
from this screen; a mis-tap ends the day and the fix is an admin regularisation
request. Clock In and both break punches stay one-tap, because all three are
recoverable.

#### 7.2.2 Quick Actions — a horizontal rail

**Horizontally scrolling**, not a fixed grid: new modules get appended without
re-flowing the row or shrinking every card that already exists. Side padding 20,
gap 12, no scrollbar. **The old 4 × 2 grid is gone** — it opened with five
greyed-out "soon" tiles, which made the busiest part of the screen the dead part.

**Card width is computed, never hardcoded:**
`(screenWidth − 40 − gap × (n−1)) / n` with **n = 3**.
A fixed width leaves the last card sliced by the screen edge, which reads as broken
rather than as "there is more". **Three per screen, not four** — at four the cards
come out ~79 px wide, narrower than the icon well is tall, and the row reads as a
strip of slivers. The fourth card peeking at the edge is what says the rail scrolls.

**Card:** width ≈ **106**, fill `card`, radius **20**, padding 8 h / 16 v,
**1px `border` in both schemes** + **`shadow/soft`** (light only).
Contents **centre-aligned**. Pressed → opacity 0.85 + scale **0.97**.

> The hairline does the separating; the shadow only lifts the card off the canvas.
> Edge-drawing is the border's job, not the shadow's.

| Element | Spec |
|---------|------|
| Icon well | **56 × 56**, radius **16**, **solid fill = surface `tint`**, icon **26 stroke 2.2** in **white** |
| Title | `T.cardTitleSm` (14), `text`, centred, margin-top 12, 1 line |

> **No hint line.** "View history" under a labelled icon repeats what the icon and
> the title already said, and it was the thing forcing a sub-scale 10 px size.
> It survives as the `accessibilityLabel` so screen readers still get it.
>
> **Solid well, white glyph.** A pale tint behind a coloured outline icon washes out
> at this size. The well is the only saturated thing on the card, so it has to carry
> the category on its own.

**The rail carries everything the bottom bar does NOT.** Home, Attendance, Leaves and
Profile each have a tab, and the centre button owns every punch — repeating any of
those here would be two doors into the same room. What is left is the long tail, and
a scrolling rail is exactly the right shape for a long tail.

| # | Title | Icon | Tone | Destination |
|---|-------|------|------|-------------|
| 1 | Leave | FileText | **danger** | LeaveApply |
| 2 | Payslip | Receipt | **purple** | *soon* |
| 3 | Tickets | LifeBuoy | **info** | *soon* |
| 4 | Calendar | CalendarDays | **success** | *soon* |
| 5 | Meetings | Users | **warning** | *soon* |
| 6 | Assets | Boxes | **purple** | *soon* |
| 7 | HR Policy | BookText | **info** | *soon* |
| 8 | More | LayoutGrid | **neutral** | opens the drawer |

> A *soon* card keeps the full styling of a live one but raises an info toast on tap
> ("Payslip is coming soon"). A dead tap reads as a bug; saying why does not.
>
> Each card still carries a one-line hint ("New request", "View salary") — but only
> in its `accessibilityLabel`, not on screen. Worth revisiting now that the rail holds
> eight near-identical shortcuts: on screen, that second line is what would stop them
> blurring together.

#### 7.2.3 BalanceTile

**168 × auto**, radius **24**, padding 16 all round, **1px border, no shadow in either
scheme** (`tone.border` on tinted tiles, `border` in dark; the filled tile has none —
it already has maximum contrast and a border would only muddy it).

> The shadow was removed because these live inside a horizontal ScrollView, which
> clipped the blur at the scroll frame — the bottom corners came out cropped and the
> tiles looked pressed into the canvas.

| Variant | Fill | Label | Value | Sub | Bar |
|---------|------|-------|-------|-----|-----|
| `filled` (lead bucket) | surface `tint` (solid) | `rgba(255,255,255,0.85)` | `#FFFFFF` | `rgba(255,255,255,0.75)` | white on `rgba(255,255,255,0.28)` track |
| `tint` (light) | surface `bg` | surface `text` | `text` | `textMuted` | surface `tint` on `fill` |
| `tint` (dark) | `card` | `textMuted` | `text` | `textMuted` | surface `tint` on `fill` |

Contents: label UI Semibold 12.5 → value row (Display **26 / 32** + " / 18" UI Regular 13,
baseline-aligned, gap 4, margin-top 6) → "Days Available" UI Regular 11 →
ProgressBar height **5**, margin-top 12.

**Buckets, in order:** `el` Annual Leave (**filled**, brand) · `sl` Sick Leave (purple)
· `cl` Casual Leave (warning) · `ml` Maternity Leave (info). Only buckets returned by
the API render — design 2-tile and 4-tile states.

#### 7.2.5 This Week Summary

**Card:** side padding 20, fill `card`, radius **24**, padding 16,
1px `border`, **no shadow in either scheme**. Row.

> A full-width panel has nothing beside it to be lifted above — the hairline is the
> only edge it needs.

| Part | Spec |
|------|------|
| **Totals panel** | Width **84**, fill `fill`, radius 16, padding 12. "Total Days" `T.nano` `textMuted` → value `T.kpiSm` `text` → margin-top 8 → "Present" `T.nano` → value `T.kpiSm` |
| **Plot** | margin-left 12, flex 1, row, items-end. Plot height **92** |
| **Bar** | Width **11**, radius **4** (small, not a pill — at 11 px wide a full cap eats most of the bar and short days end up as identical lozenges), fill `brand/600` (`brand/500` for today). Height = `minutes / ceiling × 92`, floor **6** |
| **Empty day** | A **20 × 4** `border`-coloured dash on the baseline, radius 4 — an absent day and a zero-minute day are not the same statement |
| **Day label** | `T.nano` `textMuted`, margin-top 8. Today: `T.badge` in `brand/600` |

**Ceiling** = `max(480, longest day)`, so one long day cannot flatten the rest.
**Week starts Monday.** Labels `Mon … Sun`.
**Data:** `GET /attendance/me?from&to` for the current Mon–Sun — seven rows, asked for
by range rather than filtered from a month on the device.
**Motion:** bars fade + rise in, staggered **60 ms** each, 420 ms.
**Loading:** one skeleton, h 168 / r 24.

---

### 7.3 Attendance (`AttendanceScreen`)

**One request per YEAR.** The roster grid, the list and the stats are three readings
of the same set, so fetching per-month would have meant three round trips to say one
thing. `GET /attendance/me?from=YYYY-01-01&to=YYYY-12-31`.

| # | Block | Spec |
|---|-------|------|
| 1 | **Header** | Padding top = safe-area + 8, sides 20, bottom 16. Row gap 12. ChevronLeft 24 stroke 2.2 `text` · **Title "My Attendance" at `T.section` (18), not `T.screenTitle`** — it shares the row with a control, and at 28 it pushed the year chip off a 360 dp screen · subtitle "`N` days recorded" `T.caption` `textMuted` · Right: **year dropdown** |
| 2 | **Year chip** | Right of the title. **h 36**, radius pill, fill `primary.bg`, padding-x 12, label `T.badge` `brand/700` + ChevronDown 14 stroke 2.6. Shown **only on the Attendance tab** — the Roster is always "this week", and a year belongs to the record, not to the schedule. Opens a BottomSheet (`maxHeightRatio 0.5`) listing the last **4** years as **h 48** rows, radius 16 — selected = fill `primary.bg` + `brand/700` + Check 18; others fill `fill` |

> One range control, not two. The month is chosen on the calendar's own stepper,
> which is the only place a month means anything on this screen.
| 3 | **Tabs** | Directly under the header, side padding 20, bottom padding 16. `Segmented` — **Roster · Attendance**, Roster is the default |
| 4 | **BottomNav** | active = `attendance` |

**Two tabs, two meanings:** **Roster** is the *schedule* — which shift, laid out over
this week. **Attendance** is the *record* — what actually happened against it.

**Tab mechanics**

- Each tab owns its **own ScrollView**, both kept mounted once visited, toggled with
  `display: 'none'`. Switching back lands exactly where you left; a shared scroll view
  dropped you at the top of the other tab every time.
- The Attendance tab is **lazy** — it is heavy (a year of records, a calendar and a
  card per day) and waits to be asked for.
- The **range chips live only on the Attendance tab**. The Roster is always "this
  week"; a month and a year belong to the record, not to the schedule.

---

**Roster tab** (`RosterView`) — everything derived from records already in memory.
There is no roster endpoint for an employee's own schedule, and the shift window is
stamped on every attendance record anyway.

| # | Block | Spec |
|---|-------|------|
| a | **Your Shift card** | SectionHeader "Your Shift". Card: fill `card`, radius 24, 1px `border`, no shadow, padding 16. CalendarClock 20 (info) + "Shift window" `T.micro` over `09:00 AM – 06:00 PM` `T.cardTitle` → divider → two **Fact** cells: **Shift length** (Hourglass, purple) · **Grace** (Clock3, warning) → divider → **Next shift** (Sunrise, success) |
| b | **Fact cell** | flex 1, row, gap 10. Icon 20 stroke 2 in the tone's `tint` · label `T.micro` `textMuted` over value `T.cardTitleSm` `text` |
| c | **This Week card** | SectionHeader "This Week". Card: fill `card`, radius 24, 1px `border`, padding-x 16 / y 4. Seven rows split by 1px `border` hairlines |
| d | **Day row** | py 12, gap 12. **44 × 44** date block (radius 14, fill `fill`, or `primary.bg` + `brand/700` ink for today) holding `Mon` `T.nano` over `14` `T.cardTitleSm` · then shift window `T.cardTitleSm` over either "8h 12m worked" or the date, `T.micro` `textMuted` · then a status **Badge** |
| e | **Row states** | **Worked** (success) · **Today** (info) · **Upcoming** (neutral) · **No record** (muted) |
| f | **Assumption note** | `T.micro` `textFaint`, margin-top 12: "Upcoming days assume your current shift. Your manager may change it." |

> Future days have no record, so their shift is *projected* from the most recent
> recorded one. That is said on screen rather than presented as fact — a projected
> shift passing for a rostered one is exactly the kind of thing people plan around
> and then get burned by.

---

**Attendance tab**

| # | Block | Spec |
|---|-------|------|
| a | **Stat rail** | **Horizontal scroll**, side padding 20, gap 12, bottom padding 20. Four cards, **fixed width 132** so the fourth peeks and the row reads as scrollable |
| b | **Stat card** | Fill `card`, radius **20**, 1px `border`, `shadow/soft` (light), padding 16. **36 × 36** solid-fill square radius 12 with white icon 18 stroke 2.2 → value `T.kpiSm` margin-top 12 → label `T.micro` `textMuted`. Cards: **Days Present** (Timer, success) · **Late Arrivals** (TimerReset, warning) · **Days Absent** (CalendarX, danger) · **Total Worked** (CalendarDays, purple) |
| c | **Month stepper** | Row, space-between, bottom padding 16. ChevronLeft / ChevronRight **20 stroke 2.2** in **36 × 36** hit areas, disabled (opacity 0.3) at January / December · centre `MMMM YYYY` `T.cardTitle`. **The twelve-chip month strip is gone** — a whole year of chips to swipe through, just to move the grid by one, was a lot of control for one small job |
| d | **Calendar** | On the canvas, **no card frame**, side padding 20. Weekday header: 7 columns, `T.nano` UPPERCASE `textFaint`, bottom padding 12. Day cell **14.28 % × 46**: inner **36 × 36** circle — 1.5px ring when today (`border`) or selected (`brand/600`); number `T.body` (`text` when a record exists, else `textFaint`); **status dot 6 × 6** below (margin-top 4) in the kind's `tint` |
| e | **Legend** | Centred wrap, gap 12, margin-top 16. 6 px dot + `T.micro` `textMuted`: Present (success) · Late (warning) · Absent (danger) · Leave (purple) · Holiday (info) |
| f | **Selected day panel** | margin-top 20, side padding 20. **One plain card** — fill `card`, radius 24, **1px `border`, no shadow, no tint**, padding 16. Title row: `Fri, 31 July 2026` `T.cardTitleSm` + Badge right → divider → **Clock In / Clock Out** side by side (each with location + IP) → divider → **Break / Work Hours / Device** as three `compact` cells |

> The panel used to be a tinted `primary.bg` wrapper around a white inner well. The
> tint existed to make that well read as raised — with the well gone there is nothing
> left for it to contrast against, and one surface says the same thing more quietly.

> **There is no separate day-list.** An earlier pass stacked a card-per-day under the
> calendar — the same year of data drawn twice, one scroll after the other. That is
> what made the page unreadable. The selected-day panel *is* the daily record: tap any
> date and it shows that day in full.

**Detail cell** — icon 12 `textFaint` + label (`T.micro`, or `T.nano` when `compact`)
→ value (`T.button`, or `T.cardTitleSm` when `compact`), 1 line, no font scaling
→ optional MapPin 11 + place `T.micro` `textMuted` (2 lines).

**Location resolution** — one helper, used everywhere a punch shows where it happened:

1. `location.address` if the server reverse-geocoded one
2. else `lat, lng` to **5 decimals** — a punch with a fix but no address still says
   *where*, rather than nothing
3. else **nothing renders**

> There is no `'Office'` fallback. Inventing a place is worse than admitting none was
> recorded — the earlier version printed "Office" under every punch, including the
> ones the server never located.
>
> An address on an attendance record is something people go and check. When a fix
> exists the whole line is a link into Maps; making someone retype coordinates is the
> kind of small cruelty apps get away with far too often.

**Empty state** — CalendarDays 32 · "No attendance yet" · "Nothing recorded in 2026.
Start by clocking in."

> The **filter** button is gone along with the month strip. Both were replaced by the
> single year dropdown; the List view is what narrowing a range is actually for.

**Day-kind → color map:** present → success · late/half-day → warning · absent → danger
· leave → purple · holiday → info · none → no dot.

**Status badge map:** Present (success) · Running (success) · Half Day (warning) · Absent (danger).

---

### 7.4 Leave (`LeaveScreen`)

Built to the SAME anatomy as Attendance — header + RangeChips, a rail of tiles, then
a list of `radius.card − 4` cards with a 1px hairline and `shadow/soft`. The two
screens are read one after the other, and until now they were laid out as if by two
different people.

| # | Block | Spec |
|---|-------|------|
| 1 | **Header** | Padding-top = safe-area + 8, side 20, bottom 16, row gap 12. ChevronLeft 24 · title "My Leave" `T.section` (**18**, NOT 28 — it shares the row with controls) + caption `T.caption` `textMuted` = "`N` requests in `<period>`". Right: **RangeChip** month + **RangeChip** year (shared `ui.tsx` control, identical to Attendance) |
| 2 | **"Leave Balance"** | SectionHeader (18 semibold, side 20, margin-bottom 12) |
| 3 | **Balance strip** | Horizontal scroll of BalanceTiles, **w 168**, side padding 20, gap 12. Loading → 2 × Skeleton 118 × 168, radius 24 |
| 4 | **"Requests"** | SectionHeader, preceded by 24 top padding |
| 5 | **Status filter rail** | Horizontal scroll, side 20, gap 8, bottom padding 16. Chips: **h 36**, radius pill, padding-x 14, gap 6 — label `T.badge` + count `T.count`. Active = fill `brand/600`, white label + `rgba(255,255,255,0.75)` count. Inactive = fill `card` + 1px `border` (light only), `textMuted` label + `textFaint` count; **opacity 0.5 when its count is 0**. Order: All · Pending · Approved · Rejected · Cancelled |
| 6 | **Month group label** | Only while the month filter is "All": `T.micro` uppercase `textFaint`, side padding 20. Groups newest-first, 20 between groups, 12 between cards |
| 7 | **Request card** | Fill `card`, radius **20** (`card − 4`), 1px `border`, padding 16, `shadow/soft` (light) / none (dark). Head: date well **48 × 48** radius 14, fill = status `tone.bg` (light) / `fill` (dark), day 2-digit `T.cardTitle` + month `T.nano` in `tone.text` (light) / `text` (dark) · type `T.cardTitleSm` + span `T.micro` `textMuted` (`Mon, 12 Jul 2026` for one day, `12 Jul → 14 Jul 2026` for a range) · status Badge |
| 8 | **Card facts strip** | Margin-top 12, fill `fill`, radius 12, padding 12 h / 10 v, gap 12, 1px × 28 dividers. Duration · Session (Half day / Full day) · Applied (omitted when the API sends no `createdAt`). Each: label `T.nano` `textMuted` + value `T.cardTitleSm` `text` |
| 9 | **Reason** | Margin-top 12, FileText 13 `textFaint` + `T.secondary` `textMuted`, **3 lines** max |
| 10 | **Reviewer note** | Margin-top 12, own block: fill = status `tone.bg` (light) / `fill` (dark), radius 12, padding 12. MessageSquareText 13 in `tone.tint` + reviewer name `T.nano` `tone.text` + note `T.secondary` `text`. Quoted separately so an admin's words never read as the employee's own reason |
| 11 | **Withdraw** | Pending only. Margin-top 12, self-start, fill `fill`, radius pill, padding 12/6, X 13 stroke 2.6 + "Withdraw" `T.badge`, both `textMuted`. Spinner replaces the glyph while the mutation is in flight |
| 12 | **Withdraw confirm** | `ConfirmSheet` (§6.16), tone **danger**, icon TriangleAlert. Title "Withdraw this request?" · message "This cancels the request for good. You can always apply again." · detail well = Type │ Dates │ Days · **No, keep it** / **Yes, withdraw**. The summary restates WHICH request, because the list scrolled out of view the moment the sheet came up |
| 13 | **Month / year pickers** | Identical to Attendance §7.3 — 3-across month grid, year list with a Check on the active row |
| 14 | **FAB** | Absolute, right 20, bottom = safe-area + 78. **h 52**, radius pill, fill `brand/600`, padding-x 20, `shadow/floating`. Plus 20 stroke 2.4 white + "Leave" UI Semibold 14.5 white, gap 8. Pressed → scale 0.95. **The only apply affordance on the screen** — the header's + button was removed |
| 15 | **Error state** | TriangleAlert 32 · "Could not load your leave" · the API message · action "Try again" (refetches list + balance) |
| 16 | **Empty state** | ClipboardList 32. Filter "All" → "No leave in this period" + action "Apply for leave"; any other filter → "Nothing `<status>` here" + action "Show all" |
| 17 | **BottomNav** | active = `leaves`. Scroll bottom padding = safe-area + 78 + 76 (extra room for the FAB) |

**Removed on purpose:** the timeline rail (22px of dotted line for a sequence the
dates already state, and it pushed every card off the 20px grid the rest of the app
sits on), the year stepper and the 13-chip month strip (both replaced by the two
header RangeChips), and the header + button.

**Leave status → tone:** Approved → success · Pending → warning · **Rejected → purple**
(deliberately not red — red already means "absent" on the calendar, and a declined
request is not an error) · Cancelled → neutral.

**Type labels:** `sl` Sick Leave · `el` Annual Leave · `unpaid` Unpaid Leave.

**Filtering is client-side.** `GET /leave/me` takes no date range, so year, month and
status all filter the one cached list — a personal history is tens of rows, and
filtering locally is what keeps every chip instant.

---

### 7.5 Apply for Leave (`LeaveApplyScreen`)

ScreenHeader "Apply for Leave" + subtitle "`N` days selected".
Scroll: side padding 20, gap **20** between field groups, bottom padding = safe-area + 120.

| # | Block | Spec |
|---|-------|------|
| 1 | **Error banner** *(conditional)* | fill `danger.bg` `#FEF2F2`, radius 20, padding 16 h / 12 v, gap 10, items-start. AlertCircle 17 in `danger.tint`; text UI Medium 13 / 20 in `danger.text` |
| 2 | **Field wrapper** | label UI Semibold 13 `textMuted` → control → optional hint UI Regular 11.5 `textFaint`; gap 8 |
| 3 | **Leave type selector** | 3 equal segments, gap 8, **h 46**, radius 16. Active = fill `brand/600` + white UI Semibold 12.5; inactive = fill `card` + 1px `border` (light) + `textMuted`. Labels: **Sick / Emergency · Earned · Unpaid**. Hint: "`N` day(s) available in this bucket." |
| 4 | **Dates** | Row, gap 12: two DateFields ("From" / "To"). When half-day is on, the second field disappears and the first is relabelled **"Date"** |
| 5 | **Half day** | Full Card (padding 16) acting as a checkbox row: box **22 × 22** radius 6, 2px border → checked fill+border `brand/600` with Check 13 stroke 3 white; gap 12. Title "Half day" UI Semibold 14 `text`; sub "Counts as 0.5 against your balance." UI Regular 12 `textMuted` |
| 6 | **Reason** | Multiline TextInput, **min-height 110**, fill `card`, radius 16, 1px `border` (light) / none (dark), padding 16 h / 12 v, text UI Medium 14 `text`, placeholder `textFaint` = "Why do you need this leave?", top-aligned |
| 7 | **Policy note** | UI Regular 11.5 / 16 `textFaint` — "Your request goes to your reporting manager for approval. You can withdraw it from My Leave while it is still pending." |
| 8 | **Sticky footer CTA** | Side padding 20, top padding 12, bottom = safe-area + 12, fill `bg`, 1px top border. Primary Button full-width with Send icon 18 — "Submit request" / "Submitting…" |

**Validation messages to design:** empty reason · end date before start · balance exceeded.

---

### 7.6 App Drawer (`AppDrawer`) — a bottom sheet, not a side drawer

BottomSheet, default max height 86 %.

| # | Block | Spec |
|---|-------|------|
| 1 | **Header** | Side padding 20, bottom padding 16, row gap 12. Avatar **44**. Name UI Semibold 15 `text` (1 line). Sub UI Regular 12.5 `textMuted` — `Designation · Department`, falling back to email. Close: **32 × 32** circle, fill `fill`, X 16 `textMuted` |
| 2 | Divider | 1px `border`, full bleed |
| 3 | **Menu list** | Side padding 20, padding-y 8, scrollable. Row **h 48**, gap 14: icon 19 stroke 2 in `brand/600` (or `textFaint` when soon) + label UI Medium 15 + trailing ChevronRight 17 `textFaint` — or the word "Soon" UI Regular 11.5 `textFaint`. **No tinted wells, no badges** — eight rows of colored tiles is what made this list feel loud |
| 4 | Divider | 1px `border` |
| 5 | **Appearance** | SettingRow **h 48**: label "Appearance" UI Medium 14 `textMuted`; right = segmented control, fill `fill`, radius pill, padding 2. Three segments (padding 10 h / 6 v, gap 16): **Light (Sun) · Dark (Moon) · Auto (SunMoon)**. Active segment = fill `card`, icon `brand/600`, label `text`; inactive = icon+label `textFaint`. Icon 13, label UI Semibold 11.5 |
| 6 | **Log out** | **h 48**, radius 16, fill `fill`, margin-top 8, centered row gap 8. LogOut 17 `danger/500` + "Log out" UI Semibold 14 `danger/600` |
| 7 | **Version** | "SHR · Version 1.0.0" UI Regular 11 `textFaint`, centered, margin-top 10 |

**Menu entries (in reach-frequency order):** My Leaves · Attendance · Meeting *(soon)*
· Calendar *(soon)* · Tickets *(soon)* · Refer & Earn *(soon)* · HR Policy *(soon)*
· Asset Request *(soon)*.

---

### 7.7 Notifications sheet (`NotificationSheet`)

BottomSheet, max height **78 %**.

| # | Block | Spec |
|---|-------|------|
| 1 | **Header** | Padding: sides 20, top 4, bottom 12, gap 12. "Notifications" Display 17 `#0F172A` · "Mark all read" UI Semibold 12 `brand/600` (only when unread exist) · Close **32 × 32** circle `#F1F5F9` with X 16 `neutral/500` |
| 2 | Divider | 1px `#F1F5F9` |
| 3 | **Row** | Padding 20 h / 14 v, gap 12. Unread → row fill `primary.bg`; read → transparent. Icon well **36 × 36** radius 12: unread = fill `brand/100` + icon `brand/600`; read = fill `neutral/100` + icon `neutral/400`; icon 17 stroke 2. Body: title 13 (unread = UI Semibold `#0F172A`, read = UI Medium `#475569`) + relative time UI Regular 11 `#94A3B8` on the right; message UI Regular 12 `#64748B`, 2 lines, margin-top 2. Unread dot **8 × 8** `brand/600`, top-aligned |
| 4 | **Separator** | 1px `#F1F5F9`, inset **left 68** (aligns under the text, not the icon) |
| 5 | **Empty** | Padding 20 h / 56 v, centered, gap 8. BellOff 26 stroke 1.8 `neutral/300` + "You're all caught up" UI Medium 13 `#94A3B8` |
| 6 | **Loading** | 160 px tall centered spinner in `brand/500` |

**Type → icon:** ticket → LifeBuoy · sla → Timer · system → Bell · comment →
MessageSquare · attendance → CalendarCheck.
**Relative time format:** `just now` · `12m` · `3h` · `2d` · `4w`.

---

### 7.8 AccountCard (component — currently unused on Dashboard)

Card (`padded=false`), inner padding 16, row gap 12, items-start.
Avatar **52** · name UI Semibold 16 → designation UI Regular 12.5 `textMuted` (margin-top 2)
→ MetaRow Building2 12 + department → MetaRow BadgeCheck 12 + "Employee ID: …"
(both UI Regular 12 `textMuted`, margin-top 4, gap 6).
Right: **On Duty** Badge (success) / **Off Duty** Badge (neutral) + ChevronRight 18 `textFaint`, gap 8.
Drawer variant swaps the chevron for a **32 × 32** close circle.

---

### 7.9 Profile (`ProfileScreen`)

Reached from the dashboard header avatar. **Read-only** — every row below needs an
endpoint that does not exist yet, so they are marked "Soon" rather than wired to a
guess. The identity card renders from the session user already in the store, so the
screen makes no request of its own.

| # | Block | Spec |
|---|-------|------|
| 1 | **Header** | Padding: top = safe-area + 8, sides 20, bottom 16. Row gap 12. ChevronLeft 24 stroke 2.2 `text` · "Profile" Display **22 / 28** `text` (flex) · Settings gear 21 stroke 2 `textMuted` → opens the AppDrawer |
| 2 | **Identity card** | Full width (screen − 40), **height 132**, radius 20, `shadow/card`, clipped. Fill = linear gradient `brand/600` → `brand/800`, diagonal 0,0 → 1,1. Padding-x 18, contents vertically centered |
| 3 | **Card decoration** | 3 concentric white arcs, origin cx = **94 %** w / cy = **16 %** h, radii **44 % / 62 % / 82 %** of card width, stroke width **1.2**, opacity **0.18 / 0.14 / 0.10** |
| 4 | **Card contents** | Row gap 16. Avatar **84** with a **2px `rgba(255,255,255,0.7)` ring**. Text column: name Display **20 / 28** white (1 line) → designation UI Regular 13 `rgba(255,255,255,0.8)` (margin-top 2) → "Emp ID: SHR1234" UI Medium 13 `rgba(255,255,255,0.9)` (margin-top 4), falling back to the email when there is no employee id |
| 5 | **Row list** | **Flat** — margin-top 16, fill `card`, radius **24**, 1px `border`, **no shadow**, clipped. The gradient card above is the one thing on this screen that sits forward; a shadow under the settings list too made two competing planes out of a page that is really "identity, then a list" |
| 6 | **Row** | **h 56**, padding-x 16, gap 14. Icon **20 stroke 1.8** in `text` (or `textFaint` when soon) · label UI Medium **15** · trailing ChevronRight 18 `textFaint`, or the word "Soon" UI Regular 11.5 `textFaint`. Pressed → opacity 0.6 |
| 7 | **Separator** | 1px `border`, inset **left 54** — starts under the label, not the glyph |
| 8 | **Logout row** | Same geometry. LogOut icon `danger/500` `#EF4444`, label `danger/600` `#DC2626`, chevron `danger/200`. This one is live — it clears the session |
| 9 | **BottomNav** | active = `more` |

**Rows, in order:** Personal Information (CircleUserRound) · Bank Details (Landmark)
· Documents (FileText) · Emergency Contact (UserRoundCog) · Change Password (KeyRound)
· Privacy Policy (ShieldCheck) — **all "Soon"** — then **Logout** (LogOut, live).

---

### 7.10 Splash / bootstrap

Full screen fill `brand/700` `#15803D`, centered ActivityIndicator in `brand/200` `#BBF7D0`.
Shown only while the saved session is read from storage.

---

## 8. Motion specification

| Interaction | Spec |
|-------------|------|
| Bottom sheet open | translateY → 0, **300 ms**, ease-out-cubic; scrim fades in tied to offset |
| Bottom sheet close | translateY → height, **210 ms**, ease-in-quad |
| Sheet drag-dismiss | Handle-only pan; dismiss past **28 %** height or velocity **> 950** |
| Sheet snap-back | Spring — damping 20, stiffness 240, mass 0.6 |
| Bottom nav pill | Spring scale 0.7 → 1.0 + fade — damping 16, stiffness 220, mass 0.5 |
| Header button press | Scale → **0.93**, 130 ms ease-out-quad (in and out) |
| Generic press feedback | Opacity **0.6–0.85** (0.6 for icon-only, 0.7–0.85 for filled) |
| Disabled | Opacity **0.55** (buttons) / **0.5** (nav) / **0.35** (future months) |
| **Attendance goal ring** | Arc sweeps **0 → value** on mount, **1200 ms**, ease-out-cubic (animated `strokeDashoffset`) |
| **Week bars** | Fade + rise in, staggered **60 ms** per bar, 420 ms each |
| **Attendance stopwatch** | Re-renders every **1 s** while clocked in; frozen on break and after clock-out |
| **Card press** (quick action / card button) | Scale **0.97** + opacity 0.85 |
| Skeleton pulse | Opacity 0.5 ⇄ 1.0, **850 ms**, ease-in-out-quad, infinite alternate |
| Login waves | Rise + fade, **950 ms** ease-out-cubic, stagger 0 / 120 / 240 ms |
| Login bubbles | Rise 40 px, **1100 ms** ease-out-cubic, to opacity 0.5 |
| Login button sweep | 45 %-width light band, left → right, **1800 ms** linear loop (one direction) |
| FAB press | Scale **0.95** |
| Pull to refresh | Native spinner, tint `brand/600` |

---

## 9. Accessibility rules baked into the code

- Minimum touch target **44 × 44**; smaller controls get `hitSlop` 6–10 px.
- Every interactive element carries a role + label; disabled "soon" items also
  carry the hint **"Coming soon"**.
- **State is never color-only:** the notification row repeats unread with a dot;
  the calendar separates "today/selected" (a ring) from "status" (a dot) so the
  two never compete for the same color.
- Text truncates with `numberOfLines` rather than wrapping unpredictably — design
  1-line and 2-line variants for names, titles and messages.
- `allowFontScaling={false}` only on numerals inside fixed-size shapes
  (ring %, badge counts, tab labels, checkmarks).

---

## 10. Design tokens → Figma variable naming

Create these collections so the handoff maps 1:1 to code:

```
Collection: Color
  Modes: Light | Dark
  brand/50…900          → theme/themes.ts (green ramp)
  neutral/50…900        → theme/colors.ts neutral
  success|warning|danger|info|purple / 50,100,200,500,600,700
  surface/{name}/{bg,border,tint,text}
  scheme/{bg,card,fill,border,text,textMuted,textFaint,scrim}   ← mode-aware

Collection: Number
  space/{xs,sm,md,lg,xl,xxl,xxxl,screen} = 4,8,12,16,20,24,32,20
  radius/{card,button,input,well,pill}   = 20,16,16,16,999
  size/{navHeight,navClearance,button,cardButton,field,chip}
        = 64, 76, 52, 46, 56, 36

Collection: Effect
  shadow/card, shadow/floating, shadow/sheet     (light mode only)
```

---

## 11. Asset checklist

| Asset | Path | Notes |
|-------|------|-------|
| App icon | `assets/app-icon.png` | 1024 × 1024, no transparency |
| Android adaptive foreground | `assets/adaptive-icon-foreground.png` | On `#FFFFFF` background |
| Web favicon | `assets/favicon-shr.png` | — |
| Logo (mark + SHR wordmark) | `assets/logo.png` | Login **200 × 180** · Dashboard brand bar **52 × 40**, both `contain` |
| Font | Outfit 400 / 500 / 600 / 700 | Google Fonts |

---

## 12. Open design questions (decide before the Figma build)

1. **Palette unification** — runtime Green vs Tailwind teal/orange/plum. Recommendation:
   drop the Tailwind `brand`/`accent`/`plum` families, re-map the Login error banner
   to the `warning` surface, and keep a single Green brand ramp.
2. **AccountCard on Dashboard** — commented out, and the Profile screen now covers
   the same ground. Delete the component, or keep it for a future "team" view?
3. **Accent picker** — the five-theme swatch row was intentionally removed from the
   drawer. Confirm it stays out.
4. **"Soon" modules** — Calendar, Meetings, Tickets, Assets, Payslip, Refer & Earn,
   HR Policy, Asset Request are placeholders. Design them now, or ship the current
   3-module scope first?
5. **Dark mode coverage** — Login, DateField and NotificationSheet still use hardcoded
   white/slate values instead of scheme tokens. Design their dark variants and the
   code will need to follow.