# Implementation plan: Phase 5 mobile foundation and customer request flow

## Overview

Build the customer-facing Expo application described in
[`docs/PHASE_5_SPEC.md`](../docs/PHASE_5_SPEC.md). The plan begins with a
testable Expo workspace, then adds localized session/API infrastructure, and finally
delivers small customer-flow slices: vehicles, request creation, and request status.

## Dependency graph

```text
Expo workspace + test tooling
        |
        +-- localization + session/API client
        |         |
        |         +-- authenticated app shell
        |                   |
        |                   +-- vehicles
        |                   +-- request creation with foreground location
        |                   +-- request status/actions
        |
        +-- Supabase project configuration (external; required for live E2E)
```

## Architecture decisions

- Use Expo SDK 58 and Expo Router in the existing `mobile` npm workspace.
- Keep API transport, Supabase session, localization, and presentation components
  separate. Screens orchestrate them but do not embed bearer-token or fetch logic.
- Use public `EXPO_PUBLIC_*` configuration variables only. Without configuration, the
  app shows a recoverable setup state instead of making unauthenticated calls.
- Request foreground location only when the customer explicitly creates a service
  request. Background tracking and maps are not part of this phase.
- Use a session-aware shell now; live Email/Google provider activation remains
  externally configured work.

## Task list

Tasks are tracked in [`tasks/todo.md`](todo.md). Implementation order is strictly
sequential through Task 3, then Tasks 4–6 are independently testable UI slices that
share the established client contract.

## Risks and mitigations

| Risk                                      | Impact                                      | Mitigation                                                                             |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Supabase values are absent                | Live sign-in/API verification cannot run    | Add a clear configuration state; verify types, tests, and client construction locally. |
| Expo/native package version drift         | Build or runtime incompatibility            | Install all Expo packages with `expo install` after the SDK version is pinned.         |
| A device cannot reach `localhost`         | Physical-device API calls fail              | Document a LAN `EXPO_PUBLIC_API_URL`; never hardcode a network address.                |
| Location permission is denied/unavailable | Request cannot include required coordinates | Show an accessible recovery state; do not submit partial requests.                     |
| Map/FCM scope expands Phase 5             | Delays core request flow                    | Keep both deferred unless a separate approved contract/provider decision is made.      |

## Verification checkpoints

- **Foundation (Tasks 1–3):** mobile lint, tests, typecheck, and production export
  all pass; the app starts with configuration and session-setup states.
- **Customer flow (Tasks 4–6):** each slice has unit/component coverage and preserves
  customer-only API contract behavior.
- **Completion:** root checks pass, a manual device/web walkthrough confirms loading,
  error, empty, English, and Bangla states, and live API verification is performed
  once Supabase configuration is supplied.
