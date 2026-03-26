# Go Fish — Project Context & Guidelines

Go Fish is a full-stack AI-assisted group activity planning application. It helps groups move from "we should do something" to a confirmed plan by collecting availability and preferences, generating AI-ranked suggestions, and finalizing details via email.

## Project Overview

- **Purpose:** Simplify group decision-making for activities.
- **Frontend:** React (SPA), Vite, TypeScript, Tailwind CSS, Radix UI.
- **Backend:** Node.js, Express, TypeScript.
- **Database:** PostgreSQL (with custom SQL-based migrations).
- **Authentication:** Supabase Auth (JWT-based).
- **AI/LLM:** OpenRouter (gateway for models like Gemini, DeepSeek), LangChain/LangGraph for orchestration.
- **Email:** Resend for transactional emails.
- **Infrastructure:** Docker (local dev), Nginx (production proxy), Railway (deployment).

## Architecture & Directory Structure

```text
/                  Root: Backend source, Docker config, and project-wide scripts.
├── client/        React frontend application (Vite-based).
│   ├── src/       Frontend source (components, hooks, lib, pages, styles).
│   └── public/    Static assets (logo, icons).
├── src/           Backend source (Express API).
│   ├── db/        Database connection and migrations.
│   ├── middleware/ Auth and guard middleware.
│   ├── models/    Database models and TypeScript interfaces.
│   ├── repositories/ Data access layer.
│   ├── routes/    Express routers (auth, event, invite, response, taste benchmark).
│   └── services/  Business logic, AI agents, email service.
├── docs/          Architecture, project documentation, and auth notes.
└── .kiro/         Project specs, requirements, and design docs.
```

## Building and Running

### Quick Start (Integrated)
The easiest way to start the full stack (DB, backend, frontend) is using the integrated script:
```bash
./start.sh
```
This script handles dependency installation, starting the PostgreSQL container, and launching both services.

### Individual Services
- **Backend (Root):**
  - `npm run dev`: Start backend with `ts-node` (hot-reload).
  - `npm run build`: Compile TypeScript to `dist/`.
  - `npm test`: Run backend tests with Vitest.
- **Frontend (client/):**
  - `cd client && npm run dev`: Start Vite development server.
  - `cd client && npm run build`: Build for production.
  - `cd client && npm test`: Run frontend tests with Vitest.

## Development Conventions

### 1. Database & Migrations
- **Technology:** PostgreSQL.
- **Migrations:** Custom runner in `src/db/migrate.ts`.
- **Location:** `src/db/migrations/00X_name.sql`.
- **Note:** Migrations run automatically on backend startup. Always add a new SQL file for schema changes.

### 2. Authentication
- Uses **Supabase Auth**. The frontend handles login and receives a JWT.
- The backend verifies JWTs using `supabase.auth.getUser(token)`.
- Internal users are tracked by a UUID in the `user` table, mapped by email from Supabase.
- In local dev/testing, an `x-user-id` header can bypass Supabase if `SUPABASE_URL` is not set.

### 3. AI Orchestration
- **Core Feature:** `src/services/decisionAgent.ts` uses LangChain/LangGraph.
- It analyzes "Taste Benchmarks" (user preference questionnaires) and collected availability to suggest activities.

### 4. Testing
- **Backend:** Vitest for unit and integration tests (using `supertest` for API).
- **Frontend:** Vitest + React Testing Library.
- **Pattern:** Keep `.test.tsx?` files alongside the source files or in a `test/` subdirectory.

### 5. Coding Style
- **TypeScript:** Strict typing is preferred. Use `Zod` for runtime validation (API request bodies).
- **UI:** Tailwind CSS for styling. Radix UI for accessible primitives.
- **Linting:** ESLint and Prettier are configured in `client/` and the root.

## Deployment
- **Platform:** Railway.
- **Flow:** PRs to `main` trigger CI (GitHub Actions). Merges to `main` trigger automatic deployment.
- **Production Setup:** In production, `client` and `backend` run as separate services. `client` uses Nginx to serve static files and proxy `/api/*` requests to the `backend`.

## Key Files for Reference
- `docs/ARCHITECTURE.md`: Detailed system design and data flow.
- `src/app.ts`: Express setup and route mounting.
- `src/db/connection.ts`: Database pool configuration and retry logic.
- `.kiro/specs/go-fish/requirements.md`: Comprehensive product requirements.
