# Go Fish

Go Fish is a premium-minimal event coordination MVP: one inviter creates an event, invitees answer a taste benchmark and their availability, and a Gemini-powered worker proposes the top three activities for the super user to finalize.

## Stack

- `apps/web`: Next.js 16 App Router frontend
- `apps/api`: Fastify + Better Auth + Prisma backend
- `apps/worker`: Node.js worker using LangChain with Gemini `gemini-3-flash-preview`
- `packages/contracts`: shared Zod schemas and API contracts
- `packages/database`: Prisma schema and generated client
- `packages/ui`: shared UI primitives

## Product scope

- Inviter flow: create event, get a single join link directly on the page, share that link yourself in WhatsApp/iMessage/email, review generated options, finalize one option, send the final email to everyone.
- Invitee flow: open link, sign in, complete the 10-question taste benchmark on first sign-in, then submit available dates.
- AI flow: worker checks every 5 minutes whether all invitees responded or the 24-hour deadline passed, then generates exactly 3 event options.

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Fill the required values in `.env`:

- `BETTER_AUTH_SECRET`
- `GOOGLE_API_KEY` for real Gemini generation
- `GO_FISH_ENABLE_TEST_LOGINS=true` to keep the local password test users active

4. Push the Prisma schema:

```bash
pnpm db:push
```

5. Start the services in three terminals:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

The web app runs on `http://localhost:3000`, the API on `http://localhost:8787`, and Mailpit on `http://localhost:8025` when configured.

## Docker backend

The backend stack is containerized with Postgres, Mailpit, the API, and the worker.

```bash
docker compose up --build
```

This starts:

- Postgres on `localhost:5432`
- Mailpit SMTP on `localhost:1025`
- Mailpit UI on `http://localhost:8025`
- API on `http://localhost:8787`

Run the frontend separately on the host:

```bash
pnpm dev:web
```

`docker-compose.yml` reads `GOOGLE_API_KEY`, `RESEND_API_KEY`, and related overrides from your shell environment when present.

## Scripts

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:push
```

## Notes

- The worker defaults to Gemini `gemini-3-flash-preview` via LangChain.
- Local password test users are seeded automatically when `GO_FISH_ENABLE_TEST_LOGINS=true`: `testuser / testuser` and `testuser2 / testuser2`.
- If `GOOGLE_API_KEY` is missing and `GO_FISH_ALLOW_HEURISTIC_FALLBACK=true`, the worker uses a deterministic fallback generator for local demos.
- Final event emails are sent through Resend when `RESEND_API_KEY` is present; otherwise the app falls back to SMTP, which maps cleanly to Mailpit in local development.
