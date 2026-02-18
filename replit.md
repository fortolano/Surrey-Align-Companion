# SurreyAlign Companion App

## Overview

SurreyAlign is a private mobile companion app for the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-Day Saints. It provides ~50-80 volunteer church leaders (Stake Presidency, High Councilors, Bishops, Relief Society Presidents, etc.) with quick mobile access to leadership coordination tools during in-person meetings and on the go.

The app is a **companion** to the main platform at surreyalign.org — it does NOT replace the website. SurreyAlign.org remains the single source of truth for all data. The mobile app reads from and writes to SurreyAlign via REST API endpoints.

Current feature tiles (most marked "coming soon"):
- **Callings & Releases** — Browse current callings by ward/organization
- **High Council Agenda** — View/manage High Council meeting agendas
- **Stake Council Agenda** — View/manage Stake Council meeting agendas
- **My Assignments** — Personal task dashboard with deadlines and progress
- **ALIGN Pulse** — Monthly progress check-in submissions

## User Preferences

Preferred communication style: Simple, everyday language.

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
- The app calls `https://surreyalign.org/api/external/v1` to validate credentials and receive a bearer token
- Tokens and user data are persisted using `expo-secure-store` on native platforms and `@react-native-async-storage/async-storage` on web
- The `AuthProvider` in `lib/auth-context.tsx` manages the full auth lifecycle (login, logout, token restoration)
- User profile data (name, email, calling, ward, stake, admin flags) is cached locally from the SurreyAlign API response

### Backend — Express Server

- **Framework**: Express 5 running on Node.js
- **Purpose**: Serves as a lightweight API proxy and static file server. The server is intentionally thin since surreyalign.org is the data source of truth.
- **Routes**: Defined in `server/routes.ts` — currently minimal, prefixed with `/api`
- **Storage**: `server/storage.ts` has an in-memory storage implementation (`MemStorage`) with a basic user CRUD interface. This is a local abstraction, not the primary data store.
- **CORS**: Configured dynamically based on Replit domain environment variables and localhost origins for development
- **Build**: Server is bundled with esbuild for production (`server_dist/`)

### Database — PostgreSQL with Drizzle ORM

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — currently has a `users` table with `id` (UUID), `username`, and `password` fields
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Output to `./migrations` directory, managed via `drizzle-kit push`
- **Connection**: Uses `DATABASE_URL` environment variable
- **Note**: The local database is supplementary. The primary data source is the SurreyAlign.org external API.

### Build & Deployment

- **Development**: Two processes run concurrently — `expo:dev` for the mobile app and `server:dev` for the Express backend
- **Production**: Static web build via custom `scripts/build.js`, server bundled with esbuild
- **Platform Support**: iOS, Android, and Web. The app uses `Platform.OS` checks for platform-specific behavior (e.g., web bottom insets, secure storage fallbacks)
- **Patches**: Uses `patch-package` (postinstall script)

## External Dependencies

### SurreyAlign.org API
- **Base URL**: `https://surreyalign.org/api/external/v1`
- **Purpose**: Single source of truth for all app data — authentication, user profiles, agendas, assignments, callings, and pulse check-ins
- **Auth Method**: Email/password login returns a bearer token used for subsequent API calls

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM for schema definition and queries
- Uses `drizzle-kit` for schema management (`npm run db:push`)

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