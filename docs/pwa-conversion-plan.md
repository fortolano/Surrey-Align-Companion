# SurreyALIGN — PWA Conversion Plan

## Goal

Convert the existing Expo/React Native app into a fully functional Progressive Web App (PWA) that feels native when installed on a phone's home screen — no Expo Go required, no app store needed. Leaders simply tap a link, "Add to Home Screen," and use it like a real app.

---

## Current State

- **Framework**: Expo + React Native (TypeScript)
- **Routing**: Expo Router with `(auth)` and `(app)` route groups
- **Backend**: Express API on port 5000
- **Screens**: 22 screens across login, tabs (Home, Add, Notifications, More, Callings), and detail views (Profile, Goals, Callings, Agendas, Settings, etc.)
- **Web support**: Expo already generates a web build, but it has layout/UX issues when used as a PWA

---

## Phase 1: PWA Foundation & Manifest

### 1.1 — Web App Manifest (`manifest.json`)
Create a proper PWA manifest file with:
- `name`: "SurreyALIGN"
- `short_name`: "SurreyALIGN"
- `description`: "Leadership Companion for Surrey BC Stake"
- `start_url`: "/"
- `display`: "standalone" (removes browser chrome — address bar, back button, etc.)
- `orientation`: "portrait"
- `theme_color`: "#016183" (brand teal)
- `background_color`: "#016183" (matches splash)
- `icons`: Multiple sizes (192x192, 512x512) from existing icon assets

### 1.2 — Update `app.json` Web Config
Add web-specific PWA configuration:
- Reference the manifest
- Set `backgroundColor` and `themeColor`
- Configure meta tags for iOS standalone mode (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`)

### 1.3 — Custom HTML Template
Create a custom `web/index.html` (Expo's web entry point) to include:
- Link to `manifest.json`
- Apple-specific meta tags for iOS PWA support
- Viewport meta tag locked down: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
- Theme color meta tag

### 1.4 — PWA Icons
Generate PWA icon set from existing `icon.png`:
- 192x192 (standard)
- 512x512 (splash/install prompt)
- Apple touch icon (180x180)

---

## Phase 2: Lock Down Browser Behaviors

This is the critical phase that prevents the "it feels like a website" problems.

### 2.1 — Global CSS Reset for PWA
Create a web-only global stylesheet that applies to the entire app:

- Prevent overscroll bounce / pull-to-refresh
- Prevent text selection (feels native)
- Allow text selection only in input fields
- Prevent pinch-to-zoom
- Fix viewport to fill screen
- Prevent elastic/rubber-band scrolling on iOS Safari
- Prevent long-press context menu on images/links
- Disable pull-to-refresh

### 2.2 — Viewport Locking
In the custom HTML template, the viewport meta tag must include:
- `maximum-scale=1` — prevents pinch zoom
- `user-scalable=no` — prevents double-tap zoom
- `viewport-fit=cover` — extends content behind notches/status bars

### 2.3 — Touch Event Handling
Add a web-only root-level touch handler that:
- Prevents default on multi-touch gestures (pinch zoom)
- Prevents the page from being draggable/movable
- Only allows scrolling within designated scrollable containers (ScrollView, FlatList)

### 2.4 — Disable Context Menu
Prevent long-press context menus on non-input elements.

---

## Phase 3: Layout & Sizing Fixes

### 3.1 — Full-Screen Layout Lock
Ensure every screen fills exactly 100% of the viewport:
- Root container: `position: fixed; top: 0; left: 0; right: 0; bottom: 0;`
- No content should overflow the viewport boundary
- Scrolling only happens inside designated scroll containers, never the page itself

### 3.2 — Safe Area Handling for PWA
When running as a standalone PWA:
- Status bar area is handled by `viewport-fit=cover` + safe area insets
- Bottom home indicator area needs proper padding
- Audit all screens for correct `useSafeAreaInsets()` usage on web
- Replace hardcoded web inset values with dynamic detection based on whether running as PWA vs. regular browser

### 3.3 — Keyboard Behavior
When the on-screen keyboard opens:
- The viewport should not resize or shift the entire page
- Input fields should scroll into view within their scroll container
- The tab bar should remain hidden behind the keyboard (not pushed up)
- Audit all forms: Login, Calling Create, Goal Detail, Settings, Profile

### 3.4 — Tab Bar Fixed Positioning
Ensure the bottom tab bar:
- Stays fixed at the bottom of the viewport
- Never bounces or moves with page drag
- Has proper bottom padding for devices with home indicators
- Doesn't get pushed up when the keyboard opens

---

## Phase 4: Screen-by-Screen UI Polish

Audit and fix each screen for web-specific rendering issues.

### 4.1 — Login Screen (`(auth)/index.tsx`)
- Verify form card doesn't overflow on small screens
- Keyboard opens without pushing content off-screen
- Logo and branding render correctly
- No horizontal scroll

### 4.2 — Home Screen (`(app)/(tabs)/index.tsx`)
- Header gradient renders correctly
- Avatar menu dropdown positions properly
- Cards don't overflow horizontally
- Quick Access items are properly spaced
- Action cards render cleanly

### 4.3 — Add Screen (`(app)/(tabs)/add.tsx`)
- Action buttons render with proper spacing
- No layout shift

### 4.4 — Notifications Screen (`(app)/(tabs)/notifications.tsx`)
- List scrolls smoothly within container (not the page)
- Pull-to-refresh works within the list, not the browser
- Empty state renders centered

### 4.5 — More Screen (`(app)/(tabs)/more.tsx`)
- Menu items render with correct spacing
- Sign Out button positioned correctly at bottom
- No overflow

### 4.6 — Callings Screen (`(app)/(tabs)/callings.tsx`)
- Tab/filter bar renders correctly
- List scrolls within container
- Status badges render properly

### 4.7 — Profile Screen (`(app)/profile.tsx`)
- Modal presentation works on web (or falls back to full-screen)
- Form fields accessible with keyboard
- Sign Out button visible

### 4.8 — Detail Screens (Goal Detail, Calling Detail, Sunday Business, Sustainings)
- Long content scrolls within container, not the page
- Action buttons stay visible (not scrolled off-screen)
- Forms work correctly with keyboard

### 4.9 — Agenda Screens (HC Agenda, SC Agenda)
- Content renders properly on web
- No double scrollbars

### 4.10 — Settings, About, Terms, ALIGN Info/Pulse
- Static content renders cleanly
- Links open in new tabs (not navigate away from PWA)
- Version info displays correctly

---

## Phase 5: Visual Polish & Platform-Specific Styling

### 5.1 — Shadows
React Native `shadow*` props are deprecated on web. Replace with `boxShadow` for web:
- Audit all components using `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
- Add `Platform.OS === 'web'` checks to use CSS `boxShadow` equivalents
- Applies to: cards, tab bar, buttons, modals, dropdowns

### 5.2 — Fonts
- Verify Inter font family loads correctly on web
- Ensure font weights render consistently
- Check that custom font declarations don't flash unstyled text (FOUT)

### 5.3 — Animations
- Verify `react-native-reanimated` animations work on web
- Replace any non-working animations with CSS transitions for web
- Test: login form fade-in, screen transitions, tab switching

### 5.4 — Scrollbars
- Hide browser scrollbars on scroll containers
- Use CSS to hide webkit and Firefox scrollbars

### 5.5 — Focus Outlines
- Remove default browser focus outlines on buttons and pressables
- Add subtle custom focus indicators for accessibility

---

## Phase 6: Service Worker & Offline Basics

### 6.1 — Service Worker Registration
- Register a basic service worker for PWA installability
- Cache the app shell (HTML, CSS, JS bundles)
- Cache font files

### 6.2 — Offline Fallback
- Show a friendly "You're offline" message when network is unavailable
- Cache the most recent data so screens aren't completely blank offline

### 6.3 — Install Prompt
- Detect if the app is installable (not yet installed)
- Optionally show a subtle "Add to Home Screen" prompt on first visit

---

## Phase 7: Testing & Validation

### 7.1 — PWA Audit
- Run Lighthouse PWA audit — target all green checks
- Verify manifest is detected
- Verify service worker registers
- Verify installability

### 7.2 — Device Testing
- Test on iPhone Safari (primary target for church leaders)
- Test on Android Chrome
- Test on desktop browsers (fallback)
- Verify "Add to Home Screen" flow on both platforms

### 7.3 — Behavioral Testing
- Confirm: no page dragging/bouncing
- Confirm: no pinch-to-zoom
- Confirm: no pull-to-refresh (browser-level)
- Confirm: no address bar visible in standalone mode
- Confirm: keyboard doesn't break layout
- Confirm: all navigation works (tabs, back, modals)
- Confirm: login/logout flow works correctly
- Confirm: all forms submit properly

### 7.4 — Regression Testing
- Verify native (Expo Go) app still works identically
- All PWA changes must be behind `Platform.OS === 'web'` checks
- No native functionality broken

---

## Implementation Order

| Step | Phase | Estimated Effort |
|------|-------|-----------------|
| 1 | Phase 1: PWA Foundation & Manifest | Small |
| 2 | Phase 2: Lock Down Browser Behaviors | Medium |
| 3 | Phase 3: Layout & Sizing Fixes | Medium |
| 4 | Phase 4: Screen-by-Screen UI Polish | Large |
| 5 | Phase 5: Visual Polish & Styling | Medium |
| 6 | Phase 6: Service Worker & Offline | Medium |
| 7 | Phase 7: Testing & Validation | Medium |

---

## Key Principles

1. **All changes are web-only** — Every modification uses `Platform.OS === 'web'` guards so the native Expo Go experience is untouched.
2. **No new dependencies if possible** — Use CSS and built-in browser APIs for PWA behaviors.
3. **Mobile-first** — The PWA targets phone screens (375px-430px width). Desktop is a bonus, not a priority.
4. **Progressive enhancement** — The app works in a regular browser tab. It works *better* when installed as a PWA.

---

## Rollback Plan

If the PWA conversion introduces issues or isn't satisfactory:
- All code changes will be behind platform checks, so reverting means removing web-specific code only
- A Replit checkpoint exists from before the conversion started
- The native Expo Go experience remains completely unaffected throughout
