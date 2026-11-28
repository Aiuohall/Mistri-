# Phase 8 pricing and mechanic wallets

The development sandbox exercises the cash job and manual bKash top-up workflow using synthetic transfers. Customer and mechanic screens support English and Bangla. The staff actions are protected API endpoints.

## Run locally

1. Point the API at a dedicated development Postgres/PostGIS database. Apply the versioned migrations with `npm run db:migrate --workspace=backend`.
2. Set `MISTRI_WALLET_SANDBOX=true` in the backend environment and restart the API. The switch defaults to false. Production configuration rejects an enabled sandbox. Keep separate databases for test balances and production.
3. Create a job with a customer account after enabling the sandbox. With a mechanic account, accept the job, open its details and propose a price in taka. The customer sees the proposed cash price and the mechanic's commission separately and can accept that version.
4. In **Test wallet**, submit a synthetic bKash reference and amount. For example, a ৳100.00 job at the default 10% rate needs ৳10.00 available. A pending top-up contributes zero to the balance.
5. Sign into the API as a test admin. Inspect the pending transfer, match its reference and amount against the synthetic statement, and approve or reject it with a reason. Refresh the mechanic's wallet or pricing screen. After arrival, starting work reserves the fee. Completing work posts the commission. The customer can then confirm cash.

## Settlement rules

- The API stores amounts in integer poisha. One taka is 100 poisha. The server snapshots `MISTRI_TEST_COMMISSION_BPS` when a request is created. The test default is 1000 basis points, with an allowed range of 1000–1500. The database computes the fee once per quote, rounding half a poisha upward.
- The mechanic proposes a new sequential version for every price change. Only the owning customer can accept the current version. A proposed replacement leaves the existing agreement in force until acceptance. During work, accepting a replacement adjusts the hold atomically. If the increase cannot be funded, the previous agreement and hold still apply.
- Starting work requires an accepted current quote and enough available funds. Completion posts the held amount once, including on retries. Cash confirmation records the customer payment separately. Jobs created before enablement continue through the original cash workflow.
- An admin can cancel an abandoned in-progress test job and release its hold after reviewing it. Holds have no automatic expiry. A post-completion dispute can reverse the full commission once. Both commands record actor, timestamp, job and reason. The refund changes the mechanic's balance and leaves the customer's cash record intact.
- Disabling the sandbox pauses wallet writes and priced mechanic transitions. Re-enabling it resumes from the saved state. The migration refuses to remove populated settlement data. Use a tested backup or forward migration for recovery.

## API

All endpoints require a valid session and the indicated role. All API amounts are in poisha.

| Role              | Method and path                                     | Result or request body                                                                               |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Job participant   | GET `/service-requests/:id/pricing`                 | Current proposal, latest accepted quote, rate and top-up requirement                                 |
| Assigned mechanic | POST `/service-requests/:id/quotes`                 | `{ "version": 1, "amount": 10000 }`                                                                  |
| Owning customer   | POST `/service-requests/:id/quotes/:quoteId/accept` | Accept the displayed version                                                                         |
| Mechanic          | GET `/wallet/me`                                    | Balance, reserved amount and up to 50 recent entries and submissions each                            |
| Mechanic          | POST `/wallet/me/topups`                            | `{ "reference": "TEST123456", "amount": 1000 }`                                                      |
| Admin             | GET `/operations/topups`                            | Up to 50 oldest pending submissions                                                                  |
| Admin             | POST `/operations/topups/:id/decision`              | `status` of `approved` or `rejected`, plus `reason`                                                  |
| Admin             | POST `/operations/jobs/:id/correction`              | `action` of `refund` or `release`, plus `reason`                                                     |
| Admin             | GET `/operations/wallets/reconciliation`            | Wallets whose balance differs from the ledger sum or whose reserved amount differs from active holds |

Use the same reference and amount to retry a submission. A reused reference with a different owner or amount returns HTTP 409. Retry a decision or correction with the original actor, action and reason. Check reconciliation at the end of each sandbox test session. For a pilot, finance staff must also match approved credits to the provider statement daily and investigate discrepancies before further approvals.

## Verification and pilot decisions

Run `npm test` with `MISTRI_PHASE8_TEST_DATABASE_URL` pointing to a dedicated loopback database named `mistri_phase8_test_*` on a PostGIS-enabled server. The suite applies migrations and creates synthetic records. It retains immutable financial fixtures in that database.

Before live use, verify the bilingual two-account flow on devices, approve the pilot commission rate and dispute/release policy, and verify the operator's statement-matching procedure against the approved provider account. The sandbox never initiates or verifies an external transfer.
