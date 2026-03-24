#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start.sh — one-command dev launcher for Go Fish
#
# Usage:
#   ./start.sh          start all services
#   ./start.sh stop     stop database container (processes stop on Ctrl+C)
#
# Requirements: Node.js 18+, npm, Docker (with Compose plugin or standalone)
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"
BACKEND_PID=""
FRONTEND_PID=""
TAIL_PID=""

# ── Colors (only when connected to a real terminal) ────────────────────────
if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; DIM=''; NC=''
fi

log()  { echo -e "${GREEN}[go-fish]${NC} $1"; }
warn() { echo -e "${YELLOW}[go-fish] WARN:${NC} $1"; }
die()  { echo -e "${RED}[go-fish] ERROR:${NC} $1" >&2; exit 1; }
step() { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ── Graceful shutdown on Ctrl+C or exit ───────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$TAIL_PID" ]     && kill "$TAIL_PID"     2>/dev/null || true
  ${DOCKER_COMPOSE:-docker compose} stop db 2>/dev/null || true
  log "Done. Logs saved in logs/"
}
trap cleanup EXIT INT TERM

# ── Stop command ───────────────────────────────────────────────────────────
if [ "${1:-}" = "stop" ]; then
  log "Stopping database container..."
  docker compose stop db 2>/dev/null || docker-compose stop db 2>/dev/null || true
  log "Stopped. (Kill any running npm processes manually if needed.)"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════
# 1. Prerequisites
# ═══════════════════════════════════════════════════════════════════════════
step "Checking prerequisites"

command -v node  >/dev/null 2>&1 || die "Node.js not found.\n  → Install from https://nodejs.org (v18 or newer required)"
command -v npm   >/dev/null 2>&1 || die "npm not found.\n  → It comes with Node.js: https://nodejs.org"
command -v docker >/dev/null 2>&1 || die "Docker not found.\n  → Install from https://docs.docker.com/get-docker/"

# Node version check (require 18+)
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ required (you have $(node --version)).\n  → Update at https://nodejs.org"

# Prefer the newer 'docker compose' plugin; fall back to 'docker-compose'
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  die "Docker Compose not found.\n  → Install Docker Desktop or the Compose plugin: https://docs.docker.com/compose/install/"
fi

# Make sure the Docker daemon is actually running
docker info >/dev/null 2>&1 || die "Docker daemon is not running.\n  → Start Docker Desktop (or run: sudo systemctl start docker)"

log "${DIM}node $(node --version) · npm $(npm --version) · $($DOCKER_COMPOSE version --short 2>/dev/null || echo compose)${NC}"

# ═══════════════════════════════════════════════════════════════════════════
# 2. Port conflict check (auto-kill stale processes)
# ═══════════════════════════════════════════════════════════════════════════
pids_on_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null
  elif command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | awk -v port="$1" -F 'pid=' '$0 ~ ":" port " " {split($2, a, ","); print a[1]}'
  fi
}

free_port() {
  local port="$1"
  local pids
  pids=$(pids_on_port "$port")
  if [ -n "$pids" ]; then
    warn "Port $port in use (PIDs: $pids) — killing..."
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    pids=$(pids_on_port "$port")
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
    if [ -n "$(pids_on_port "$port")" ]; then
      die "Could not free port $port. Try: sudo kill -9 \$(lsof -iTCP:$port -sTCP:LISTEN -t)"
    fi
    log "Port $port is now free"
  fi
}

for port in 3000 5173 5433; do
  free_port "$port"
done

# ═══════════════════════════════════════════════════════════════════════════
# 3. Environment (.env)
# ═══════════════════════════════════════════════════════════════════════════
step "Environment"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env created from .env.example — fill in OPENROUTER_API_KEY and RESEND_API_KEY before using those features."
  else
    die ".env file not found and no .env.example to copy from.\n  → Create a .env file (see .env.example in the repo for reference)."
  fi
else
  log ".env found"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4. Dependencies
# ═══════════════════════════════════════════════════════════════════════════
step "Dependencies"

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock-stamp ]; then
  log "Installing backend dependencies..."
  npm install --ignore-scripts
  touch node_modules/.package-lock-stamp
else
  log "Backend dependencies ${DIM}(already installed)${NC}"
fi

if [ ! -d client/node_modules ] || [ client/package-lock.json -nt client/node_modules/.package-lock-stamp ]; then
  log "Installing frontend dependencies..."
  (cd client && npm install --legacy-peer-deps && touch node_modules/.package-lock-stamp)
else
  log "Frontend dependencies ${DIM}(already installed)${NC}"
fi

# ── Git hooks ──────────────────────────────────────────────────────────────
if [ -d .git ]; then
  node node_modules/husky/bin.js 2>/dev/null || true
  chmod +x .husky/pre-commit 2>/dev/null || true
  log "Git hooks installed"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 5. Database
# ═══════════════════════════════════════════════════════════════════════════
step "Database"

log "Starting Postgres container..."
$DOCKER_COMPOSE up -d db

log "Waiting for Postgres to accept connections..."
retries=30
until $DOCKER_COMPOSE exec -T db pg_isready -U gofish -d gofish -q 2>/dev/null; do
  retries=$((retries - 1))
  if [ "$retries" -eq 0 ]; then
    die "Postgres did not become ready.\n  → Check container logs: $DOCKER_COMPOSE logs db"
  fi
  sleep 1
done
log "Postgres is ready"

# ═══════════════════════════════════════════════════════════════════════════
# 6. Backend
# ═══════════════════════════════════════════════════════════════════════════
step "Backend"

mkdir -p "$LOG_DIR"
log "Starting backend (port 3000)..."
npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

log "Waiting for backend to respond..."
retries=30
until curl -sf http://localhost:3000/health >/dev/null 2>&1; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    die "Backend crashed on startup.\n  → Check logs: $LOG_DIR/backend.log\n\n$(tail -20 "$LOG_DIR/backend.log")"
  fi
  retries=$((retries - 1))
  if [ "$retries" -eq 0 ]; then
    die "Backend did not start in time.\n  → Check logs: $LOG_DIR/backend.log"
  fi
  sleep 1
done
log "Backend is ready"

# ═══════════════════════════════════════════════════════════════════════════
# 7. Frontend
# ═══════════════════════════════════════════════════════════════════════════
step "Frontend"

log "Starting frontend (port 5173)..."
(cd client && npm run dev) > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

log "Waiting for Vite to be ready..."
retries=20
until grep -q "ready in" "$LOG_DIR/frontend.log" 2>/dev/null; do
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    die "Frontend crashed on startup.\n  → Check logs: $LOG_DIR/frontend.log\n\n$(tail -20 "$LOG_DIR/frontend.log")"
  fi
  retries=$((retries - 1))
  if [ "$retries" -eq 0 ]; then
    die "Frontend did not start in time.\n  → Check logs: $LOG_DIR/frontend.log"
  fi
  sleep 1
done

# ═══════════════════════════════════════════════════════════════════════════
# Ready
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}  Go Fish is running!${NC}"
echo -e "${DIM}  ──────────────────────────────────────${NC}"
echo -e "  Frontend  →  ${BOLD}http://localhost:5173${NC}"
echo -e "  Backend   →  ${BOLD}http://localhost:3000${NC}"
echo -e "  Database  →  ${DIM}localhost:5433${NC}"
echo -e "${DIM}  ──────────────────────────────────────${NC}"
echo -e "  Logs →  ${DIM}$LOG_DIR/${NC}"
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
echo ""

tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
TAIL_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
