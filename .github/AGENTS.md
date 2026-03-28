# Repository Guidelines

## Project Structure & Module Organization

Go Fish is a TypeScript monorepo with two separately deployed layers:

- `client/` — React 19 frontend (Vite, TailwindCSS v4, React Router v7, Supabase Auth)
- `src/` — Express 5 backend with a layered architecture: `routes/` → `services/` → `repositories/` → `db/`
- `supabase/functions/` — Supabase Edge Functions (separate deploy target from the Express backend)
- `supabase/migrations/` — database schema migrations

The backend and frontend have separate `package.json`, `tsconfig.json`, and test suites. The `src/services/decisionAgent/` directory contains the LangGraph-based AI pipeline for ranking activity suggestions.

## Build, Test, and Development Commands

**Quick start (recommended):**
```bash
cp .env.example .env   # fill in required API keys
./start.sh             # installs deps, starts Postgres via Docker, runs both dev servers
```

**Run services individually:**
```bash
# Backend (port 3000)
npm install
npm run dev

# Frontend (port 5173) — separate terminal
cd client
npm install --legacy-peer-deps   # required — .npmrc enforces this
npm run dev
```

**Build:**
```bash
npm run build:all       # backend + frontend
npm run build           # backend only
cd client && npm run build
```

**Test:**
```bash
npm test                # backend (vitest --run)
cd client && npx vitest --run  # frontend
```

To run a single test file:
```bash
npm test -- src/services/decisionAgent.test.ts
cd client && npx vitest run src/test/MyComponent.test.tsx
```

**Lint & format (client only):**
```bash
cd client && npm run lint          # zero warnings allowed
cd client && npm run lint:fix
cd client && npm run format        # Prettier write
cd client && npm run format:check
```

## Coding Style & Naming Conventions

Both layers use TypeScript with `"strict": true`.

**Backend** (`tsconfig.json`): ES2020 target, Node16 module resolution.

**Frontend** (`client/tsconfig.json`): ES2023 target, bundler module resolution, with `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` enforced.

**Prettier** (`client/.prettierrc`): single quotes, semicolons, 2-space indent, trailing commas (ES5), 100-char print width.

**ESLint** (`client/eslint.config.js`): `typescript-eslint` recommended + `eslint-config-prettier` + `react-hooks` recommended. CI enforces `--max-warnings=0`.

## Testing Guidelines

Both layers use **vitest**. Backend tests live in `src/` alongside source files (`*.test.ts`). Frontend tests live in `client/src/test/` using `@testing-library/react` with `jsdom`.

## Commit & Pull Request Guidelines

Commits follow **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `chore(deps):`.

The pre-commit hook (Husky + lint-staged) runs on `client/` staged files, auto-fixing and formatting `.ts/.tsx/.css/.json` before every commit.

CI runs on every pull request. Merging to `main` triggers automatic deployment: backend to Railway, frontend to Vercel.

## Git Merge Best Practices

**NEVER use `git checkout --theirs .` or `git checkout --theirs <files>` to resolve merge conflicts.** This command replaces ALL files with the remote version, which can cause:
- Lost local features and implementations
- Broken builds due to missing dependencies
- Removed components and utilities
- Inconsistent state across the codebase

**Instead, resolve conflicts properly:**

1. **For each conflict**, use `git checkout --ours <file>` for files you want to keep local changes in, or manually edit to keep both changes
2. **After resolving**, mark as resolved: `git add <resolved-files>`
3. **Never revert all changes** - fix lint errors individually rather than discarding entire features
4. **Test after merge**: Always run `npm run build` (backend) and `cd client && npm run build` (frontend) before committing

**If you've made a mistake:**
- `git reflog` shows recent HEAD changes
- Find the last good state: `git reflog | head -20`
- Reset to a known good commit: `git reset --hard <good-commit-hash>`

**Finding the last working commit:**
- Look for commits with passing CI (green checks)
- Check commit messages for working features
- The commit hash `ca6a6da` is a known working state with AI model selection
