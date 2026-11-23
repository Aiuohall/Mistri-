# Phase 5 task list

## Task 1: Create the Expo mobile workspace

**Description:** Establish the TypeScript Expo SDK 58 workspace, Expo Router entry
configuration, lint/test/typecheck/build scripts, and ignored mobile environment
template.

**Acceptance criteria:**

- [ ] `mobile` is a valid npm workspace with Expo Router and TypeScript configured.
- [ ] No `.env` or credential is tracked; `.env.example` documents public variables.
- [ ] Lint, test, typecheck, and web-export/build commands are defined.

**Verification:**

- [ ] Focused workspace checks pass.
- [ ] The app starts without configuration secrets.

**Dependencies:** None

**Files likely touched:** `mobile/package.json`, `mobile/app.json`,
`mobile/tsconfig.json`, `mobile/app/_layout.tsx`, `mobile/.env.example`

**Estimated scope:** Medium

## Task 2: Add localization and shared accessible UI primitives

**Description:** Add English/Bangla translations, language selection, and focused
layout/text/button/form-status primitives used by the Phase 5 screens.

**Acceptance criteria:**

- [ ] Customer-facing strings use translation keys.
- [ ] The app falls back safely to English.
- [ ] Shared states expose loading and error text accessibly.

**Verification:**

- [ ] Localization tests cover English, Bangla, and fallback behavior.
- [ ] Lint and typecheck pass.

**Dependencies:** Task 1

**Files likely touched:** `mobile/src/i18n/*`, `mobile/src/components/*`,
`mobile/app/_layout.tsx`, localization tests

**Estimated scope:** Medium

## Task 3: Add session-aware API client and app shell

**Description:** Implement configuration validation, Supabase session boundary,
authorized API requests, API-error mapping, and navigation states for unconfigured,
signed-out, and customer sessions.

**Acceptance criteria:**

- [ ] Every protected request uses a bearer token from the session boundary.
- [ ] Missing configuration and unauthorized API responses are recoverable states.
- [ ] A non-customer profile cannot enter customer routes.

**Verification:**

- [ ] API-client tests cover headers, error mapping, and unauthorized handling.
- [ ] Typecheck, lint, and production export/build pass.

**Dependencies:** Tasks 1–2

**Files likely touched:** `mobile/src/config/*`, `mobile/src/auth/*`,
`mobile/src/api/*`, `mobile/app/*`, API-client tests

**Estimated scope:** Medium

## Checkpoint: Foundation

- [ ] Mobile lint, tests, typecheck, and build/export pass.
- [ ] Configuration, signed-out, and customer-shell states are manually navigable.

## Task 4: Deliver customer vehicles

**Description:** Build the vehicle list and add-vehicle flow using the protected
`GET /vehicles` and `POST /vehicles` contract.

**Acceptance criteria:**

- [ ] Customer can see loading, empty, error, and populated vehicle states.
- [ ] Vehicle input is validated before submission.
- [ ] A successful creation updates the list without exposing it to other users.

**Verification:**

- [ ] Tests cover validation, remote states, and successful list refresh.
- [ ] Typecheck and lint pass.

**Dependencies:** Task 3

**Files likely touched:** `mobile/src/vehicles/*`, `mobile/app/(customer)/vehicles/*`,
vehicle tests

**Estimated scope:** Medium

## Task 5: Deliver service-request creation

**Description:** Build vehicle selection, service-description validation, explicit
foreground-location acquisition, and `POST /service-requests` submission.

**Acceptance criteria:**

- [ ] The request cannot submit without a selected owned vehicle, valid description,
      and a successful foreground location reading.
- [ ] Permission denial/unavailable location has a clear recovery state.
- [ ] Coordinates are used only for the submitted request and are not persisted by
      the client.

**Verification:**

- [ ] Tests cover payload construction and denial/error states.
- [ ] Manual device check verifies the foreground-permission prompt.

**Dependencies:** Tasks 3–4

**Files likely touched:** `mobile/src/service-requests/*`, `mobile/src/location/*`,
`mobile/app/(customer)/requests/new.tsx`, request tests

**Estimated scope:** Medium

## Task 6: Deliver request status and customer actions

**Description:** Build the current/customer request list and detail views, including
only API-permitted cancellation and cash-payment confirmation actions.

**Acceptance criteria:**

- [ ] Status labels and assigned-mechanic details render from `GET /service-requests/mine`.
- [ ] Cancel/confirm-payment actions only render for permitted statuses and refresh
      the displayed request after success.
- [ ] Exact pickup details and vehicle registration remain confined to the owning
      customer's request detail screen.

**Verification:**

- [ ] Tests cover status-action mapping, error handling, and privacy-safe summaries.
- [ ] Typecheck, lint, test, and production export/build pass.

**Dependencies:** Task 3

**Files likely touched:** `mobile/src/service-requests/*`,
`mobile/app/(customer)/requests/*`, request-status tests

**Estimated scope:** Medium

## Checkpoint: Complete

- [ ] All Phase 5 acceptance criteria are met.
- [ ] Root lint, test, and formatting checks pass.
- [ ] Manual flow is verified with live Supabase/API configuration when available.
- [ ] `docs/PROGRESS.md` is updated with completed work and remaining external setup.
