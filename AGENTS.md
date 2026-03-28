# Repository Guidelines

## Project Overview

Go Fish is a full-stack TypeScript app that helps groups plan activities together. Users create events, collect availability from invitees, and an AI agent generates ranked activity suggestions. Stack: React 19 + Vite (frontend), Express 5 + Node.js (backend), PostgreSQL 16, Supabase Auth, LangChain/LangGraph + OpenRouter (AI).

## Project Structure & Module Organization

```
client/src/       React frontend — pages/, components/, hooks/, api/, styles/
src/routes/       Express routers — each exported as createXxxRouter(pool)
src/repositories/ SQL abstraction layer — one file per table
src/services/     Business logic (AI agent, email, scheduler, notifications)
src/models/       TypeScript interfaces only (User, Event, EventStatus, etc.)
src/db/           pg.Pool connection + sequential migration runner
src/middleware/   auth.ts (JWT verification), tasteBenchmarkGate.ts
```

**Key wiring:** `src/index.ts` connects to Postgres, runs migrations, then calls `mountRoutes(pool)` in `src/app.ts`. Every router receives `pool` and constructs its own `requireAuth` middleware from it. The Vite dev server proxies `/api/*` to `localhost:3000`.

**Auth flow:** Supabase JWT → `supabase.auth.getUser()` → email lookup in `user` table → `req.userId`. In local dev without Supabase credentials the middleware accepts an `x-user-id` header instead.

**Event lifecycle:** `collecting` → `generating` → `options_ready` → `finalized`. Status transitions are atomic via `transitionEventStatus(pool, id, from, to)`.

## Build, Test, and Development Commands

```bash
./start.sh              # Start everything (DB, backend, frontend) — preferred
./start.sh --quick      # Skip type-check validation
npm run dev             # Backend only (ts-node, port 3000)
cd client && npm run dev  # Frontend only (Vite, port 5173)
```

```bash
npm test                          # Backend tests (Vitest, node env)
cd client && npm test             # Frontend tests (Vitest, jsdom env)
npx vitest run src/routes/eventRouter.test.ts  # Single backend test file
```

```bash
npm run build           # Compile backend TypeScript → dist/
npm run build:all       # Backend + frontend
cd client && npm run build        # Frontend Vite build
```

```bash
cd client && npm run lint         # ESLint (0 warnings allowed)
cd client && npm run lint:fix     # Auto-fix
cd client && npm run format       # Prettier
```

Local database runs via Docker Compose on port 5433. Required env vars are in `.env.example` (root) and `client/.env.example`.

## Coding Style & Naming Conventions

- **Prettier** (client): 100-char line width, single quotes, 2-space indent, trailing commas (`es5`). Config: `client/.prettierrc`.
- **ESLint** (client): typescript-eslint + react-hooks plugin, 0 warnings enforced. Config: `client/eslint.config.js`.
- **TypeScript strict mode** on both sides. Client additionally enables `noUnusedLocals`, `noUnusedParameters`.
- Routers export a factory function: `export function createFooRouter(pool: Pool): Router`.
- Repositories export named async functions; no classes.
- React state initialized from `localStorage` via `useState(() => ...)` lazy initializer — do not read `localStorage` inside `useEffect` and call `setState` synchronously (triggers lint error `react-hooks/set-state-in-effect`).

## Testing Guidelines

- **Backend:** Vitest + supertest for HTTP-level integration tests. `fast-check` for property-based tests (`*.property.test.ts`). Test timeout: 120 s.
- **Frontend:** Vitest + `@testing-library/react` + jsdom. Setup file: `client/src/test/setup.ts`.
- Test files live alongside source (`src/routes/eventRouter.test.ts`, etc.).
- Run a single file: `npx vitest run <path>` (backend) or `cd client && npx vitest run <path>` (frontend).

## Commit & Pull Request Guidelines

Follow Conventional Commits — prefix every message:

```
feat:   new user-visible functionality
fix:    bug corrections
chore:  dependency bumps, tooling, config
```

Messages are lowercase, imperative, descriptive. No scope parentheses unless referencing a PR (`(#45)`). The pre-commit hook runs `lint-staged` on `client/` — ESLint + Prettier must pass before a commit lands.
