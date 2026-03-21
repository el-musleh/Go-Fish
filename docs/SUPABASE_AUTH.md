# Supabase Auth — Developer Guide

## Project details

| Field | Value |
|---|---|
| Project URL | `https://moiajtcnyimeqllextxn.supabase.co` |
| Publishable key | `sb_publishable_4XUEzFKVrfB62393Jc_aNw_868A81Tx` |
| Dashboard | https://supabase.com/dashboard/project/moiajtcnyimeqllextxn |

The publishable key is safe to commit — it is only usable from the browser and enforces Row Level Security policies.

---

## How auth works in this app

1. The user signs in via Supabase (email/password or Google OAuth).
2. On success, the frontend calls `POST /api/auth/email` with the user's email to find or create a record in our own Postgres database.
3. The returned `userId` (our DB's UUID) is stored in `localStorage` under `gofish_user_id` and sent as the `x-user-id` header on every API request.
4. The backend `requireAuth` middleware reads `x-user-id` and attaches the user to the request.

Supabase handles credential storage and OAuth flows. Our backend does not verify Supabase JWTs — it trusts the frontend to pass the correct user ID after a successful Supabase sign-in.

### Relevant files

| File | Purpose |
|---|---|
| `client/src/lib/supabase.ts` | Supabase client initialisation |
| `client/src/components/AuthDialog.tsx` | Modal sign in / sign up dialog (opened from topbar) |
| `client/src/pages/AuthPage.tsx` | Full-page auth form at `/login` |
| `client/src/App.tsx` | `onAuthStateChange` listener — syncs OAuth sessions with backend |
| `src/routes/authRouter.ts` | Backend `POST /api/auth/email` endpoint |

---

## Enabling a new OAuth provider

1. Go to **Authentication → Providers** in the Supabase dashboard.
2. Toggle the provider on and paste in the Client ID and Secret from that provider's developer console.
3. Add the Supabase callback URL to the provider's allowed redirect URIs:
   ```
   https://moiajtcnyimeqllextxn.supabase.co/auth/v1/callback
   ```
4. Add your app's origin to **Authentication → URL Configuration → Redirect URLs**:
   ```
   http://localhost:5173        ← local dev
   https://your-production-domain.com
   ```

---

## Google OAuth — current setup

- **Google Cloud project:** configured with OAuth 2.0 credentials
- **Client ID:** `571650046668-fr9fs23soiau0glueh5ef5uqaqlb30v6.apps.googleusercontent.com`
- **Authorised JavaScript origin:** `https://moiajtcnyimeqllextxn.supabase.co`
- **Authorised redirect URI:** `https://moiajtcnyimeqllextxn.supabase.co/auth/v1/callback`

### Adding test users (development only)

While the Google OAuth consent screen is in **Testing** mode, only explicitly added test users can sign in with Google. To add a user:

1. Go to [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/oauth-consent).
2. Scroll to **Test users** → **Add users**.
3. Enter the Gmail address and save.

To remove the restriction and allow any Google account, publish the app by clicking **Publish App** on the consent screen. This triggers a Google verification review for sensitive scopes, but for basic profile/email access it is usually approved quickly or can be skipped.

---

## Adding a new environment (e.g. staging or production)

1. Add the new origin to **Supabase → Authentication → URL Configuration → Redirect URLs**.
2. Add the same origin to the **Authorised JavaScript origins** list in Google Cloud Console.
3. No code changes are needed — `redirectTo` is set dynamically from `window.location.origin`.

---

## Rotating credentials

- **Supabase publishable key:** safe to keep in source. Only the secret service-role key (never committed) needs rotation.
- **Google Client Secret:** rotate in Google Cloud Console → update the value in Supabase dashboard → no code deploy required.
