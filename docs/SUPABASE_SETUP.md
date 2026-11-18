# Phase 2: Supabase authentication setup

Supabase performs sign-in. Mistri's backend verifies the access token using Supabase's
public signing keys and stores authorization roles in its own `users` table. The mobile
app will use the public **anon** key in Phase 5. Never expose a Supabase database
password or service-role key in a mobile app, Git repository, or chat.

## 1. Create the free Supabase project

1. Sign in at [Supabase](https://supabase.com/dashboard) and select **New project**.
2. Choose a nearby region, give it the name `mistri`, and save the database password in
   a password manager. It is not a project source-code value.
3. Wait until the project is ready. Supabase's free plan has a 500 MB database limit;
   Mistri's latest-location-only design is intended to stay within it.

## 2. Configure the backend locally

1. Copy `backend/.env.example` to `backend/.env` if you have not already done so.
2. In Supabase, open **Connect** and copy the transaction-pooler connection string.
   Replace its password placeholder with the database password you saved.
3. Set these values in the ignored `backend/.env` file:

   ```dotenv
   DATABASE_URL=postgresql://...your-Supabase-transaction-pooler-connection-string...
   DATABASE_SSL=true
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_JWT_AUDIENCE=authenticated
   ```

4. Apply the schema migration to Supabase from your local terminal:

   ```powershell
   npm run db:migrate --workspace=backend
   ```

`db:migrate` records the executed migration in `typeorm_migrations`. Do not use
`synchronize: true` against Supabase; migrations are the safe, repeatable history of
database changes.

## 3. Enable email sign-in

1. In Supabase, open **Authentication** → **Providers** → **Email**.
2. Enable email sign-in. Keep confirmation emails enabled for a real pilot; Supabase's
   default email sender has free-tier rate limits, so use it only for early testing.
3. The mobile UI for sending the email/password sign-up and sign-in requests arrives in
   Phase 5. After sign-in it will pass Supabase's `access_token` to this API as
   `Authorization: Bearer <access_token>`.

## 4. Enable Google sign-in

Google sign-in needs a free Google Cloud OAuth client that you create in your own Google
account:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a
   project, then configure the OAuth consent screen as **External** for the pilot.
2. Create an OAuth client of type **Web application**.
3. In Supabase **Authentication** → **Providers** → **Google**, copy the exact
   **Callback URL** shown by Supabase into Google Cloud's **Authorized redirect URIs**.
4. Copy the Google client ID and client secret back into Supabase's Google provider form,
   then enable the provider.
5. Do not add the client secret to Mistri source code or an `.env.example` file.

The Expo deep-link redirect used after Google sign-in is set in Phase 5, once the mobile
app has its final scheme.

## 5. Verify a signed-in user

After you have signed in through the future mobile app (or a Supabase test client), call:

```powershell
$headers = @{ Authorization = "Bearer YOUR_SUPABASE_ACCESS_TOKEN" }
Invoke-RestMethod -Uri http://localhost:3000/auth/me -Headers $headers
```

The first successful call creates a local `users` row with role `customer`. The API does
not accept a role from the client. An administrator role must be granted through a
controlled admin workflow; that workflow is added in Phase 9.
