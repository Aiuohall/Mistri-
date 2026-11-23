# Draft specification: Phase 5 mobile foundation and customer request flow

## Status

**Draft — requires approval before implementation.**

## Objective

Create the first customer-facing Mistri mobile application. A signed-in customer can
view their vehicles, add a vehicle, grant foreground location permission, submit a
service request for one of their vehicles, and see the status of their own requests.
The app must support Bangla and English and must not disclose other customers' pickup
details or vehicle registrations.

## Scope

### Included

- Expo SDK 58 TypeScript application in the existing `mobile/` workspace.
- Expo Router file-based navigation, using the starter configuration recommended by
  Expo.
- Supabase session integration using public Expo environment variables. The app sends
  the session access token to the existing NestJS API as a bearer token.
- Customer routes for sign-in/session restoration, vehicle list and creation, service
  request creation, and request list/detail status.
- Foreground-only current-location permission and coordinate acquisition when the
  customer creates a request. No background location collection.
- English and Bangla user-visible strings, with English fallback and an in-app
  language toggle.
- Accessible loading, error, and empty states for every remote-data screen.
- Unit tests for the API client request/auth handling and pure validation/formatting
  behavior.

### Explicitly deferred

- A map SDK and visual pin-drop picker. Phase 5 will use the device's current
  foreground location; a swappable `MapProvider` can be introduced after a provider
  is selected and its credentials are available.
- FCM/push delivery. The backend has no device-token registration or notification
  service yet, and current Expo documentation requires a development build for remote
  push notifications on Android.
- Mechanic UI, mechanic location tracking, request acceptance, review submission,
  payments other than displaying the API's cash-payment state, and admin functions.
- Offline request submission and location history.

## User flow

1. The app restores an existing Supabase session or presents the configured sign-in
   route.
2. It calls `GET /auth/me` with the Supabase access token. Only a `customer` role
   can enter the Phase 5 routes.
3. The customer sees their requests and can add or select a vehicle.
4. The customer enters a service type and description, permits foreground location,
   reviews the coordinates, and creates `POST /service-requests`.
5. The customer sees their own request status, assigned mechanic name when available,
   and customer-allowed actions: cancel while the API permits it and confirm cash
   payment after completion.

## Technical decisions

| Area            | Decision                                           | Rationale                                                                                                                                                  |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Expo SDK 58 with TypeScript                        | Current Expo documentation recommends creating Expo applications with `create-expo-app`; SDK-compatible packages will be installed through `expo install`. |
| Navigation      | Expo Router                                        | It is the repository's fixed mobile-stack decision and Expo's file-based router.                                                                           |
| Localization    | `expo-localization` + `i18n-js`                    | This follows Expo's current localization guide for device locales and translated strings.                                                                  |
| API auth        | Supabase access token in `Authorization: Bearer`   | Matches the existing `SupabaseAuthGuard` contract.                                                                                                         |
| API location    | `expo-location` foreground permissions only        | A customer needs a pickup point but Phase 5 must not collect location in the background.                                                                   |
| Session storage | Supabase's current Expo-compatible storage pattern | Session configuration will follow Supabase's official Expo React Native documentation; no service-role key will be present in the app.                     |

## API contract used

- `GET /auth/me`
- `GET`, `POST /vehicles`
- `GET /service-requests/mine`
- `GET`, `POST /service-requests/:requestId/cancel`,
  `POST /service-requests/:requestId/confirm-cash-payment`
- `POST /service-requests`

The client will treat all API responses as untrusted data and will not render exact
pickup coordinates or registration details outside the customer-owned request view.

## Configuration

`mobile/.env` will be ignored and `mobile/.env.example` will document only:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is safe to include in a mobile app; a Supabase service-role key
must never be used or committed. A physical device needs a LAN-reachable API URL,
not `localhost`.

## Commands

```powershell
npm run lint --workspace=mobile
npm run test --workspace=mobile
npm run typecheck --workspace=mobile
npm run start --workspace=mobile
npm run build --workspace=mobile
```

The exact scripts will be added with the mobile workspace.

## Testing strategy

- Small Jest tests for API request construction, unauthorized-session handling,
  request payload validation, and status/action rules.
- Component tests for loading, empty, error, and request-form validation states.
- Manual device verification: sign in, allow/deny foreground location, add a vehicle,
  create a request, and verify it appears in the customer's request list.

## Boundaries

- **Always:** preserve API authorization boundaries, request only foreground location,
  validate client input before network calls, run focused tests/build/lint after each
  slice, and keep English/Bangla strings together.
- **Ask first:** add native dependencies, select a map provider, configure Firebase or
  Supabase accounts, change backend schema/endpoints, or add background location.
- **Never:** commit `.env` files, include a Supabase service-role key, bypass the API
  with direct database access, or expose another customer's location/registration.

## Success criteria

- The mobile workspace builds, type-checks, lints, and its tests pass.
- With valid Supabase public configuration and a customer session, the app can use the
  existing protected API to list/add vehicles and create/list customer requests.
- Location permission refusal produces a clear recovery state and sends no request.
- All Phase 5 screens are usable in English and Bangla with visible loading, empty,
  and error states.
- No map key, Firebase credential, Supabase secret, or location history is added.

## Open question

The Supabase project and providers are not yet configured. Choose whether Phase 5
should include live Email/Google sign-in now (requiring those values and redirect
configuration) or should deliver the app/session-aware API flow first and connect the
sign-in screen once that external configuration is available.

## Sources

- https://docs.expo.dev/router/introduction/
- https://docs.expo.dev/router/installation/
- https://docs.expo.dev/guides/localization/
- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
