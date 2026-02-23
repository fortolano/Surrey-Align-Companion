---
name: pwa-studio
description: >
  Use this skill when building or upgrading a production-quality Progressive Web App (PWA)
  with strong UI design, app-like touch and viewport behavior, offline support, installability,
  performance budgets, accessibility, and automated quality gates. Trigger for new PWAs and
  for requests to make a web app feel native on mobile.
---

# PWA Studio v2

Build beautiful, robust PWAs in small, verifiable steps. Prioritize app-like mobile behavior,
strong UX polish, safe caching, and repeatable quality gates.

## Trigger Rules

Use this skill when the request involves:
- New PWA implementation.
- Upgrading an existing app to offline + installable behavior.
- Native-like mobile web behavior (no drag/wobble/bounce/pinch zoom).
- Fixing touch handling, viewport instability, pull-to-refresh, or elastic scrolling.
- React Native Web apps that need web-specific polish.

Do not use this skill for:
- Backend-only, CLI, or data pipeline work.
- Static marketing pages with no PWA requirements unless explicitly requested.

If intent is unclear, ask one short disambiguation question, then proceed.

## Non-Negotiable Outcomes

1. Beautiful, consistent UI with responsive behavior.
2. Correct PWA setup: manifest, service worker, offline UX, install UX.
3. Locked app-like mobile behavior:
- Disable pinch zoom.
- Disable document drag/wobble.
- Disable overscroll bounce and pull-to-refresh.
- Ensure stable full-viewport layout and keyboard handling.
4. Strong performance and sensible dependency choices.
5. Accessible interaction (focus visibility, semantics, keyboard support).
6. Repeatable engineering quality gates.
7. Safe caching and privacy-conscious defaults.

## Defaults and Adaptation

Respect existing stack first. Do not force migrations.

Greenfield defaults:
- Vite + React + TypeScript.
- Tailwind or repo-native styling.
- `vite-plugin-pwa` for manifest/SW integration.
- Minimal local state first; add state library only when justified.
- Vitest + Testing Library.
- Playwright smoke flow when navigation exists.

Framework-aware adaptation:
- Next.js: use a Next-compatible PWA setup.
- SvelteKit/Nuxt: use framework-native service worker/PWA approach.
- React Native Web: apply explicit web polish and touch/viewport patches.

Use the package manager already present in the repo lockfile.

## Workflow

### Step 0: Gather minimum requirements
Collect only what is necessary:
- App purpose and top 2-5 screens.
- Offline mode: read-only or offline create/edit.
- Data source: local, mocked, or API.
- Brand direction (colors/typography/tone).
- Orientation preference.

If details are missing, choose sensible defaults and continue.

### Step 1: Produce a short implementation plan
Include:
- Feature list.
- Screen map.
- File-tree plan.
- PWA strategy summary.
- Viewport and touch lock strategy.
- Cache strategy by resource type.
- SW update strategy.
- Offline data/conflict strategy if edits are supported.

### Step 2: Build the UI foundation
Set a small design system:
- Tokens: color, spacing, type scale, radius, shadow, motion.
- Component state rules: default, hover, active, focus-visible, disabled, loading, error.
- Mobile-first layout and breakpoints.
- Semantic landmarks and accessible form structure.

### Step 3: Enforce locked app-like viewport and touch behavior
Read `references/viewport-lock.md` and implement the required policy.

Required behavior:
- Viewport cannot be zoomed or pinched.
- Root document cannot be dragged, bounced, or pull-to-refreshed.
- Layout fills viewport consistently and stays stable on keyboard open.
- Scroll behavior exists only in explicit internal scroll containers.
- Safe-area insets are handled on notch devices.

### Step 4: Implement PWA core
Read `references/sw-strategies.md` and implement:
- Manifest with install-ready metadata and icons (including maskable).
- Orientation lock if requested.
- Splash and status-bar-consistent theme values.
- Service worker precache + runtime routes + offline fallback.
- Versioned caches with cleanup on activate.
- Explicit exclusion for sensitive/authenticated responses.

Platform install UX:
- Android install prompt support.
- iOS add-to-home-screen instructions and related web app meta tags.

Update lifecycle:
- Detect updates.
- Avoid forcing reload during active editing.
- Prompt before activating breaking updates.

### Step 5: Implement features safely
- Favor composable UI components.
- Keep state minimal and close to usage.
- Include empty/loading/error/offline states for every data view.
- Use lightweight validation only where needed.

If offline edit/create is required:
- Use IndexedDB for durable local data.
- Queue mutations with retry/backoff.
- Define and implement conflict policy (`last-write-wins` or merge UX).

### Step 6: Apply React Native Web polish when relevant
If app uses RN Web, read `references/rn-web-polish.md` and enforce:
- Web-tuned shadows, spacing, border rendering, and typography.
- Browser-appropriate motion and hover/focus feedback.
- Removal of native-only styling artifacts that degrade web quality.

### Step 7: Run quality gates
Ensure scripts exist and pass:
- `dev`, `build`, `preview`, `lint`, `typecheck`, `test`.
- `test:e2e` when app has navigation.

Minimum verification:
- 1 component unit test.
- 1 user-flow smoke test.
- 1 PWA behavior test (offline fallback or update path).
- 1 viewport/touch lock behavior test.

Performance targets (do not fake):
- Lighthouse Performance: 85+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 80+ for public-facing apps

### Step 8: Deliverables
Provide:
- Working app.
- Updated scripts and config.
- README with setup/run/build, offline behavior, install notes, update strategy, support matrix, and known tradeoffs.
- Definition of Done checklist.
- Brief implementation summary with extension guidance.

## Definition of Done Checklist

- Build passes.
- Lint/typecheck/tests pass.
- Offline behavior works as specified.
- Install behavior works on target platforms.
- Zoom, pinch, bounce, pull-to-refresh, and root drag/wobble are disabled as required.
- Viewport remains stable across mobile sizes and keyboard open/close.
- Keyboard navigation and focus treatment are correct.
- SW updates are safe and user-friendly.
- Caches exclude sensitive data.

## Safety and Security Defaults

- No analytics/tracking/fingerprinting unless requested.
- No secrets in client bundle.
- No token/auth payloads in cache storage.
- No external CDN for core runtime unless requested.
- Include CSP/deployment hardening notes when relevant.

## Execution Discipline

For each major step:
1. Implement in a small increment.
2. Run verification commands.
3. Summarize pass/fail.
4. Proceed only after success or explicitly documented risk.
