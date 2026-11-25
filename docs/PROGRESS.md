# Mistri delivery progress

## Current phase

**Phase 7 — implemented locally: live job updates, push delivery, private chat, and reviews.**
Live Supabase/API and native-device acceptance checks remain external setup work.

### Completed

- Created the npm-workspaces monorepo folders: `backend`, `mobile`, `admin`, `docs`,
  and `docker`.
- Added a Postgres 16 + PostGIS 3.4 Docker Compose service with a health check,
  persistent named volume, and automatic PostGIS initialization.
- Added the NestJS API foundation with environment validation, strict global request
  validation, CORS configuration, Swagger at `/docs`, and `GET /health`.
- Added a TypeORM-based `db:check` command that confirms a local PostGIS connection.
- Added root/backend formatting, linting, build, and health-unit-test configuration.
- Added `.env.example` templates and READMEs for every current folder.
- Installed the npm dependency tree and committed its exact resolved versions to
  `package-lock.json`.
- Verified formatting, linting, the health unit test, and the production backend build.
- Started Docker Desktop, downloaded the PostGIS image, and verified the container is
  healthy on host port `5433`.
- Verified `GET /health` returns HTTP 200, Swagger is available at `/docs`, and the
  TypeORM probe reports PostGIS 3.4.

### Phase 2 completed locally

- Added a versioned `users` table migration with `customer`, `mechanic`, and `admin`
  roles, plus user email and phone profile fields.
- Connected the NestJS API to TypeORM and applied the migration to local Postgres.
- Added Supabase JWT verification through its public JWKS endpoint and bearer-token
  guard protection for `GET /auth/me`.
- Added server-side role authorization with an admin-only example endpoint. Clients
  cannot self-assign roles; newly verified users default to `customer`.
- Added unit tests for bearer-token enforcement, JWT audience/signature validation, and
  customer rejection on an admin-only route.
- Added [SUPABASE_SETUP.md](SUPABASE_SETUP.md) with exact free-tier project, email, and
  Google OAuth setup instructions.

### External configuration still required

- Create the Supabase project and configure `backend/.env` with its database connection
  URL and project URL.
- Enable the Email and Google auth providers in your own Supabase/Google accounts. These
  provider accounts and secrets cannot be created or handled by the codebase.

### Phase 3 completed locally

- Added a versioned `mechanics` migration with a one-to-one user profile, online status,
  service types, and a latest-location-only PostGIS geography point.
- Added protected mechanic profile, online/offline, and location-update endpoints. Going
  offline clears the saved location; updates require at least 15 seconds and 50 metres of
  movement.
- Added `GET /mechanics/nearby`, which only returns online mechanics with a current
  location, searches with `ST_DWithin`, and orders results by spatial distance.
- Added unit coverage for profile creation, presence and location privacy, location-update
  constraints, and nearby result mapping.

### Phase 4 completed locally

- Added customer-owned vehicles with validated create, list, read, and update endpoints.
- Added vehicle and service-request migrations, including a geospatial pickup point and indexes
  for customer, mechanic, and open-request lookup patterns.
- Added protected customer request creation and listing; requests may only use a vehicle owned by
  the signed-in customer.
- Added an atomic online-mechanic acceptance flow and server-owned mechanic transitions:
  `open → assigned → en_route → arrived → in_progress → completed`.
- Added customer-only cancellation while a request is still open and cash-payment confirmation
  after completion (`completed → paid`).
- Kept pickup coordinates and vehicle registration details visible only to the request customer
  and assigned mechanic. Mechanics browsing open work receive a privacy-safe summary.
- Added unit coverage for vehicle ownership, request ownership, online acceptance, lifecycle
  transitions, cash payment confirmation, and pickup-detail privacy.

### Phase 5 delivered locally

- Added the Expo SDK 58 workspace with Expo Router, mobile lint/tests/typecheck,
  production web export, and public environment-variable template.
- Added typed English/Bangla translation keys, device-language selection, English
  fallback, an in-app toggle, and accessible loading/error controls.
- Added email/password sign-in and account creation behind validated public
  configuration, native SecureStore session persistence, foreground token refresh,
  bearer-token API requests, session expiry recovery, and customer role gating.
  Web sessions remain in memory and require sign-in after reload.
- Added customer vehicle listing/creation, owned-vehicle selection, service input
  validation, explicit foreground pickup acquisition, and request submission.
  Leaving the request form discards coordinates and invalidates pending acquisition.
- Added request status and private expanded details, explicit refresh, and confirmed
  cancellation/payment actions restricted to the API-supported statuses.
- Added regression coverage for HTTP/auth boundaries, malformed responses, oversized
  secure sessions, location races/denial, form limits, and request-detail privacy.
- Expo native configuration introspection confirms foreground location only, without
  background or foreground-service location permissions or unused iOS Always/motion
  declarations.
- The customer sections use local navigation within one Expo Router route. Request
  deep links, Google OAuth, maps, push notifications, and mechanic UI remain deferred.
- Final checks passed: 30 backend tests, 39 mobile tests, root lint and formatting,
  mobile typecheck, and production web export. Isolated Edge checks confirmed the
  English/Bangla setup flow, no console errors, and no overflow at 320px and 390px.
- Reconciled React and React DOM to Expo-compatible version 19.3.0 and updated the
  dependency lockfile.

### Phase 5 external acceptance checks

- Supply the Supabase public values and a reachable API configured for that project;
  enable email authentication and verify account confirmation, sign-in, and sign-out.
- Walk through vehicles, permission denial/retry, request creation, refreshed status,
  and customer actions against the live API in English and Bangla.
- Verify native SecureStore restoration and the actual foreground-permission prompt
  on a physical device. Web export and mocked component tests cannot establish these.
- Follow [mobile/README.md](../mobile/README.md) for setup and the device checklist.

### Phase 6 delivered locally

- Added 15-minute stale-location expiry to `MechanicsService.findNearby`, aligned the
  `POST /service-requests/:requestId/cancel` Swagger summary with the open-only rule, and
  added the local `npm run db:set-role --workspace=backend -- <email> <role>` helper for
  controlled test role provisioning.
- Installed SDK 58 compatible `react-native-maps` and `expo-task-manager` and enabled
  native background location + Android foreground service in `mobile/app.json`.
- Extended `mobile/src/api.ts` with explicit `PUT`/`PATCH` support and runtime guards for
  mechanic profiles, nearby mechanics, location updates, and privacy-safe available jobs.
- Added the swappable `MapProvider` (`mobile/src/map/map-provider.native.tsx` using
  `react-native-maps` and `mobile/src/map/map-provider.tsx` web/list fallback).
- Added customer **Nearby mechanics** discovery (`GET /mechanics/nearby`) with map search
  area and distance-only mechanic cards.
- Added the bilingual mechanic workflow (`mobile/src/mechanic.tsx`,
  `mobile/src/mechanic-location.ts`): profile setup/editing, online/offline toggle,
  foreground and background location tracking (15 s / 50 m policy; stopped before going
  offline or signing out), available-job acceptance with `409` conflict recovery, and
  assigned-job private pickup map + confirmed lifecycle transitions.
- Updated `mobile/src/account.tsx` to route verified `customer` and `mechanic` accounts
  separately while keeping `admin`/unknown roles blocked.
- Review fixes keep assigned jobs accessible while offline, bind API calls and background
  tracking to their initiating account, and prevent ambiguous email matches in role provisioning.
- Local checks passed: 30 backend and 47 mobile tests, lint, formatting, mobile typecheck,
  backend build, and mobile web export. Android map key injection was verified with a dummy
  value. Live map rendering, background tracking, and a two-account job remain device checks.

### Phase 7 implemented locally

- Added authenticated job invalidations and a PostgreSQL outbox. Job state and its
  event commit together. The app reloads authorized state on events and reconnect.
- Added opt-in Expo notifications with queued retries and ticket/receipt handling.
- Added private, retry-safe chat with reporting and read-only completed conversations.
- Added one review per eligible customer job and rating aggregates in mechanic discovery.
- Verified 38 backend tests, including five on an isolated PostgreSQL/PostGIS database,
  and 50 mobile tests. Lint, formatting, mobile typecheck, backend build, and web export passed.
- See [the Phase 7 notes](PHASE_7_SPEC.md) for migration, credential setup, and device checks.

## Next phase

Complete the live Supabase/API and physical-device acceptance checks for Phases 5–7,
including live push delivery. Phase 8 introduces quoting and wallet accounting.

## Known issues

- Mistri uses host port `5433` because an unrelated local PostgreSQL process owns
  port `5432`. The Docker container's internal database port remains `5432`.
- Docker Desktop's command-line folder was added to the Windows user PATH. A newly
  opened terminal is needed before the `docker` command becomes available by name.
- `npm audit --omit=dev` reports three moderate advisories through TypeORM 0.3.31's
  `glob`/`minimatch` chain. The offered remediation is a breaking TypeORM 1.1 upgrade;
  do not run `npm audit fix --force`. Review that upgrade deliberately during Phase 10.
