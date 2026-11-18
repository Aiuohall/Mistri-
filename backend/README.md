# Mistri backend

The API uses NestJS. Nest groups related HTTP code into modules and controllers: a
controller defines routes, while a module declares which building blocks belong together.

## Local setup

1. From the repository root, create `backend/.env` from `.env.example`.
2. Install all workspaces once with `npm install` from the repository root.
3. Start the database with `docker compose up -d postgres` from the repository root.
4. Apply all local schema migrations, then confirm the PostGIS extension is available:

   ```powershell
   npm run db:migrate --workspace=backend
   npm run db:check --workspace=backend
   ```

5. Run the API with automatic restart after file changes:

   ```powershell
   npm run dev:backend
   ```

## Routes in Phase 1

- `GET /health` — liveness endpoint for local checks and the future Render deployment.
- `GET /docs` — Swagger/OpenAPI documentation.
- `GET /auth/me` — verifies a Supabase bearer token and returns (or creates) the local
  user profile. New users receive the `customer` role.
- `GET /auth/admin/check` — an example route protected by the server-side `admin` role.

## Quality checks

```powershell
npm run lint --workspace=backend
npm run test --workspace=backend
npm run build --workspace=backend
```

`src/database/data-source.ts` is a TypeORM connection definition used only by
the migration and database-check commands. The running API connects through Nest's
TypeORM module because it now owns the local `users` authorization record.

The local connection template uses `127.0.0.1` instead of `localhost`. This avoids an
unrelated IPv6-local PostgreSQL listener taking precedence on Windows machines.

For the exact free-tier Supabase email and Google configuration, follow
[docs/SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md).
