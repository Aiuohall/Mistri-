# Mistri (মিস্ত্রি) project brief

## Product

Mistri is a mobile app for Bangladesh that helps a driver find nearby mechanics or
garages after a car, bike, or personal vehicle breaks down. The MVP serves
Mohammadpur, Dhanmondi, and Kuril in Dhaka, with Bangla and English interfaces.

Customers will discover nearby mechanics on a map and list, send a service request,
track work, and review only completed jobs. Mechanics can switch online/offline,
receive and progress jobs, and maintain a prepaid commission wallet. Phone numbers are
not exposed; communication remains in the app.

## Fixed free-tier stack

| Area                | Decision                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Repository          | npm workspaces monorepo: `/backend`, `/mobile`, `/admin`, `/docs`                           |
| Local database      | Docker Compose with Postgres 16 + PostGIS 3.4                                               |
| Production database | Supabase free Postgres with PostGIS; keep only the latest mechanic location                 |
| Backend             | NestJS + TypeScript, TypeORM, JWT, class-validator, Swagger, Socket.IO                      |
| Backend hosting     | Render free tier with a ten-minute external keep-alive ping                                 |
| Mobile              | React Native + Expo + Expo Router, swappable MapProvider, i18n, FCM                         |
| Admin               | Next.js on Vercel or Cloudflare Pages free tier                                             |
| Auth                | Supabase Google/email; profile phone field; mockable OTP provider later                     |
| Payments            | Cash jobs; manual bKash wallet top-ups; swappable payment provider                          |
| Domain              | `mistri.aiuohall.dev`, `api.mistri.aiuohall.dev`, `admin.mistri.aiuohall.dev` on Cloudflare |
| Automation          | GitHub Actions for checks, weekly backups, and Supabase keep-alive                          |

## Data and safety rules

- Models: users, mechanics, vehicles, service_requests, reviews, payments, wallets,
  wallet_transactions, commissions.
- Request progression: `pending` → `accepted` → `on_the_way` → `working` →
  `completed` → `paid`, with validated cancellation rules.
- Mechanics update only their latest location while online, every 15–30 seconds, and
  only after moving about 50 metres. Nearby lookups will use a spatial index and
  `ST_DWithin`.
- The mechanic pays a 10–15% commission when a job completes. The customer sees no
  added fee.
- All client input is validated; the server owns prices, ownership, and transitions.

## Decisions made in Phase 1

- The local database image is `postgis/postgis:16-3.4`, with `postgis` and `uuid-ossp`
  extensions enabled at first initialization.
- Mistri maps its local database to host port `5433`, retaining Postgres's internal
  port `5432`. This avoids a detected existing local PostgreSQL service on port `5432`.
- `/health` is a liveness endpoint: it confirms the API process can respond without
  making a database call. A separate `npm run db:check --workspace=backend` verifies
  database plus PostGIS connectivity. This lets future hosting checks distinguish an
  unavailable API from an unavailable database.
- TypeORM is available from Phase 1 through a dedicated connection definition; entities
  and the API's database module arrive with Supabase authentication in Phase 2.
- Environment files are ignored. Only `.env.example` templates are versioned.

## Free-tier constraints to track

- Supabase's free database quota is 500 MB. Latest-location-only storage prevents
  location-history growth.
- Render free services can sleep after inactivity. The future external ten-minute
  ping works around this; the exact provider and quotas will be verified before
  deployment.
- Firebase, Expo, Vercel/Cloudflare Pages, and mapping services all have separate
  free-tier limits. Their production configuration is deferred until the corresponding
  phase and will remain behind provider interfaces.
