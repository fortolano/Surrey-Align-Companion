# CLAUDE.md — SurreyAlign PWA

> **Purpose**: Companion mobile PWA for SurreyAlign
> **Domain**: app.surreyalign.org
> **Relationship**: Separate app from the Blade web app at surreyalign.org

**Default working directory for all sessions:** `/var/www/app.surreyalign.org`

## PWA vs Web App (Required Session Context)

- **This repository is the companion PWA. It is mobile-first.**
- **The web app at `/var/www/surreyalign.org` is separate and desktop-first.**
- Shared APIs and shared data do **not** mean shared frontend rules.
- Do not apply Blade, Bootstrap, jQuery, or Laravel view assumptions here.
- Do not treat this app as a full visual mirror of the desktop site. It should support the mobile workflows it was built to support.

## Source Layout (Read Before Editing)

- Root-level files like `index.html`, `manifest.json`, `sw.js`, `_expo/`, and static images are hosting/build output concerns.
- The real source code lives in `/var/www/app.surreyalign.org/src/`.
- Main source areas:
  - `src/app/` for Expo Router screens and layouts
  - `src/components/` for shared screen components
  - `src/components/ui/` for reusable UI controls
  - `src/constants/` for tokens and shared UI values
  - `src/lib/` for API, auth, query, and client behavior
- Do not edit generated output, `node_modules`, or `dist` unless the task explicitly requires it.

## PWA UI Standard (Read Before Frontend Changes)

- Before changing screens, mobile layouts, headers, bottom tabs, forms, cards, install prompts, tokens, or shared UI components, read `/var/www/app.surreyalign.org/docs/pwa-ui-patterns.md`.
- Treat that file as the mobile design source of truth for this repo.
- Reuse the shared PWA components and token files named there before creating one-off patterns.
- If a pattern repeats, move it into shared UI instead of leaving it page-local.

## Agent Rules (Required)

- Re-read files immediately before editing.
- Read every relevant file fully enough to understand the real behavior.
- Do not use subagents.
- Do not silently simplify or skip required work.
- Verify every assumption against the current code.
- Never say something is done unless it is truly done.

## Product And UX Rules

- Build for phone-first use.
- Build for portrait phone use first, then wider mobile web second.
- Keep screens focused, fast to scan, and easy to act on.
- Prefer short flows, strong defaults, and minimal friction.
- Make the app feel close to a native phone app, not a compressed desktop page.
- Respect safe areas, standalone install mode, and browser-versus-PWA shell differences.
- Keep touch targets at least 44px, with primary buttons typically 48px to 52px tall.
- Favor one clear primary action per screen or section.
- Preserve immediate pressed states, clear loading states, and appropriate haptic feedback patterns.
- Preserve SurreyAlign’s calm and trustworthy tone.
- Keep ALIGN as a full methodology. Never reduce goals to one ALIGN letter.
- Prefer organization-level insight over people-ranking behavior.

## Stack

- Expo
- Expo Router
- TypeScript
- React Native
- React Native for Web
- React Query
- Express dev proxy and build scripts under `src/server/`

## Shared UI And Token Rules

Reuse existing building blocks before creating new ones.

Shared screen components:
- `src/components/ScreenHeader.tsx`
- `src/components/SkeletonCard.tsx`
- `src/components/AvatarMenu.tsx`
- `src/components/ErrorBoundary.tsx`

Shared UI controls:
- `src/components/ui/AppButton.tsx`
- `src/components/ui/AppActionButton.tsx`
- `src/components/ui/AppIconButton.tsx`
- `src/components/ui/AppInput.tsx`
- `src/components/ui/AppInteractiveChip.tsx`
- `src/components/ui/AppListRow.tsx`
- `src/components/ui/AppPickerTrigger.tsx`
- `src/components/ui/AppSegmentedControl.tsx`
- `src/components/ui/AppStatusBadge.tsx`

Shared tokens:
- `src/constants/colors.ts`
- `src/constants/layout.ts`
- `src/constants/ui.ts`
- `src/constants/status-colors.ts`

## API Rules

- Use the shared API layer under `src/lib/` before introducing new client-side request logic.
- Respect existing patterns in:
  - `src/lib/api.ts`
  - `src/lib/auth-context.tsx`
  - `src/lib/query-client.ts`
  - `src/lib/agenda-api.ts`
  - `src/lib/pulse-api.ts`
- If the app needs new backend behavior, add the proper endpoint in the SurreyAlign web app repo instead of pushing server logic into the PWA.
- Prefer complete server responses that fit React Query well.

## Verification

Run the checks that match the task:

```bash
cd /var/www/app.surreyalign.org/src && npm run lint
```

For logout/auth regression work:

```bash
cd /var/www/app.surreyalign.org/src && npm run e2e:logout:maestro
```

If you skip a relevant check, say so clearly.
