# Local development services

`docker-compose.yml` starts only the local Postgres/PostGIS database. Production will
use Supabase; do not use this Compose service for deployment.

## Commands

From the repository root:

```powershell
docker compose up -d postgres
docker compose ps
docker compose down
```

The named volume `mistri_postgres_data` preserves local data between restarts. Mistri
uses host port `5433` by default to avoid conflicting with an existing local Postgres on
the common port `5432`. To use a different host port, set `POSTGRES_PORT` in the root
`.env` file, then use the same port in `backend/.env`'s `DATABASE_URL`.
