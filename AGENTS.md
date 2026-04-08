# AGENTS.md — SurreyAlign PWA

This folder is the separate SurreyAlign companion PWA at `app.surreyalign.org`. It is a mobile-first Expo and React Native for Web app. It is not the Blade web app, even though it shares data and APIs with `surreyalign.org`.

**Default working directory for PWA sessions:** `/var/www/app.surreyalign.org`

## PWA vs Web App (Required Session Context)

- **This repository is the companion PWA.** Default to mobile-first decisions here.
- **Do not import Blade, Bootstrap, jQuery, or Laravel view assumptions** into this app.
- The SurreyAlign web app at `/var/www/surreyalign.org` is a separate desktop-first product.
- Shared APIs and shared database access do **not** make the two frontends one app.
- Keep the boundary clear:
  - PWA owns quick mobile workflows, focused updates, mobile approvals, notifications, and simple follow-through.
  - Web app owns broader desktop workflows, denser oversight views, and Blade-based admin structure.

## Source Of Truth For Code Location

- Treat `/var/www/app.surreyalign.org/` as the app root for sessions started here.
- Treat `/var/www/app.surreyalign.org/src/` as the real source tree for code edits.
- The top-level root contains built output and hosting files such as `index.html`, `manifest.json`, `sw.js`, `_expo/`, and static assets.
- **Do not edit built output files by default.** Only touch root-level built files when the task is specifically about deployment output, hosting behavior, manifest/service worker behavior, or static asset delivery.

## Deployment Domain And Production Build (Required For PWA Deploys)

- The canonical production PWA domain is `app.surreyalign.org`.
- Shells on this machine should expose both `SURREYALIGN_PWA_DEPLOY_DOMAIN=app.surreyalign.org` and `EXPO_PUBLIC_DOMAIN=app.surreyalign.org`.
- The correct production deploy build command is:
  - `cd /var/www/app.surreyalign.org/src && npm run expo:static:build`
- That command builds the PWA web export and syncs the generated deployment files back into `/var/www/app.surreyalign.org/`.
- Do not hand-edit root deployment output files as a substitute for running the build.

## UI Pattern Source Of Truth (Required For PWA Frontend Work)

- Before changing any screen, component, token, navigation shell, form flow, tab bar, header, install prompt, or mobile layout behavior, read `docs/pwa-ui-patterns.md`.
- Treat `docs/pwa-ui-patterns.md` as the live mobile design standard for this repo.
- Reuse the shared PWA components and tokens named in that document before inventing new patterns.
- If a mobile pattern is needed in more than one place, move toward a shared component or shared token instead of page-level styling drift.

## Agent Execution Policy (Strict)

- Do not instruct the user on what to do; explain what you will do next.
- You are responsible for executing commands, fixes, and changes the user requests.
- Use clear, decisive language; avoid hedging or soft prompts.
- Avoid optional suggestions; only ask for input when it is required to proceed.
- Re-read the file immediately before every edit; never use stale context.
- Read every file relevant to the task. If you have not read it, do not edit it.
- Do not use subagents.
- Do not silently simplify or cut scope.
- Never claim you verified something you did not verify.

## Communication And Reporting Rules (Strict)

- Be explicit and unambiguous in close-out summaries.
- Always distinguish between these categories:
  - `What Changed`: work completed in the current turn
  - `What Still Remains`: required in-scope work that is unfinished, blocked, or intentionally deferred
  - `What Is Blocked`: only items that cannot currently be completed because of a real blocker
  - `Optional Future Work`: follow-on work that is outside the just-finished scope
- Do not mix future recommendations into `What Still Remains`.
- If no required in-scope work remains, say that explicitly.
- If no required in-scope work remains, do not present optional future work as a recommendation, requirement, or implied continuation of the current task.
- If `What Still Remains` is present, omit `Optional Future Work`.
- Do not present required remaining work and optional future work in the same close-out.
- Do not include `Optional Future Work` in a normal task close-out unless the user explicitly asked what is next, asked for suggestions, or asked for follow-on planning.
- When the user asks “what is next?” and required work remains, answer with the required next work only. Do not include optional future work until the required scope is complete.
- When the user asks “what is next?” and no required work remains, answer directly with a prioritized next-step list and one clear recommendation, but make clear that it is optional future work rather than unfinished scope.
- Do not make the user infer whether something is unfinished, optional, blocked, or simply recommended for later.
- If verification was partial, say exactly what was verified and what was not.

## Product Direction

- This PWA exists for selected mobile workflows, not as a full copy of the web app.
- Keep the UI calm, clear, and lightweight.
- Prefer focused screens, fast scanning, and obvious next actions.
- Keep the app feeling close to a native phone app, not a shrunk desktop site.
- Keep ALIGN as a full methodology. Never reduce goals to a single ALIGN category selector.
- Prefer organizational patterns over individual ranking or surveillance.

## Tech Stack

- **Framework:** Expo with Expo Router
- **Language:** TypeScript
- **UI:** React Native with React Native for Web
- **Data:** React Query (`@tanstack/react-query`)
- **Server/dev proxy:** Express and TypeScript under `src/server/`
- **Mobile platform posture:** portrait, phone-first

Key files and folders:

- `src/package.json`
- `src/app/`
- `src/components/`
- `src/components/ui/`
- `src/constants/colors.ts`
- `src/constants/layout.ts`
- `src/constants/status-colors.ts`
- `src/constants/ui.ts`
- `src/lib/api.ts`
- `src/lib/auth-context.tsx`
- `src/lib/query-client.ts`
- `src/e2e/README.md`

## Design And UX Rules

- Mobile-first by default.
- Phone-first and portrait-first by default.
- Design for iPhone-sized and Android phone portrait screens before wider web layouts.
- Keep primary actions within comfortable reach and visually obvious.
- Prefer compact, focused flows over dense multi-purpose screens.
- Respect safe areas, browser-vs-standalone differences, and install-mode behavior.
- Keep touch targets at least 44px and primary buttons generally 48px to 52px tall.
- Keep one clear primary action per screen or section when possible.
- Preserve native-feeling feedback such as pressed states, loading states, and appropriate haptics.
- Do not import desktop-web habits such as crowded toolbars, multi-column forms, or stacked competing actions.
- Reuse the shared PWA components before creating new ones:
  - `src/components/ScreenHeader.tsx`
  - `src/components/SkeletonCard.tsx`
  - `src/components/AvatarMenu.tsx`
  - `src/components/ui/AppButton.tsx`
  - `src/components/ui/AppActionButton.tsx`
  - `src/components/ui/AppIconButton.tsx`
  - `src/components/ui/AppInput.tsx`
  - `src/components/ui/AppInteractiveChip.tsx`
  - `src/components/ui/AppListRow.tsx`
  - `src/components/ui/AppPickerTrigger.tsx`
  - `src/components/ui/AppSegmentedControl.tsx`
  - `src/components/ui/AppStatusBadge.tsx`
- Reuse the token files before inventing colors, spacing, or radii:
  - `src/constants/colors.ts`
  - `src/constants/layout.ts`
  - `src/constants/ui.ts`
  - `src/constants/status-colors.ts`
- Preserve clear success, error, loading, empty, and disabled states.

## API And Data Rules

- The PWA consumes SurreyAlign APIs. Do not recreate business logic in the client when the server should own it.
- Use the shared API layer under `src/lib/` before adding new fetch logic.
- Prefer complete single-call responses over chained client-side fetch flows when designing new API-backed features.
- Respect existing auth and query patterns in:
  - `src/lib/api.ts`
  - `src/lib/auth-context.tsx`
  - `src/lib/query-client.ts`
- If a feature needs server support that does not exist, implement the endpoint in the web app repo rather than faking data flow here.

## Editing Rules

- Preserve Expo Router structure under `src/app/`.
- Preserve typed routes and strict TypeScript.
- Follow existing component patterns before introducing new abstractions.
- Do not edit generated or vendored content under `src/node_modules/`, `src/dist/`, `.expo/`, or top-level `_expo/`.
- Keep new files group-readable.

## Verification After Changes

After changes in this PWA, run the checks that match the task:

```bash
cd /var/www/app.surreyalign.org/src && npm run lint
```

For meaningful PWA runtime changes, also run the real authenticated Playwright smoke test:

```bash
cd /var/www/app.surreyalign.org/src && npm run e2e:playwright:live-smoke
```

Use the permanent SurreyAlign browser-test accounts from `/home/webadmin/.codex/memories/surreyalign-test-credentials.md`.
Do not copy those credentials into the repo.
The default live Playwright account is the stake test account unless `PWA_E2E_ACCOUNT` is set to `ward` or `branch`.

If the task touches auth or logout flow, also use the existing regression reference:

```bash
cd /var/www/app.surreyalign.org/src && npm run e2e:logout:maestro
```

If you do not run a relevant check, say so clearly.
