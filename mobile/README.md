# Mistri mobile app

Expo SDK 58, React Native, and Expo Router customer application with English and
Bangla interfaces. Customers can sign in with email/password, add vehicles, request
roadside help using foreground location, view requests, cancel open requests, and
confirm cash payment after completion.

## Run locally

From the repository root:

```powershell
npm install
Copy-Item mobile/.env.example mobile/.env
npm run start --workspace=mobile
```

Fill in the three public values in `mobile/.env`. Use the Supabase publishable key,
never a service-role key. Follow [Supabase setup](../docs/SUPABASE_SETUP.md) for the
project and Email provider. Email confirmation must complete before signing in;
Google sign-in and app redirect handling remain deferred. Restart Expo after changing
environment variables.

`EXPO_PUBLIC_API_URL` must point to the NestJS API, with its migrations applied and
JWT verification configured for the same Supabase project. A physical device needs
the development computer's LAN address rather than `localhost`. For the web app,
include its origin in the backend CORS configuration. Use HTTPS for hosted APIs and
for browser geolocation outside localhost.

Without configuration the application displays a setup notice. After sign-in,
`GET /auth/me` must verify a customer profile before customer screens mount. Browser
sessions stay in memory and require sign-in after reloading; native sessions use
OS-protected SecureStore. Signing out clears the local session and customer state.

## Customer flow

1. Choose English or Bangla, then sign in or create an email account.
2. Choose **Add vehicle**, enter a name, select a vehicle type, and save.
3. Choose **Request help**, select your vehicle, and describe the required service.
4. Choose **Use my current location**, grant foreground permission, review the
   coordinates, and send the request. If permission is denied or positioning fails,
   enable location in device settings and retry. No partial request is sent.
5. Open **My requests**, refresh for updates, and expand **View details** for pickup,
   vehicle registration, assigned mechanic, and available actions. Confirm a
   cancellation or cash-payment action before submitting it.

Expo Router hosts one session-aware screen. Customer sections and expanded request
details use local navigation state; deep links into individual requests are deferred.
Request status updates use explicit refresh. No maps, background location, location
history, push notifications, or mechanic screens are included in Phase 5.

## Verification

```powershell
npm run lint --workspace=mobile
npm run test --workspace=mobile
npm run typecheck --workspace=mobile
npm run build --workspace=mobile
```

Component tests mock the Supabase, HTTP, and native-location boundaries. Complete
the following on a configured device before release: email sign-in and session
restoration; vehicle creation; permission denial and retry; request submission;
request refresh and status actions; sign-out; and the same flow in Bangla. Web
export does not verify native permission prompts or native installation.
