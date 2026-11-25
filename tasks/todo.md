# Phase 5 task list

## Task 1: Create the Expo mobile workspace — completed

**Description:** Establish the TypeScript Expo SDK 58 workspace, Expo Router entry
configuration, lint/test/typecheck/build scripts, and ignored mobile environment
template.

**Acceptance criteria:**

- [x] `mobile` is a valid npm workspace with Expo Router and TypeScript configured.
- [x] No `.env` or credential is tracked; `.env.example` documents public variables.
- [x] Lint, test, typecheck, and web-export/build commands are defined.

**Verification:**

- [x] Focused workspace checks pass.
- [x] The app starts without configuration secrets.

**Dependencies:** None

**Files likely touched:** `mobile/package.json`, `mobile/app.json`,
`mobile/tsconfig.json`, `mobile/app/_layout.tsx`, `mobile/.env.example`

**Estimated scope:** Medium

## Task 2: Add localization and shared accessible UI primitives — completed locally

**Description:** Add English/Bangla translations, language selection, and focused
layout/text/button/form-status primitives used by the Phase 5 screens.

**Acceptance criteria:**

- [x] Customer-facing strings use translation keys.
- [x] The app falls back safely to English.
- [x] Shared states expose loading and error text accessibly.

**Verification:**

- [x] Localization tests cover English, Bangla, and fallback behavior.
- [x] Lint and typecheck pass.

**Dependencies:** Task 1

**Files likely touched:** `mobile/src/i18n/*`, `mobile/src/components/*`,
`mobile/app/_layout.tsx`, localization tests

**Estimated scope:** Medium

## Task 3: Add session-aware API client and app shell — completed locally

**Description:** Implement configuration validation, Supabase session boundary,
authorized API requests, API-error mapping, and navigation states for unconfigured,
signed-out, and customer sessions.

**Acceptance criteria:**

- [x] Every protected request uses a bearer token from the session boundary.
- [x] Missing configuration and unauthorized API responses are recoverable states.
- [x] A non-customer profile cannot enter customer routes.

**Verification:**

- [x] API-client tests cover headers, error mapping, and unauthorized handling.
- [x] Typecheck, lint, and production export/build pass.

**Dependencies:** Tasks 1–2

**Files likely touched:** `mobile/src/config/*`, `mobile/src/auth/*`,
`mobile/src/api/*`, `mobile/app/*`, API-client tests

**Estimated scope:** Medium

## Checkpoint: Foundation

- [x] Mobile lint, tests, typecheck, and build/export pass.
- [x] Configuration state is browser-verified; signed-out and customer-role states have component coverage.

## Task 4: Deliver customer vehicles — completed locally

**Description:** Build the vehicle list and add-vehicle flow using the protected
`GET /vehicles` and `POST /vehicles` contract.

**Acceptance criteria:**

- [x] Customer can see loading, empty, error, and populated vehicle states.
- [x] Vehicle input is validated before submission.
- [x] A successful creation updates the list without exposing it to other users.

**Verification:**

- [x] Tests cover validation, remote states, and successful list refresh.
- [x] Typecheck and lint pass.

**Dependencies:** Task 3

**Files likely touched:** `mobile/src/vehicles/*`, `mobile/app/(customer)/vehicles/*`,
vehicle tests

**Estimated scope:** Medium

## Task 5: Deliver service-request creation — implemented; device verification pending

**Description:** Build vehicle selection, service-description validation, explicit
foreground-location acquisition, and `POST /service-requests` submission.

**Acceptance criteria:**

- [x] The request cannot submit without a selected owned vehicle, valid description,
      and a successful foreground location reading.
- [x] Permission denial/unavailable location has a clear recovery state.
- [x] Coordinates are used only for the submitted request and are not persisted by
      the client.

**Verification:**

- [x] Tests cover payload construction and denial/error states.
- [ ] Manual device check verifies the foreground-permission prompt (external).

**Dependencies:** Tasks 3–4

**Files likely touched:** `mobile/src/service-requests/*`, `mobile/src/location/*`,
`mobile/app/(customer)/requests/new.tsx`, request tests

**Estimated scope:** Medium

## Task 6: Deliver request status and customer actions — completed locally

**Description:** Build the current/customer request list and detail views, including
only API-permitted cancellation and cash-payment confirmation actions.

**Acceptance criteria:**

- [x] Status labels and assigned-mechanic details render from `GET /service-requests/mine`.
- [x] Cancel/confirm-payment actions only render for permitted statuses and refresh
      the displayed request after success.
- [x] Exact pickup details and vehicle registration remain confined to the owning
      customer's request detail screen.

**Verification:**

- [x] Tests cover status-action mapping, error handling, and privacy-safe summaries.
- [x] Typecheck, lint, test, and production export/build pass.

**Dependencies:** Task 3

**Files likely touched:** `mobile/src/service-requests/*`,
`mobile/app/(customer)/requests/*`, request-status tests

**Estimated scope:** Medium

## Checkpoint: Complete

- [x] All locally verifiable Phase 5 implementation criteria are met.
- [x] Root lint, test, and formatting checks pass.
- [ ] Manual flow is verified with live Supabase/API configuration (external).
- [x] `docs/PROGRESS.md` is updated with completed work and remaining external setup.

## Verification record

- Root tests: 30 backend and 39 mobile tests pass; root lint and formatting pass.
- Mobile typecheck and production web export pass.
- Native configuration introspection confirms foreground-only location permissions.
- Isolated Edge verification: English/Bangla setup state, working toggle, no console errors or horizontal overflow at 320px and 390px.
- Live API and physical-device checks remain unchecked above; see mobile/README.md.
