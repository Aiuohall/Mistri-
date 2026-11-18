# Mistri backend

The API uses NestJS. Nest groups related HTTP code into modules and controllers: a
controller defines routes, while a module declares which building blocks belong together.

## Local setup

1. From the repository root, create `backend/.env` from `.env.example`.
2. Install all workspaces once with `npm install` from the repository root.
3. Start the database with `docker compose up -d postgres` from the repository root.
4. Confirm the PostGIS extension is available:

   ```powershell
   npm run db:check --workspace=backend
   ```

5. Run the API with automatic restart after file changes:

   ```powershell
   npm run dev:backend
   ```

## Routes in Phase 1

- `GET /health` — liveness endpoint for local checks and the future Render deployment.
- `GET /docs` — Swagger/OpenAPI documentation.

## Quality checks

```powershell
npm run lint --workspace=backend
npm run test --workspace=backend
npm run build --workspace=backend
```

`src/database/data-source.ts` is a TypeORM connection definition used only by
`db:check` in this phase. The running API deliberately does not depend on a database
connection yet, so `/health` can accurately report whether the API process itself is
alive. Entities and the application-wide database module are introduced with Supabase
in Phase 2.

The local connection template uses `127.0.0.1` instead of `localhost`. This avoids an
unrelated IPv6-local PostgreSQL listener taking precedence on Windows machines.
