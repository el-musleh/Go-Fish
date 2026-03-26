# Go Fish — System Architecture

> **Purpose:** This document explains how all parts of Go Fish fit together — what each service does, how they communicate, how data flows through the system, and how the app is deployed.

---

## Table of Contents

1. [What Go Fish Does](#1-what-go-fish-does)
2. [High-Level System Overview](#2-high-level-system-overview)
3. [Service Descriptions](#3-service-descriptions)
4. [Authentication Flow](#4-authentication-flow)
5. [Data Model](#5-data-model)
6. [API Routes](#6-api-routes)
7. [Local Development vs Production](#7-local-development-vs-production)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Startup Sequence](#9-startup-sequence)

---

## 1. What Go Fish Does

Go Fish solves the "where do we go?" problem for groups. One person creates an event, shares a single invite link, and the app collects everyone's availability and activity preferences. An AI model ranks activity suggestions based on the group's overlap, and the organiser picks one — triggering a confirmation email to all participants.

**Core workflow:**

```
Organiser                 Invitees                   AI / Email
─────────                 ────────                   ──────────
Create event  ──────────► Accept invite
Share link                Submit availability
                          Complete taste benchmark
                                                      Generate ranked options
Review options
Pick final option ──────────────────────────────────► Send confirmation emails
```

---

## 2. High-Level System Overview

```mermaid
graph TB
  subgraph Browser["User's Browser"]
    FE["React SPA\n(Vite · React Router · Tailwind)"]
  end

  subgraph Railway["Railway — Production"]
    CLIENT["client service\nnginx:alpine\nserves static build\nproxies /api/*"]
    BACKEND["backend service\nnode:20-alpine\nExpress API\nPort 3000"]
    PG[("PostgreSQL\n(DATABASE_URL)")]
  end

  subgraph Supabase["Supabase — Managed Auth"]
    SUPA_AUTH["Supabase Auth\nJWT · Google OAuth\nemail/password"]
  end

  subgraph AI["AI Providers"]
    OR["OpenRouter\n(primary)"]
    GM["Gemini / DeepSeek\n(fallback)"]
  end

  subgraph Email["Email Providers"]
    RS["Resend\n(primary)"]
    BV["Brevo\n(fallback)"]
  end

  subgraph EnrichAPIs["Enrichment APIs"]
    GP["Google Places"]
    TM["Ticketmaster"]
    WX["OpenWeatherMap"]
    FS["Foursquare"]
  end

  FE -- "loads app assets" --> CLIENT
  CLIENT -- "proxy /api/*\n(nginx reverse proxy)" --> BACKEND
  FE -- "signIn / signUp\nOAuth redirect" --> SUPA_AUTH
  BACKEND -- "verify JWT\n(service role key)" --> SUPA_AUTH
  BACKEND -- "SQL queries\n(pg Pool)" --> PG
  BACKEND -- "generate ranked\nactivity options" --> OR
  OR -. "fallback" .-> GM
  BACKEND -- "send confirmation\nemails" --> RS
  RS -. "fallback" .-> BV
  BACKEND -- "venue · event\n· weather data" --> GP
  BACKEND --> TM
  BACKEND --> WX
  BACKEND --> FS
```

---

## 3. Service Descriptions

### 3.1 client (nginx)

| Property | Value |
|---|---|
| Technology | nginx:alpine + static React/Vite build |
| Responsibility | Serve the compiled SPA and proxy all `/api/*` traffic to the backend |
| Port | 3000 (internal Railway) |
| Build | Multi-stage Docker build: Node 20 compiles TypeScript + Vite, output copied to nginx |
| Key file | `client/nginx.conf.template` |

The nginx config has two location blocks:

```nginx
location /api {
    proxy_pass ${BACKEND_URL};   # → backend service
}
location / {
    try_files $uri /index.html;  # SPA fallback
}
```

This means the browser only ever talks to **one hostname**. There are no CORS issues because `/api` is a same-origin proxy, not a cross-origin request.

---

### 3.2 backend (Express API)

| Property | Value |
|---|---|
| Technology | Node.js 20, Express 4, TypeScript |
| Responsibility | All business logic, data persistence, auth verification, AI orchestration, email dispatch |
| Port | 3000 |
| Build | `tsc` compiles `src/` → `dist/`, run with `node dist/index.js` |
| Key file | `src/app.ts` (route mounting), `src/index.ts` (startup) |

**Route map:**

| Prefix | Router | Purpose |
|---|---|---|
| `/api/auth` | `authRouter` | Sign-in, profile CRUD |
| `/api/events` | `eventRouter` | Create / list / update events |
| `/api/events/:id/responses` | `responseRouter` | Invitee availability |
| `/api/invite` | `inviteRouter` | Resolve invite tokens |
| `/api/taste-benchmark` | `tasteBenchmarkRouter` | Preference questionnaire |
| `/health` | inline | Health check (no auth) |
| `*` | static files | Serves `client/dist` if present (used when frontend is co-located) |

---

### 3.3 PostgreSQL

| Property | Value |
|---|---|
| Technology | PostgreSQL 16 |
| Local | `postgres:16-alpine` Docker container, port 5433 |
| Production | Injected via `DATABASE_URL` environment variable (Railway plugin or Supabase) |
| Schema management | Custom SQL migration runner (`src/db/migrate.ts`) |
| Connection | `pg.Pool` with 5-attempt exponential retry (`src/db/connection.ts`) |

Migrations live in `src/db/migrations/` and are applied automatically on every startup. Applied migrations are tracked in a `schema_migrations` table so each file runs exactly once.

---

### 3.4 Supabase Auth (external)

| Property | Value |
|---|---|
| Technology | Supabase managed service |
| Purpose | Credential storage, JWT issuance, Google OAuth |
| Frontend SDK | `@supabase/supabase-js` (anon key, safe to expose) |
| Backend SDK | `@supabase/supabase-js` (service role key, server-side only) |

Supabase issues a signed JWT on login. The backend verifies every request by calling `supabase.auth.getUser(token)` — it never trusts the token payload without server-side validation.

> **Why Supabase instead of rolling our own auth?**
> Supabase handles password hashing, session management, OAuth redirect flows, and token rotation. None of that complexity lives in Go Fish's codebase.

---

### 3.5 AI (OpenRouter / LangChain)

The backend uses LangChain + LangGraph to orchestrate a multi-step decision agent (`src/services/decisionAgent/`). The agent:

1. Reads the event's collected responses and taste benchmarks.
2. Optionally fetches real-world data (venues, events, weather) from enrichment APIs.
3. Calls an LLM (via OpenRouter) to produce 1–3 ranked `activity_option` rows.

OpenRouter is a unified gateway — swapping the underlying model (DeepSeek, Gemini, etc.) requires only an env-var change.

---

### 3.6 Email (Resend / Brevo)

The backend's `emailService` (`src/services/emailService.ts`) sends transactional emails when an event is finalised. It writes an `email_log` row per recipient and retries up to 3 times on failure.

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
  actor U as User
  participant FE as React Frontend
  participant SB as Supabase Auth
  participant BE as Express Backend
  participant DB as PostgreSQL

  U->>FE: Click "Sign in"
  FE->>SB: supabase.auth.signInWithOtp()<br/>or signInWithOAuth()
  SB-->>FE: JWT access token + user.email

  FE->>BE: POST /api/auth/email<br/>Authorization: Bearer <jwt>
  BE->>SB: supabase.auth.getUser(token)
  SB-->>BE: verified { email }

  BE->>DB: SELECT * FROM "user" WHERE email = ?
  DB-->>BE: row or null

  alt First-time user
    BE->>DB: INSERT INTO "user" (email, auth_provider)
    DB-->>BE: new user row
  end

  BE-->>FE: { userId, email, isNew }
  FE->>FE: Persist userId in localStorage

  Note over FE,BE: Every subsequent API call
  FE->>BE: GET /api/events<br/>Authorization: Bearer <jwt>
  BE->>SB: supabase.auth.getUser(token)
  SB-->>BE: verified email
  BE->>DB: SELECT id FROM "user" WHERE email = ?
  DB-->>BE: userId → attached to req.userId
  BE->>DB: SELECT * FROM event WHERE inviter_id = ?
  DB-->>BE: events
  BE-->>FE: 200 events JSON
```

**Key design points:**

- The backend **never** stores or trusts the Supabase `auth.uid`. It maintains its own `user.id` (UUID) in PostgreSQL and maps Supabase sessions to it via email.
- In local dev / CI, when `SUPABASE_URL` is absent, the middleware falls back to trusting an `x-user-id` header. This lets tests run without a live Supabase project.

---

## 5. Data Model

```mermaid
erDiagram
  USER {
    uuid id PK
    varchar email UK
    varchar name
    enum auth_provider
    boolean has_taste_benchmark
    timestamptz created_at
  }
  TASTE_BENCHMARK {
    uuid id PK
    uuid user_id FK
    jsonb answers
    timestamptz created_at
  }
  EVENT {
    uuid id PK
    uuid inviter_id FK
    varchar title
    text description
    timestamptz response_window_start
    timestamptz response_window_end
    enum status
    varchar location_city
    varchar location_country
    float location_lat
    float location_lng
    date preferred_date
    time preferred_time
    int duration_minutes
    jsonb ai_suggestions
    boolean archived
    timestamptz created_at
  }
  INVITATION_LINK {
    uuid id PK
    uuid event_id FK
    varchar token UK
    timestamptz created_at
  }
  RESPONSE {
    uuid id PK
    uuid event_id FK
    uuid invitee_id FK
    jsonb available_dates
    timestamptz created_at
  }
  ACTIVITY_OPTION {
    uuid id PK
    uuid event_id FK
    varchar title
    text description
    date suggested_date
    varchar suggested_time
    int rank
    boolean is_selected
    text source_url
    varchar venue_name
    varchar price_range
    text weather_note
    text image_url
    timestamptz created_at
  }
  EMAIL_LOG {
    uuid id PK
    uuid event_id FK
    uuid user_id FK
    enum status
    int retry_count
    timestamptz last_attempt
    timestamptz created_at
  }

  USER ||--o| TASTE_BENCHMARK : "has (1 per user)"
  USER ||--o{ EVENT : "organises"
  USER ||--o{ RESPONSE : "submits"
  USER ||--o{ EMAIL_LOG : "receives"
  EVENT ||--o{ INVITATION_LINK : "has"
  EVENT ||--o{ RESPONSE : "collects"
  EVENT ||--o{ ACTIVITY_OPTION : "generates"
  EVENT ||--o{ EMAIL_LOG : "triggers"
```

**Enum values:**

| Enum | Values |
|---|---|
| `auth_provider` | `google`, `email` |
| `event_status` | `collecting` → `generating` → `options_ready` → `finalized` |
| `email_status` | `pending`, `sent`, `failed` |

---

## 6. API Routes

```
GET    /health                                     # liveness probe (no auth)

POST   /api/auth/email                             # upsert user from Supabase JWT
GET    /api/auth/me                                # current user profile
PATCH  /api/auth/me                                # update name
GET    /api/auth/storage-info                      # event / response counts

GET    /api/events                                 # list organiser's events
POST   /api/events                                 # create event
GET    /api/events/:id                             # get event detail
PATCH  /api/events/:id                             # update event
DELETE /api/events/:id                             # archive event
POST   /api/events/:id/generate-options            # trigger AI option generation
POST   /api/events/:id/finalize                    # select winner + send emails

GET    /api/events/:id/responses                   # list responses for event
POST   /api/events/:id/responses                   # submit invitee response

GET    /api/invite/:token                          # resolve invite token → event
POST   /api/invite/:token/join                     # join event as invitee

GET    /api/taste-benchmark                        # get current user's benchmark
POST   /api/taste-benchmark                        # create / update benchmark
```

All routes except `/health` and `/api/invite/:token` (GET) require `Authorization: Bearer <supabase-jwt>`.

---

## 7. Local Development vs Production

```mermaid
graph TB

  subgraph Local["Local Development  (docker-compose + ts-node)"]
    direction LR
    subgraph LocalBrowser["Browser\n:5173"]
      FEL["Vite dev server\n(HMR)"]
    end
    subgraph LocalServices["Docker Compose"]
      BEL["backend\nts-node · :3000\n(live reload)"]
      DBL[("db\npostgres:16-alpine\n:5433")]
    end
    FEL -- "direct HTTP\n:3000" --> BEL
    BEL --> DBL
  end

  subgraph Production["Production  (Railway)"]
    direction LR
    subgraph ProdBrowser["Browser\nhttps://"]
      FEP["nginx\n(static SPA)"]
    end
    subgraph ProdServices["Railway services"]
      BEP["backend\nnode:20-alpine\n(compiled dist/)"]
      DBP[("PostgreSQL\nDATA_BASE_URL")]
      SBP["Supabase Auth\n(external)"]
    end
    FEP -- "proxy /api/*" --> BEP
    BEP --> DBP
    BEP -- "JWT verify" --> SBP
  end
```

| Aspect | Local | Production |
|---|---|---|
| Frontend | Vite dev server (port 5173, HMR) | nginx serving compiled static files |
| Backend | `ts-node` with live reload | `node dist/index.js` (compiled JS) |
| Database | Docker `postgres:16-alpine` on port 5433 | Railway PostgreSQL via `DATABASE_URL` |
| Auth | `x-user-id` header fallback (no Supabase needed) | Supabase JWT verification |
| Networking | Browser → Vite `:5173`, Vite → backend `:3000` | Browser → nginx, nginx proxies `/api` to backend |
| Config | `.env` file | Railway environment variables |
| Startup | `./start.sh` | `npm start` (`node dist/index.js`) |

### Why nginx in production instead of the Express static server?

Express can serve `client/dist` (and does, when `client/dist` exists), but in Railway the `client` and `backend` are **separate services** on separate containers. nginx is lighter for static file serving and handles the `/api` proxy at the edge — the backend container never touches static assets.

---

## 8. CI/CD Pipeline

```mermaid
flowchart TD
  PUSH["git push\n(any branch)"] --> CI

  subgraph CI["CI Workflow — runs on every push + PR"]
    direction LR
    BE_CI["Backend job\n① npm ci\n② tsc build\n③ vitest\n④ npm audit"]
    FE_CI["Frontend job\n① npm ci\n② eslint\n③ prettier check\n④ tsc --noEmit\n⑤ vite build\n⑥ npm audit"]
  end

  CI -->|"both jobs pass\n+ branch = main" | DEPLOY

  subgraph DEPLOY["Deploy Workflow — main branch only"]
    direction LR
    D_BE["railway up backend\n(watches for SUCCESS / FAILED)"]
    D_FE["railway up client\n(watches for SUCCESS / FAILED)"]
  end

  DEPLOY --> RAILWAY[("Railway\nProduction")]
```

**Rules:**

- Every push to **any branch** triggers the CI workflow (build + test + audit).
- The deploy workflow only fires when:
  1. CI passed, **and**
  2. The push was to `main`, **and**
  3. It came from the canonical repository (not a fork).
- Both `backend` and `client` services are deployed **in parallel** as a matrix job.
- The deploy job polls Railway's deployment API until it sees `SUCCESS`, `FAILED`, or `CRASHED` — it does not just fire-and-forget.

---

## 9. Startup Sequence

When the backend container starts (`node dist/index.js`):

```
1. Load .env / environment variables (dotenv)
2. connectWithRetry()
   ├─ Create pg.Pool pointing at DATABASE_URL
   └─ Retry up to 5× (3 s gap) until a connection is acquired
3. runMigrations(pool)
   ├─ CREATE TABLE IF NOT EXISTS schema_migrations
   ├─ Read applied filenames from schema_migrations
   ├─ Read *.sql files from dist/db/migrations/ (sorted)
   └─ For each unapplied file:
       BEGIN → execute SQL → INSERT schema_migrations → COMMIT
4. mountRoutes(pool)
   └─ Attach all Express routers (each receives the pool)
5. app.listen(PORT)
   └─ "Go Fish backend listening on port 3000"
```

If step 2 fails after all retries, the process exits with code 1 and Railway restarts it (configured as `ON_FAILURE` in `railway.json`).
