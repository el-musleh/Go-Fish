# Go Fish

Group activity finder — help your crew decide what to do together.

**Version:** 1.6.0

## Quick Start

```bash
docker compose up --build -d
```

- **Client:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Database:** PostgreSQL on port 5433

## CI

GitHub Actions runs on every pull request to `main` and every push to `main`.

- Backend: `npm ci`, `npm run build`, `npm test`
- Frontend: `npm ci` in `client/`, then `npm run build`

This gives you a basic merge gate before Railway deploys changes from `main`.
