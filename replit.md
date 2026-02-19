# SurreyAlign Companion App

## Overview

SurreyAlign is a private mobile companion app for the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-Day Saints. It provides ~50-80 volunteer church leaders (Stake Presidency, High Councilors, Bishops, Relief Society Presidents, etc.) with quick mobile access to leadership coordination tools during in-person meetings and on the go.

The app is a **companion** to the main platform at surreyalign.org — it does NOT replace the website. SurreyAlign.org remains the single source of truth for all data. The mobile app reads from and writes to SurreyAlign via REST API endpoints.

Current feature tiles:
- **Callings & Releases** — Full lifecycle management: list with filters, create form, detail with role-adaptive views (LIVE)
- **Sunday Business** — High Councilors conduct releases/sustainings in wards, track ward completion (LIVE)
- **High Council Agenda** — View/manage High Council meeting agendas (coming soon)
- **Stake Council Agenda** — View/manage Stake Council meeting agendas (coming soon)
- **My Assignments** — Personal task dashboard with deadlines and progress (coming soon)
- **Goals & Execution** — Track stake and ward goals with progress indicators (LIVE)
- **ALIGN Pulse** — Monthly progress check-in submissions (coming soon)

## User Preferences

Preferred communication style: Simple, everyday language.

## SurreyAlign Data Model — Entity-Centric Architecture

### Critical Concept: Everything is Entity-Scoped, NOT User-Scoped

SurreyAlign does NOT work like a personal todo app. Goals, boards, progress indicators, and actions all belong to **entities** — organizations, councils, committees, and wards. Users access them based on their leadership roles (callings) within those entities.

A user doesn't "own" goals; their organization has goals. A user doesn't have progress indicators; their entity's board has progress indicators. The user is a window into entity-scoped data, not the owner of it. The API automatically resolves entity access based on the authenticated user's callings.

### Entity Types

| Entity Type  | What It Is | Examples |
|---|---|---|
| Stake | Top-level geographic unit | Surrey British Columbia Stake |
| Ward/Branch | Local congregation within the stake | Surrey 1st, Brookswood, White Rock, Richmond 2nd |
| Organization | Functional group within a ward or at stake level | Surrey 4th Relief Society, Stake Primary |
| Council | Governance body that reviews/approves goals | Stake Council, Ward Council, High Council |
| Committee | Cross-cutting working group under a council | Stake Missionary Committee, Youth Leadership Committee |

Structure: 1 Stake → 8 Wards → ~64 ward orgs + 6 stake orgs = 70 organizations, 13 councils + 10 committees = 23 councils/committees.

### How Goals Work

Goals are created at one of four scopes: stake, ward, organization, committee. They cascade DOWN the hierarchy — a single stake goal may be visible to 95 different entities. Each entity responds independently by creating their own Progress Indicators on their execution board.

- **Stake goals**: Created by Stake Presidency, approved by Stake Council vote, then released to wards
- **Ward goals**: Created by Bishop, approved by Ward Council
- **Organization/Committee goals**: Created by leader, auto-approved

### Progress Indicators (PIs)

PIs belong to entities, not users. Three types:
- **Achieve (milestone)**: Binary done/not done (e.g., "Temple prep class launched")
- **Growth (increase)**: Numeric start → target (e.g., "Families with temple plans: 0 → 20")
- **Momentum**: Subjective 0-100% assessment (e.g., "Ministering quality")

Each PI can have up to 3 per entity per goal. Each PI has Actions — concrete tasks that drive it forward.

### User Access Model (Role-Based)

Users see goals based on entity membership through their callings:
- **Stake President**: Sees ALL goals
- **High Councilor** (with assigned wards/stewardships): Sees goals for assigned entities
- **Bishop**: Sees stake goals released to their ward + ward-level goals
- **Org President** (e.g., RS President): Sees goals assigned to their organization

The API handles access automatically — `GET /goals` returns only goals the authenticated user should see based on their bearer token.

### Planning Periods

Goals belong to planning periods (cycles). The API defaults to the current cycle. The current active period is **period_id=7 (Annual 2026)**. If no goals appear, the user may need to select a different period.

### Execution Endpoint Auto-Summary

If `GET /goals/{id}/execution` returns `meta.includes_actions: false`, there were >15 entities and the response was auto-summarized. The app shows summary view and lets users tap into a specific entity for full detail using `?entity_type=organization&entity_id=17`.

## System Architecture

### Frontend — React Native (Expo)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Language**: TypeScript with strict mode
- **Navigation**: File-based routing via expo-router. The `app/` directory defines all screens. The root `index.tsx` is the login screen, `home.tsx` is the main dashboard with feature tiles, and each feature has its own screen file.
- **UI/Styling**: React Native StyleSheet (no component library). Uses a custom color system defined in `constants/colors.ts` with the brand primary color `#016183`. Inter font family loaded via `@expo-google-fonts/inter`.
- **Animations**: react-native-reanimated for entrance animations (FadeIn, FadeInDown)
- **State Management**: React Context for auth (`lib/auth-context.tsx`), TanStack React Query for server state (`lib/query-client.ts`)
- **Keyboard Handling**: react-native-keyboard-controller with a cross-platform wrapper component
- **Path Aliases**: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

### Authentication

- Users log in with the same email/password credentials they use on surreyalign.org
- The app calls the Express proxy which forwards to `https://surreyalign.org/api/external/v1`
- Tokens and user data are persisted using `expo-secure-store` on native platforms and `@react-native-async-storage/async-storage` on web
- The `AuthProvider` in `lib/auth-context.tsx` manages the full auth lifecycle (login, logout, token restoration)
- User profile data (name, email, calling, ward, stake, admin flags) is cached locally from the SurreyAlign API response

### Backend — Express Server (API Proxy)

- **Framework**: Express 5 running on Node.js
- **Purpose**: Serves as a lightweight API proxy to SurreyAlign.org (avoids CORS issues from browser) and static file server. The server is intentionally thin.
- **Proxy Routes** in `server/routes.ts`:
  - `POST /api/auth/login` → forwards to SurreyAlign login
  - `GET /api/auth/me` → validates session
  - `POST /api/auth/logout` → ends session
  - `GET /api/goals` → list goals (supports scope, status, period_id query params)
  - `GET /api/goals/:goalId/execution` → goal execution detail (supports entity_type, entity_id, summary params)
- **CORS**: Configured dynamically based on Replit domain environment variables and localhost origins. Allows `Content-Type` and `Authorization` headers.

### Database — PostgreSQL with Drizzle ORM

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — currently has a `users` table (supplementary, not primary data store)
- **Note**: The local database is supplementary. The primary data source is the SurreyAlign.org external API.

### Build & Deployment

- **Development**: Two processes run concurrently — `expo:dev` for the mobile app (port 8081) and `server:dev` for the Express backend (port 5000)
- **Production**: Static web build via custom `scripts/build.js`, server bundled with esbuild
- **Platform Support**: iOS, Android, and Web

## External Dependencies

### SurreyAlign.org API
- **Base URL**: `https://surreyalign.org/api/external/v1`
- **Purpose**: Single source of truth for all app data
- **Auth Method**: Email/password login returns a bearer token used for subsequent API calls
- **All API calls route through Express proxy** to avoid browser CORS restrictions

### Test Credentials
- Email: `ana@ortolanos.com` / Password: `12345678`
- Returns: Ana C. Ortolano, Relief Society Second Counselor, Surrey 4th Ward
- Note: Ward-level counselor — may have limited goal visibility

### Key NPM Dependencies
- `expo` (~54.0.27) — Core framework
- `expo-router` (~6.0.17) — File-based navigation
- `expo-secure-store` — Secure credential storage on native
- `@react-native-async-storage/async-storage` — Storage fallback for web
- `@tanstack/react-query` — Server state management
- `express` (^5.0.1) — Backend server
- `drizzle-orm` / `drizzle-zod` — Database ORM and validation
- `pg` — PostgreSQL client
- `react-native-reanimated` — Animations
- `react-native-gesture-handler` — Gesture support
- `react-native-safe-area-context` — Safe area handling
- `expo-haptics` — Haptic feedback on native

### Callings Module

The Callings module manages the full calling lifecycle from mobile. Three screens:

1. **List** (`app/callings.tsx`): Filterable list with status/scope/mine-only filters, pending action count banner, pull-to-refresh. Cards show calling name, ward/org, individuals, status badge, scope chip, relative time, and progress bar for in-progress requests.

2. **Create** (`app/calling-create.tsx`): Multi-section form with server-driven cascading dropdowns. Scope → Ward → Calling → Organization → Current Holder (auto-detected). Up to 3 individuals. Save as Draft or Submit for Review.

3. **Detail** (`app/calling-detail.tsx`): Role-adaptive view based on `view_level` and `is_requestor_only`:
   - Requestor: overview, individuals with recommendations, status timeline, progress
   - Monitor: overview, individuals without recommendations
   - Governance (full/presidency/ward_authority/voter): tabbed interface with Discussion, Approvals (HC voting), Required Steps

Proxy endpoints in `server/routes.ts` cover all CRUD, reference data, and lifecycle action endpoints.

Shared API helper in `lib/api.ts` for authenticated fetches with token.

LDS terminology: "Individual(s) Prayerfully Considered" (not nominees), "Approvals" (not voting), "Under Prayerful Review" (requestor view), "Under Consideration" (governance view), "Calling" (not position).

## Recent Changes

- 2026-02-19: Renamed "Sunday Business" to "Stake Business" across tile, header, and screen title
- 2026-02-19: Added New/Outstanding badge indicators to Stake Business home tile (New = <7 days, Outstanding = >7 days with incomplete wards)
- 2026-02-19: Added Stake Business feature: ward selector, grouped release/sustaining cards with script text, progress tracking, mark-as-conducted workflow
- 2026-02-19: Added Stake Business proxy endpoints (GET /sunday, GET /outstanding, GET /:id, POST /:id/complete-ward)
- 2026-02-19: Added Callings module: list, create, and detail screens with role-adaptive views
- 2026-02-19: Added proxy endpoints for all calling-request and reference data APIs
- 2026-02-19: Added shared `lib/api.ts` helper for authenticated API calls
- 2026-02-18: Added Goals & Execution feature (goals list with scope filters, goal detail with entity-grouped PIs and actions)
- 2026-02-18: Added Goals proxy endpoints (`/api/goals`, `/api/goals/:goalId/execution`)
- 2026-02-18: Fixed CORS to allow Authorization header in preflight
- 2026-02-18: Updated goals UI to reflect entity-centric model (goals belong to entities, not individuals)
- 2026-02-18: Added ALIGN, Settings, About, Terms of Service informational screens
- 2026-02-18: Implemented Express proxy for all auth API calls to avoid CORS
- 2026-02-18: Added dropdown menu on home screen (Profile, ALIGN, Settings, About, TOS, Sign Out)
