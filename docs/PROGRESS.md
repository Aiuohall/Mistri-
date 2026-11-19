# Mistri delivery progress

## Current phase

**Phase 3 — completed locally: mechanic profiles, availability, locations, and nearby search**

### Completed

- Created the npm-workspaces monorepo folders: `backend`, `mobile`, `admin`, `docs`,
  and `docker`.
- Added a Postgres 16 + PostGIS 3.4 Docker Compose service with a health check,
  persistent named volume, and automatic PostGIS initialization.
- Added the NestJS API foundation with environment validation, strict global request
  validation, CORS configuration, Swagger at `/docs`, and `GET /health`.
- Added a TypeORM-based `db:check` command that confirms a local PostGIS connection.
- Added root/backend formatting, linting, build, and health-unit-test configuration.
- Added `.env.example` templates and READMEs for every current folder.
- Installed the npm dependency tree and committed its exact resolved versions to
  `package-lock.json`.
- Verified formatting, linting, the health unit test, and the production backend build.
- Started Docker Desktop, downloaded the PostGIS image, and verified the container is
  healthy on host port `5433`.
- Verified `GET /health` returns HTTP 200, Swagger is available at `/docs`, and the
  TypeORM probe reports PostGIS 3.4.

### Phase 2 completed locally

- Added a versioned `users` table migration with `customer`, `mechanic`, and `admin`
  roles, plus user email and phone profile fields.
- Connected the NestJS API to TypeORM and applied the migration to local Postgres.
- Added Supabase JWT verification through its public JWKS endpoint and bearer-token
  guard protection for `GET /auth/me`.
- Added server-side role authorization with an admin-only example endpoint. Clients
  cannot self-assign roles; newly verified users default to `customer`.
- Added unit tests for bearer-token enforcement, JWT audience/signature validation, and
  customer rejection on an admin-only route.
- Added [SUPABASE_SETUP.md](SUPABASE_SETUP.md) with exact free-tier project, email, and
  Google OAuth setup instructions.

### External configuration still required

- Create the Supabase project and configure `backend/.env` with its database connection
  URL and project URL.
- Enable the Email and Google auth providers in your own Supabase/Google accounts. These
  provider accounts and secrets cannot be created or handled by the codebase.

### Phase 3 completed locally

- Added a versioned `mechanics` migration with a one-to-one user profile, online status,
  service types, and a latest-location-only PostGIS geography point.
- Added protected mechanic profile, online/offline, and location-update endpoints. Going
  offline clears the saved location; updates require at least 15 seconds and 50 metres of
  movement.
- Added `GET /mechanics/nearby`, which only returns online mechanics with a current
  location, searches with `ST_DWithin`, and orders results by spatial distance.
- Added unit coverage for profile creation, presence and location privacy, location-update
  constraints, and nearby result mapping.

## Next phase

**Phase 4 — vehicles and service requests, including server-owned request transitions.**

## Known issues

- Mistri uses host port `5433` because an unrelated local PostgreSQL process owns
  port `5432`. The Docker container's internal database port remains `5432`.
- Docker Desktop's command-line folder was added to the Windows user PATH. A newly
  opened terminal is needed before the `docker` command becomes available by name.
- `npm audit --omit=dev` reports three moderate advisories through TypeORM 0.3.31's
  `glob`/`minimatch` chain. The offered remediation is a breaking TypeORM 1.1 upgrade;
  do not run `npm audit fix --force`. Review that upgrade deliberately during Phase 10.
