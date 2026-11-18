# Mistri (মিস্ত্রি)

Mistri is a Bangladesh-first roadside assistance app that connects drivers with nearby
mechanics and garages when their vehicles break down.

## Repository layout

- `backend/` — NestJS API, authentication, business rules, realtime services, and database access.
- `mobile/` — Expo / React Native customer and mechanic app (Phase 5).
- `admin/` — Next.js operations panel (Phase 9).
- `docker/` — local development database initialization files.
- `docs/` — product decisions and delivery progress.

## Phase 1 quick start

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

See [docs/PROJECT.md](docs/PROJECT.md) for the product decisions and
[docs/PROGRESS.md](docs/PROGRESS.md) for delivery status.
