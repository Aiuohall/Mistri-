# Mistri (মিস্ত্রি)

Mistri is a Bangladesh-first roadside assistance app that connects drivers with nearby
mechanics and garages when their vehicles break down.

## Repository layout

- `backend/` — NestJS API, authentication, business rules, realtime services, and database access.
- `mobile/` — Expo / React Native customer and mechanic app (Phase 5).
- `admin/` — Next.js operations panel (Phase 9).
- `docker/` — local development database initialization files.
- `docs/` — product decisions and delivery progress.

## Phase 1–4 quick start

1. Copy the development environment templates:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend/.env.example backend/.env
   ```

2. Install JavaScript dependencies from the repository root:

   ```powershell
   npm install
   ```

3. Start local Postgres with PostGIS:

   ```powershell
   docker compose up -d postgres
   ```

4. Confirm PostGIS is reachable, then start the API:

   ```powershell
   npm run db:check --workspace=backend
   npm run dev:backend
   ```

5. Open `http://localhost:3000/health`. API documentation is at
   `http://localhost:3000/docs`.

Run the versioned database migrations before starting the API:

```powershell
npm run db:migrate --workspace=backend
```

## Delivered through Phase 4

- **Phase 1:** NestJS monorepo, Postgres/PostGIS development database, API health check,
  Swagger documentation, and project tooling.
- **Phase 2:** Supabase JWT authentication, customer/mechanic/admin roles, protected
  profile endpoint, and user database migration. See [Supabase setup](docs/SUPABASE_SETUP.md)
  to enable sign-in.
- **Phase 3:** Mechanic profiles, online/offline presence, privacy-aware location updates,
  and PostGIS nearby-mechanic search.
- **Phase 4:** Customer vehicle management and service requests with ownership checks,
  privacy-aware pickup details, atomic mechanic acceptance, server-controlled job
  progression, customer cancellation while open, and cash-payment confirmation.

The mobile UI and production Supabase configuration are still separate setup steps; see
[delivery progress](docs/PROGRESS.md) for current status.

See [docs/PROJECT.md](docs/PROJECT.md) for the product decisions and
[docs/PROGRESS.md](docs/PROGRESS.md) for delivery status.
