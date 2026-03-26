# E2E Regression Flows

## Playwright

Preferred for:
- browser-level regression tests against the Expo web/PWA build
- navigation and back-button flows
- mobile-sized viewport checks
- interactive UI debugging from Codex

Config:
- `playwright.config.ts`
- tests live under `e2e/playwright/`

Current coverage:
- `e2e/playwright/login-shell.spec.ts`
  Verifies the public login shell renders.
- `e2e/playwright/navigation-back.spec.ts`
  Verifies the shared route back button returns to the logical parent flow for key mobile paths, using a mocked signed-in browser session and deterministic fixture data.
- `e2e/playwright/sunday-business-leave-reminder.spec.ts`
  Verifies the Sunday Business leave reminder appears on real exit attempts and that `Stay on Page`, `Leave Anyway`, and `Mark All Now` behave correctly.
- `e2e/playwright/mobile-shell-visual.spec.ts`
  Verifies the shared mobile shell stays visually stable for Home, More, Callings, Sunday Business, and a pushed route screen using committed baseline screenshots.
- `e2e/playwright/detail-screens-and-modal-states.spec.ts`
  Verifies high-risk detail screens remain stable and that Notifications and Settings preserve key browser behaviors.

Required environment for authenticated tests:
```bash
export PWA_E2E_EMAIL="your-test-user@example.com"
export PWA_E2E_PASSWORD="your-password"
```

Notes on auth posture:
- `navigation-back.spec.ts` does not need live credentials. It seeds web auth state locally and mocks the `/api/...` responses needed for stable navigation regression coverage.
- `support/auth.ts` is still available for future live-account Playwright specs when we intentionally want to exercise real authentication and production-like data.

Useful commands:
```bash
npm run e2e:playwright:list
npm run e2e:playwright
npm run e2e:playwright:headed
npx playwright test e2e/playwright/mobile-shell-visual.spec.ts --update-snapshots
```

How local Playwright runs work here:
1. `npm run e2e:playwright:prepare` exports the web bundle into `dist/` and builds the Express server.
2. Playwright starts the local server on `http://127.0.0.1:4173` by default.
3. The tests drive the local browser-served PWA, not a native app shell.

Optional overrides:
```bash
export PWA_E2E_BASE_URL="https://app.surreyalign.org"
export PWA_E2E_PORT="4173"
```

Use `PWA_E2E_BASE_URL` when you want to point Playwright at an already-running environment instead of starting the local server.

## Maestro

File:
- `e2e/maestro/logout-regression.yaml`

Current posture:
- retained for true device/native verification when needed
- not the primary browser regression path for this PWA

Legacy purpose:
- reproduced and guarded the critical auth bug where logout did not return users to login
