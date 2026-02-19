# SurreyAlign Companion App

## Overview

SurreyAlign is a private mobile companion app designed for volunteer church leaders (e.g., Stake Presidency, High Councilors, Bishops) within the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-Day Saints. Its primary purpose is to provide quick mobile access to leadership coordination tools, acting as a companion to the main surreyalign.org platform. The app reads from and writes to SurreyAlign via REST API endpoints, with surreyalign.org remaining the single source of truth for all data.

Key capabilities include:
- **Callings & Releases**: Full lifecycle management of callings, including listing with filters, creation, and role-adaptive detail views.
- **Sunday Business**: Tools for High Councilors and ward leaders to conduct releases and sustainings, tracking ward completion.
- **Goals & Execution**: Tracking stake and ward goals with progress indicators.
- **Upcoming Features**: High Council and Stake Council agenda management, personal assignment dashboards, and monthly progress check-in submissions.

The project's vision is to streamline administrative tasks for church leaders, allowing them to focus more on their ecclesiastical duties and less on manual coordination.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Principles

- **Entity-Centric Data Model**: All data (goals, progress indicators, actions) belongs to entities (organizations, councils, committees, wards), not individual users. Users access data based on their leadership roles (callings) within these entities.
- **Role-Based Access**: User access to information is dynamically determined by their callings and entity memberships, handled automatically by the API.

### Frontend - React Native (Expo)

- **Framework**: Expo SDK 54, utilizing `expo-router` for file-based routing.
- **Language**: TypeScript with strict mode.
- **UI/Styling**: Custom styling using React Native StyleSheet, a defined color system (`constants/colors.ts` with primary color `#016183`), and the Inter font family.
- **Animations**: `react-native-reanimated` for entrance animations.
- **State Management**: React Context for authentication (`lib/auth-context.tsx`) and TanStack React Query for server state management (`lib/query-client.ts`).
- **Authentication**: Users log in with their surreyalign.org credentials. Tokens and user data are persisted using `expo-secure-store` (native) and `@react-native-async-storage/async-storage` (web). The `AuthProvider` manages the full authentication lifecycle.
- **Feature Specifications**:
    - **Callings Module**: Includes a filterable list screen, a multi-section creation form with server-driven cascading dropdowns, and a detail screen with role-adaptive views (`Requestor`, `Monitor`, `Governance`). The detail screen features a dynamic `NextAction` banner and a `Sunday Business Gate` to manage gated steps.
    - **Sunday Business Module**: Provides a role-based UI (`high_councilor`, `ward_leader`, `stake_admin`) for managing releases and sustainings. It supports bundle grouping for related items, ward scoping, and bundle-aware completion.

### Backend - Express Server (API Proxy)

- **Framework**: Express 5 on Node.js.
- **Purpose**: Acts as a lightweight API proxy to `surreyalign.org` to bypass CORS restrictions for the frontend, and also serves static files.
- **Proxy Routes**: Handles authentication (login, logout, session validation) and forwards requests for goals, calling requests, and Sunday business data to the external SurreyAlign API.
- **CORS**: Configured dynamically based on environment variables.

### Database - PostgreSQL with Drizzle ORM

- **ORM**: Drizzle ORM.
- **Purpose**: Used for supplementary local data storage, primarily a `users` table. The main data source remains the external SurreyAlign.org API.

### Entity Types & Goal Management

- **Entity Types**: Stake, Ward/Branch, Organization, Council, Committee.
- **Goal Scopes**: Goals can be created at stake, ward, organization, or committee levels and cascade down the hierarchy.
- **Progress Indicators (PIs)**: PIs belong to entities and are of three types: Achieve (milestone), Growth (numeric increase), and Momentum (subjective assessment). Each PI can have associated Actions.
- **Planning Periods**: Goals are organized by planning periods (e.g., `period_id=7` for Annual 2026).

## External Dependencies

### SurreyAlign.org API

- **Base URL**: `https://surreyalign.org/api/external/v1`
- **Purpose**: The authoritative source for all application data.
- **Authentication**: Bearer token obtained via email/password login. All API interactions are proxied through the Express server.
- **Test Credentials**: `ana@ortolanos.com` / `12345678` (Relief Society Second Counselor, Surrey 4th Ward - limited goal visibility).

### Key NPM Dependencies

- `expo`, `expo-router`: Core framework and navigation.
- `expo-secure-store`, `@react-native-async-storage/async-storage`: Secure storage and fallback.
- `@tanstack/react-query`: Server state management.
- `express`: Backend server framework.
- `drizzle-orm`, `drizzle-zod`, `pg`: Database ORM and PostgreSQL client.
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `expo-haptics`: UI and interaction components.