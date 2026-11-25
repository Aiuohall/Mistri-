# Specification: Phase 6 two-sided mobile workflow & customer discovery

## Objective

Enable a verified mechanic and a customer to complete one real service job end-to-end
through the Mistri Expo mobile app, reusing the Phase 3–4 protected APIs.

## Approved scope decisions

1. **Map experience:** Integrate `react-native-maps` behind a swappable `MapProvider`
   interface (`mobile/src/map/`), with a platform-safe web/list fallback and map
   attribution. Customer nearby discovery displays the customer's search center, search
   radius, and the privacy-safe mechanic list (never exposing raw mechanic coordinates or
   phone numbers). Assigned-job detail views display the authorized pickup pin.
2. **Mechanic background location:** Enable native background location tracking using
   `expo-task-manager` + `expo-location` (`Location.startLocationUpdatesAsync`) while a
   mechanic is explicitly online, respecting the server's 15-second / 50-metre update
   policy and Android foreground-service requirements. Going offline stops background
   tracking immediately and clears the server-side location.
3. **Controlled mechanic role provisioning:** Keep strict server-side roles with no
   self-service role switcher. Provide a local CLI helper
   (`npm run db:set-role --workspace=backend -- <email> <customer|mechanic|admin>`) for
   controlled test provisioning prior to the Phase 9 admin panel.

## Backend updates

- Enforce a 15-minute stale-location expiry window in `MechanicsService.findNearby` so
  offline or crashed mechanics do not remain visible indefinitely.
- Align the `POST /service-requests/:requestId/cancel` Swagger summary with the service
  rule (`open` requests only).
- Add the `db:set-role` local CLI helper script in `backend/src/database/set-user-role.ts`.

## Mobile updates

- Extend `mobile/src/api.ts` to support `GET`, `POST`, `PUT`, and `PATCH`, plus runtime
  response guards for mechanic profiles, nearby mechanics, available jobs, and location
  update responses.
- Route verified `mechanic` accounts in `mobile/src/account.tsx` to `<Mechanic />` while
  keeping strict `verifiedUserId === session.user.id` isolation and denying unsupported
  roles (such as `admin`).
- Add a **Nearby mechanics** discovery tab in `mobile/src/customer.tsx` backed by
  `GET /mechanics/nearby` and `<MapProvider />`.
- Add `mobile/src/mechanic.tsx` and `mobile/src/mechanic-location.ts`:
  - Mechanic profile setup/editing (`GET /mechanics/me`, `PUT /mechanics/me/profile`).
  - Online/offline availability toggle (`PATCH /mechanics/me/availability`) coordinated
    with background and foreground location publishing (`PUT /mechanics/me/location`).
  - Available jobs list (`GET /service-requests/available`) with privacy-safe summaries
    and atomic acceptance (`POST /service-requests/:requestId/accept`), including HTTP
    `409` conflict recovery.
  - Assigned jobs list (`GET /service-requests/assigned/me`) with private pickup
    coordinates, vehicle registration, `<MapProvider />` pickup pin, and confirmed
    lifecycle actions (`start_travel`, `arrive`, `start_service`, `complete`).
- Add complete English and Bangla translations for all Phase 6 UI strings.

## Deferred to later phases

- Socket.IO realtime updates, push notifications, in-app messaging, and completed-job
  reviews (Phase 7).
- Mechanic wallets, commissions, and manual bKash top-ups (Phase 8).
- Next.js admin verification and operations panel (Phase 9).
