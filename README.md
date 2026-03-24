<p align="center">
  <img src="./client/public/logo.png" alt="Go Fish logo" width="120" />
</p>

<h1 align="center">Go Fish</h1>

<p align="center">
  AI-assisted group activity planning for people who want to make a decision fast.
</p>

<p align="center">
  <a href="https://github.com/el-musleh/Go-Fish/actions/workflows/ci.yml">
    <img src="https://github.com/el-musleh/Go-Fish/actions/workflows/ci.yml/badge.svg" alt="CI status" />
  </a>
  <a href="https://github.com/el-musleh/Go-Fish/actions/workflows/deploy-railway.yml">
    <img src="https://github.com/el-musleh/Go-Fish/actions/workflows/deploy-railway.yml/badge.svg" alt="Railway deploy status" />
  </a>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a>
  ·
  <a href="#stack"><strong>Stack</strong></a>
  ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

Go Fish helps a group get from "we should do something" to a confirmed plan. One person creates an event, shares a single invite link, collects everyone's availability and preferences, reviews AI-ranked suggestions, and finalizes the activity with email confirmation to the group.

## Why It Exists

Planning a shared activity usually breaks down into the same problems:

- too many chat messages
- unclear availability
- no structured way to compare preferences
- no obvious final decision owner

Go Fish turns that into one lightweight workflow.

## Core Flow

1. Create an event with a title, description, city, and response window.
2. Share one invite link with the group.
3. Collect availability and taste benchmarks from participants.
4. Generate ranked activity options based on overlap and preferences.
5. Pick the final option and notify the group by email.

## Highlights

- Event creation with response windows and shareable invite links
- Structured availability collection for invitees
- Preference benchmarking to improve recommendation quality
- AI-assisted option generation for the organizer
- Finalized event emails sent to participants
- CI on every pull request and automatic deploys from `main`

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript, React Router |
| Backend | Express, TypeScript |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| AI | OpenRouter |
| Email | Resend |
| Infrastructure | Docker, GitHub Actions, Railway |

## Quick Start

1. Copy the environment template and fill in your API keys.

```bash
cp .env.example .env
```

2. Start all services with the one-command launcher.

```bash
./start.sh
```

The script handles everything: installing dependencies, starting the Postgres container, and launching the backend and frontend. Press **Ctrl+C** to stop all services. To stop only the database container independently, run `./start.sh stop`.

3. Open the app.

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- PostgreSQL: `localhost:5433`

**Requirements:** Node.js 18+, npm, Docker (with Compose plugin), curl.

## Required Environment Variables

For the full application flow, configure these values in `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | AI provider key for option generation |
| `OPENROUTER_MODEL` | Optional explicit model override |
| `RESEND_API_KEY` | Transactional email provider key |
| `RESEND_FROM` | Verified sender identity |

Optional enrichment keys:

- `GOOGLE_PLACES_API_KEY`
- `TICKETMASTER_API_KEY`
- `OPENWEATHERMAP_API_KEY`
- `FOURSQUARE_API_KEY`

## Local Development

The recommended way to run the full stack locally is `./start.sh` (see Quick Start above). It installs dependencies, starts Postgres via Docker, and runs the backend and frontend with live-reload.

To run services individually:

```bash
# Backend (port 3000)
npm install
npm run dev

# Frontend (port 5173) — in a separate terminal
cd client
npm install --legacy-peer-deps
npm run dev
```

Production builds:

```bash
npm run build
cd client && npm run build
```

## Repository Layout

```text
client/   React application
src/      Express API, routes, services, and persistence layer
.github/  CI and deployment workflows
docs/     Supporting project notes
```

## Deployment

- Pull requests into `main` run the `CI` workflow
- Successful pushes to `main` trigger `Deploy to Railway`
- Railway deploys both the `backend` and `client` services

## Current Version

`1.6.0`
