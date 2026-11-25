# Phase 7 job engagement

Phase 7 adds status updates, device notifications, private chat, and reviews to the
existing Mistri job lifecycle. Job permissions and state transitions remain in NestJS.

## Event and delivery design

- The job-status trigger writes participant-scoped invalidations to `job_outbox`
  in the same commit as the status transition. Chat sends write their event in
  the message transaction. Clients recover through authorized REST reads.
- The authenticated Socket.IO `/jobs` namespace resolves the current role and
  joins a server-selected account room. Clients cannot choose rooms. A connection
  expires with its access token. Socket payloads contain an opaque job and event
  ID and a kind, without pickup information, message bodies, or registration.
- The dispatcher runs in the API process for a single API instance. It claims work
  in bounded batches and moves eligible push deliveries to a separate retry queue.
  A multi-instance deployment requires a shared Socket.IO adapter before enablement.
  Events are invalidations, so dispatch and reconnect can safely cause repeat reads.
- Push uses the Expo Push Service. The API leases queue entries, retries transient
  errors, records ticket IDs for receipt checks, and revokes unregistered tokens.
  Carrier delivery is best effort and ambiguous network failures can cause duplicates.
  Generic notifications contain only a job ID. On tap, the app checks whether that
  job is in its authorized list before opening the detail.
- Device notifications are opt-in. Token registrations are account-scoped and
  refreshed on app foreground. Explicit disable revokes the registration. Sign-out
  attempts revocation and inactive installations stop receiving new deliveries after
  seven days. If sign-out occurs offline, a generic notification may still arrive
  until revocation, re-registration, or expiry.

## Contracts

| Method and route                                      | Behavior                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /service-requests/:id/messages?before=…           | Participant-only conversation after assignment, with up to 50 messages and an opaque pagination cursor                                                       |
| POST /service-requests/:id/messages                   | Active owner or assigned mechanic sends 1–1000 characters with a UUID client key. Same key and body return the original message. Different body returns 409. |
| POST /service-requests/:id/messages/:messageId/report | Participant reports the other participant's message. Repeats are idempotent.                                                                                 |
| POST /service-requests/:id/review                     | Requesting customer submits a 1–5 rating and optional comment of up to 500 characters after completion or payment. One review per job.                       |
| GET /mechanics/:id/review-summary                     | Rating and published review count. Nearby cards also contain the aggregate.                                                                                  |
| PUT /push/installations                               | Registers or refreshes the Expo installation token under the current customer or mechanic account.                                                           |
| POST /push/installations/revoke                       | Removes the current account's registration.                                                                                                                  |

Completed and paid conversations are read-only. They remain visible only to the
participants. The backend limits message volume per sender. Review text stays
private during this phase. The database stores reports for staff triage. A staff
moderation workflow and the production retention policy belong in the Phase 9–10
release gates. The new tables enable row-level security without direct client policies.

## Run and verify

1. Apply versioned migrations with `npm run db:migrate --workspace=backend` to a
   configured environment before starting the Phase 7 API.
2. Configure a development build with an Expo/EAS project ID and Android FCM or iOS
   APNs credentials. On Android, set `GOOGLE_SERVICES_FILE` to the supplied Firebase
   native configuration file in the build environment. Keep it outside version control.
   A server using Expo's enhanced security supplies `EXPO_PUSH_ACCESS_TOKEN` privately.
   See [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
   and [ticket and receipt handling](https://docs.expo.dev/push-notifications/sending-notifications/).
3. First finish the Phase 6 customer/mechanic device walkthrough. Then perform a
   second job: confirm foreground updates on both devices, force a disconnect and
   reconnect, exchange messages, report one as the recipient, complete the job,
   and verify exactly one review appears in the aggregate.
4. Verify denied push permissions, expiry, receiving and tapping a background push,
   logout/token rotation, and an unrelated user receiving no private details.
   Check push tickets and receipts in staging without exposing tokens.
5. Run repository tests, lint, formatting, builds, and mobile typecheck. The PostGIS
   integration tests take a dedicated loopback URL named `mistri_phase7_test_*` via
   `MISTRI_PHASE7_TEST_DATABASE_URL`. They apply migrations and use synthetic fixtures.
