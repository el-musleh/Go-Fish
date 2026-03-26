# Go Fish - Deployment Guide

## Architecture

- **Frontend**: Vercel (https://go-fish-git-mo-dev-el-muslehs-projects.vercel.app)
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (Google OAuth)

## Quick Start

### 1. Database Setup (Already Done)

The database tables have been created in Supabase via SQL migration:
- `user` - User accounts
- `taste_benchmark` - User taste preferences
- `event` - Event activities
- `invitation_link` - Invite tokens
- `response` - User responses to events
- `activity_option` - AI-generated activity options
- `email_log` - Email sending logs
- `user_preferences` - User notification settings
- `notification` - In-app notifications

### 2. Configure Google OAuth

1. Go to **Google Cloud Console** → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID with:
   - Authorized JavaScript origins: `https://go-fish-git-mo-dev-el-muslehs-projects.vercel.app`
   - Authorized redirect URIs: `https://moiajtcnyimeqllextxn.supabase.co/auth/v1/callback`

3. Go to **Supabase** → Authentication → Providers → Google
4. Enable Google and paste your Client ID and Secret

### 3. Deploy Edge Functions

Deploy via GitHub Actions (automatic) or CLI:

```bash
npm install -g supabase
npx supabase functions deploy --project-ref moiajtcnyimeqllextxn
```

Required secrets in GitHub:
- `SUPABASE_ACCESS_TOKEN` - Your Supabase access token

### 4. Configure Redirect URLs

In Supabase → Authentication → URL Configuration:
- Site URL: `https://go-fish-git-mo-dev-el-muslehs-projects.vercel.app`
- Redirect URLs:
  - `https://go-fish-git-mo-dev-el-muslehs-projects.vercel.app/**`
  - `http://localhost:5173/**`
  - `http://localhost:3000/**`

## GitHub Actions Workflow

The CI pipeline runs on every push to `main` or `Mo-Dev`:

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Test     │───▶│  Frontend   │───▶│  Deploy Functions    │───▶│ Deploy Frontend │
│ (build,    │    │ (lint,      │    │  to Supabase         │    │ to Vercel       │
│  test,     │    │  build,     │    │                      │    │                 │
│  audit)    │    │  audit)     │    │                      │    │                 │
└─────────────┘    └─────────────┘    └──────────────────────┘    └─────────────────┘
```

### Required GitHub Secrets

| Secret | Where to get |
|--------|--------------|
| `VERCEL_TOKEN` | Vercel Dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel Dashboard → Account Settings → General |
| `VERCEL_PROJECT_ID` | Vercel Dashboard → Project → Settings → General |
| `SUPABASE_ACCESS_TOKEN` | Supabase Dashboard → Account → Access Tokens |

## Function Endpoints

| Endpoint | Function |
|----------|----------|
| `/api/auth/*` | auth |
| `/api/events/*` | events |
| `/api/invite/*` | invite |
| `/api/events/:id/responses` | responses |
| `/api/notifications/*` | notifications |
| `/api/taste-benchmark/*` | taste-benchmark |

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://moiajtcnyimeqllextxn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_4XUEzFKVrfB62393Jc_aNw_868A81Tx
```

### Supabase Edge Functions (auto-configured)
- `SUPABASE_URL` - Set automatically by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Set in Supabase Dashboard → Settings → API

## Vercel Configuration

The `vercel.json` proxies `/api/*` requests to Supabase Edge Functions:

```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "framework": "vite",
  "routes": [
    {
      "src": "/api/(.*)",
      "destination": "https://moiajtcnyimeqllextxn.supabase.co/functions/v1/api/$1"
    }
  ]
}
```

## Troubleshooting

### Edge Function Not Found
- Ensure all functions are deployed: `npx supabase functions deploy`
- Check function names match in supabase/functions/*

### CORS Errors
- Verify redirect URLs in Supabase dashboard
- Check CORS headers in function code

### Auth Errors
- Ensure Google OAuth is configured in both Google Console and Supabase
- Verify site URL matches in Supabase settings

### Database Empty
- Run migrations in Supabase SQL Editor (supabase/migrations/00_combined_schema.sql)
- Verify connection string is correct in Edge Functions

## Development

### Local Development

1. **Frontend**: `cd client && npm run dev`
2. **Database**: Use Docker or local Supabase instance
3. **Edge Functions**: Not supported locally, deploy to test

### Adding New Edge Functions

1. Create new function in `supabase/functions/<name>/index.ts`
2. Deploy with `npx supabase functions deploy`
3. Add route in `vercel.json` if needed
