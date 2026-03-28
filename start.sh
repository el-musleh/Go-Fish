#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start.sh — one-command dev launcher for Go Fish
#
# Usage:
#   ./start.sh           start all services
#   ./start.sh --quick   skip type checks
#   ./start.sh --test    run tests before starting
#   ./start.sh --lint    run lint before starting
#   ./start.sh stop      stop all running services
#
# Requirements: Node.js 18+, npm, Docker
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"
SESSION_PID_FILE="$LOG_DIR/start.pid"
BACKEND_PID=""
FRONTEND_PID=""
TAIL_PID=""
DB_WATCHDOG_PID=""
DOCKER_COMPOSE="docker compose"
_CLEANED_UP=false

# ── Flags ───────────────────────────────────────────────────────────────────
RUN_TESTS=false
RUN_LINT=false
QUICK_START=false
for arg in "$@"; do
  case $arg in
    --test)  RUN_TESTS=true ;;
    --lint)  RUN_LINT=true ;;
    --quick) QUICK_START=true ;;
    stop)    : ;;
    *)       echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ── Colors ──────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'
  CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BLUE=''; CYAN=''; MAGENTA=''
  BOLD=''; DIM=''; NC=''
fi

# ── Log helpers — every message carries a timestamp ─────────────────────────
# ts() is a function, not a variable, so it re-evaluates on every call.
ts()     { date '+%H:%M:%S'; }
log()    { echo -e "${GREEN}[$(ts) go-fish]${NC} $1"; }
info()   { echo -e "${BLUE}[$(ts) go-fish]${NC} $1"; }
warn()   { echo -e "${YELLOW}[$(ts) go-fish] WARN:${NC} $1"; }
db_log() { echo -e "${CYAN}[$(ts) go-fish  DB]${NC} $1"; }
step()   { echo -e "\n${BOLD}── $1${NC} ${DIM}[$(ts)]${NC}"; }
die() {
  set +e
  echo -e "\n${RED}${BOLD}[$(ts)] ✖ ERROR:${NC} ${RED}$1${NC}" >&2
  if [ -n "${2:-}" ] && [ -f "$2" ]; then
    echo -e "${DIM}--- last 15 lines of $2 ---${NC}" >&2
    tail -n 15 "$2" | sed 's/^/  /' >&2
  fi
  exit 1
}

# ── Timestamp filter — prepends [HH:MM:SS] to every line written to a file ──
# Usage: some_cmd 2>&1 | ts_filter > logfile
# awk strftime is POSIX-compliant on GNU awk (gawk), which ships with Ubuntu.
ts_filter() {
  awk '{ printf "[%s] %s\n", strftime("%H:%M:%S"), $0; fflush() }'
}

# ── Kill a process and all its descendants ──────────────────────────────────
# Prevents zombie ts-node/vite child processes after Ctrl+C.
kill_tree() {
  local pid="${1:-}"
  [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null && return 0
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

# ── Graceful shutdown — runs exactly once ───────────────────────────────────
cleanup() {
  [ "$_CLEANED_UP" = true ] && return
  _CLEANED_UP=true
  set +e
  echo ""
  log "Shutting down..."
  rm -f "$SESSION_PID_FILE"
  [ -n "$TAIL_PID"        ] && kill "$TAIL_PID"        2>/dev/null
  [ -n "$DB_WATCHDOG_PID" ] && kill "$DB_WATCHDOG_PID" 2>/dev/null
  kill_tree "$BACKEND_PID"
  kill_tree "$FRONTEND_PID"
  [ -n "$DOCKER_COMPOSE" ] && $DOCKER_COMPOSE stop db >/dev/null 2>&1
  log "Done."
}
trap cleanup EXIT INT TERM

# ── Port helpers ─────────────────────────────────────────────────────────────
pids_on_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null
  elif command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null \
      | awk -v p="$1" '$4 ~ ":"p"$" {match($NF,/pid=([0-9]+)/,a); if(a[1]) print a[1]}'
  fi
}

free_port() {
  local pids
  pids=$(pids_on_port "$1") || true
  [ -z "$pids" ] && return
  warn "Port $1 in use (PIDs: $pids) — freeing..."
  echo "$pids" | xargs kill    2>/dev/null || true; sleep 1
  pids=$(pids_on_port "$1") || true
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true; sleep 1
  [ -n "$(pids_on_port "$1")" ] && \
    die "Cannot free port $1.\n  Try: sudo kill -9 \$(lsof -t -i:$1)"
  return 0
}

# ── Dependency staleness check ───────────────────────────────────────────────
needs_install() {
  local dir="$1" lockfile="$2"
  [ ! -d "$dir/node_modules" ] && return 0
  [ ! -f "$dir/node_modules/.install-stamp" ] && return 0
  [ "$lockfile" -nt "$dir/node_modules/.install-stamp" ] && return 0
  return 1
}

# ── Readiness wait helpers ───────────────────────────────────────────────────
wait_http() {
  local url="$1" pid="$2" timeout="${3:-30}"
  for i in $(seq 1 "$timeout"); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    kill -0 "$pid" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

wait_log() {
  local pattern="$1" file="$2" pid="$3" timeout="${4:-30}"
  for i in $(seq 1 "$timeout"); do
    grep -q "$pattern" "$file" 2>/dev/null && return 0
    kill -0 "$pid" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

# ── DB watchdog — restarts the container if health checks fail ───────────────
DB_WATCHDOG_INTERVAL=10   # seconds between health checks
DB_WATCHDOG_MAX_WAIT=30   # seconds to wait for DB after restart

db_watchdog() {
  local fail_streak=0
  while true; do
    sleep "$DB_WATCHDOG_INTERVAL"

    if $DOCKER_COMPOSE exec -T db pg_isready -U gofish -d gofish -q 2>/dev/null; then
      fail_streak=0
      continue
    fi

    fail_streak=$((fail_streak + 1))
    warn "DB health check failed (streak: $fail_streak) — attempting restart..."

    if ! $DOCKER_COMPOSE restart db >/dev/null 2>&1; then
      warn "docker compose restart db failed — will retry next cycle"
      continue
    fi

    db_log "DB container restarting, waiting up to ${DB_WATCHDOG_MAX_WAIT}s..."
    local recovered=false
    for i in $(seq 1 "$DB_WATCHDOG_MAX_WAIT"); do
      if $DOCKER_COMPOSE exec -T db pg_isready -U gofish -d gofish -q 2>/dev/null; then
        recovered=true
        break
      fi
      sleep 1
    done

    if [ "$recovered" = true ]; then
      db_log "Database recovered — backend will reconnect automatically"
      fail_streak=0
    else
      warn "Database did not recover within ${DB_WATCHDOG_MAX_WAIT}s — check: $DOCKER_COMPOSE logs db"
    fi
  done
}

# ── Smart log tailer ─────────────────────────────────────────────────────────
# Log files already contain [HH:MM:SS] timestamps written by ts_filter.
# smart_tail reads those files and adds a color/category prefix only —
# no second timestamp is added.
GEN_PATTERN="(generat|options_ready|shortlist|finaliz|runPlanning|real.world|fetched.*event|fetched.*venue|fetched.*weather|triggerGeneration|decisionAgent|AGENT|agent.*tool|tool.*call|temperature|recursion)"
ERR_PATTERN="(error|Error|ERROR|failed|FAILED|crash|ECONNREFUSED|ENOTFOUND|timeout|Timeout|abort|Abort)"
WARN_PATTERN="(warn|WARN|deprecated|Deprecated)"
OK_PATTERN="(ready|started|connected|success|Success|listening|healthy|online)"

smart_tail() {
  tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" 2>/dev/null | \
  while IFS= read -r line; do
    if echo "$line" | grep -qiE "$GEN_PATTERN"; then
      printf "${MAGENTA}⚡ GEN${NC}  %s\n" "$line"
    elif echo "$line" | grep -qiE "$ERR_PATTERN"; then
      printf "${RED}✖ ERR${NC}  %s\n" "$line"
    elif echo "$line" | grep -qiE "$WARN_PATTERN"; then
      printf "${YELLOW}⚠ WRN${NC}  %s\n" "$line"
    elif echo "$line" | grep -qiE "$OK_PATTERN"; then
      printf "${GREEN}✓ OK ${NC}  %s\n" "$line"
    else
      printf "${DIM}     ${NC}  %s\n" "$line"
    fi
  done
}

# ═══════════════════════════════════════════════════════════════════════════
# Stop command
# ═══════════════════════════════════════════════════════════════════════════
if [ "${1:-}" = "stop" ]; then
  mkdir -p "$LOG_DIR"
  if [ -f "$SESSION_PID_FILE" ]; then
    old_pid=$(cat "$SESSION_PID_FILE" 2>/dev/null || true)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      log "Stopping session (PID $old_pid)..."
      kill "$old_pid" 2>/dev/null || true
      for _ in $(seq 1 6); do
        kill -0 "$old_pid" 2>/dev/null || break
        sleep 1
      done
    fi
    rm -f "$SESSION_PID_FILE"
    log "All services stopped."
  else
    if docker compose version >/dev/null 2>&1; then
      docker compose stop db >/dev/null 2>&1 && log "Database stopped."
    fi
    log "No active session found."
  fi
  trap - EXIT
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════
# Kill any previous session
# ═══════════════════════════════════════════════════════════════════════════
mkdir -p "$LOG_DIR"
if [ -f "$SESSION_PID_FILE" ]; then
  old_pid=$(cat "$SESSION_PID_FILE" 2>/dev/null || true)
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    warn "Previous session still running (PID $old_pid) — stopping it first..."
    kill "$old_pid" 2>/dev/null || true
    sleep 2
  fi
  rm -f "$SESSION_PID_FILE"
fi
echo $$ > "$SESSION_PID_FILE"

# ═══════════════════════════════════════════════════════════════════════════
# 1. Prerequisites
# ═══════════════════════════════════════════════════════════════════════════
step "Prerequisites"

command -v node   >/dev/null 2>&1 || die "Node.js not found. Install: https://nodejs.org"
command -v npm    >/dev/null 2>&1 || die "npm not found. Install: https://nodejs.org"
command -v docker >/dev/null 2>&1 || die "Docker not found. Install: https://docs.docker.com/get-docker/"
command -v awk    >/dev/null 2>&1 || die "awk not found (required for log timestamping)"

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ required (you have $(node --version))"

if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  die "Docker Compose not found. Install: https://docs.docker.com/compose/install/"
fi

docker info >/dev/null 2>&1 || die "Docker daemon is not running.\n  Start it: sudo systemctl start docker"

log "node $(node -v) · npm $(npm -v) · $($DOCKER_COMPOSE version --short 2>/dev/null)"

# ═══════════════════════════════════════════════════════════════════════════
# 2. Port check
# ═══════════════════════════════════════════════════════════════════════════
for port in 3000 5173 5433; do
  free_port "$port"
done

# ═══════════════════════════════════════════════════════════════════════════
# 3. Environment
# ═══════════════════════════════════════════════════════════════════════════
step "Environment & Deps"

if [ ! -f .env ]; then
  [ -f .env.example ] || die ".env not found. Create one (see .env.example)."
  cp .env.example .env
  warn ".env created from .env.example — fill in API keys before using AI/email features."
fi

for var in OPENROUTER_API_KEY RESEND_API_KEY; do
  grep -qE "^${var}=.+" .env 2>/dev/null || warn "${var} not set — related features disabled."
done

# ═══════════════════════════════════════════════════════════════════════════
# 4. Dependencies (only reinstall when lockfile changed)
# ═══════════════════════════════════════════════════════════════════════════
if needs_install "." "package-lock.json"; then
  info "Installing backend dependencies..."
  npm install --ignore-scripts 2>&1 | grep -v "^npm warn" || true
  touch node_modules/.install-stamp
  [ -d .git ] && node node_modules/husky/bin.js 2>/dev/null || true
  [ -d .git ] && chmod +x .husky/pre-commit 2>/dev/null || true
else
  log "Backend deps up to date"
fi

if needs_install "client" "client/package-lock.json"; then
  info "Installing frontend dependencies..."
  (cd client && npm install --legacy-peer-deps 2>&1 | grep -v "^npm warn" || true)
  touch client/node_modules/.install-stamp
else
  log "Frontend deps up to date"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 5. Validation (skip with --quick)
# ═══════════════════════════════════════════════════════════════════════════
if [ "$QUICK_START" = false ]; then
  step "Validation"

  if [ "$RUN_LINT" = true ]; then
    info "Linting..."
    (cd client && node node_modules/eslint/bin/eslint.js src --max-warnings=0) \
      || warn "Lint errors — run: cd client && npm run lint"
  fi

  info "Type checking backend..."
  node node_modules/typescript/bin/tsc --noEmit > "$LOG_DIR/tsc-backend.log" 2>&1 \
    || die "Backend TypeScript errors." "$LOG_DIR/tsc-backend.log"

  info "Type checking frontend..."
  (cd client && node node_modules/typescript/bin/tsc --noEmit) > "$LOG_DIR/tsc-frontend.log" 2>&1 \
    || die "Frontend TypeScript errors." "$LOG_DIR/tsc-frontend.log"

  if [ "$RUN_TESTS" = true ]; then
    info "Running tests..."
    npm test > "$LOG_DIR/test.log" 2>&1 \
      || die "Tests failed." "$LOG_DIR/test.log"
  fi

  log "Validation passed"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 6. Database
# ═══════════════════════════════════════════════════════════════════════════
step "Starting Services"

info "Database..."
$DOCKER_COMPOSE up -d db >/dev/null 2>&1

for i in $(seq 1 30); do
  $DOCKER_COMPOSE exec -T db pg_isready -U gofish -d gofish -q 2>/dev/null && break
  [ "$i" -eq 30 ] && die "Postgres did not become ready.\n  Check: $DOCKER_COMPOSE logs db"
  sleep 1
done
log "Postgres ready (container: $($DOCKER_COMPOSE ps -q db))"

db_watchdog &
DB_WATCHDOG_PID=$!
db_log "Watchdog started (PID $DB_WATCHDOG_PID) — checks every ${DB_WATCHDOG_INTERVAL}s, auto-restarts on failure"

# ═══════════════════════════════════════════════════════════════════════════
# 7. Backend
# ── Output is piped through ts_filter before reaching backend.log so that
#    every line in the file carries a [HH:MM:SS] timestamp.
#    The subshell wrapping the pipeline is what we track as BACKEND_PID:
#    it stays alive as long as npm (and its ts_filter child) is running,
#    and kill_tree on it terminates the whole process group cleanly.
# ═══════════════════════════════════════════════════════════════════════════
info "Backend..."
( npm run dev 2>&1 | ts_filter ) > "$LOG_DIR/backend.log" &
BACKEND_PID=$!
info "Backend starting (PID $BACKEND_PID) — waiting for health check..."

if ! wait_http "http://localhost:3000/health" "$BACKEND_PID"; then
  die "Backend crashed on startup." "$LOG_DIR/backend.log"
fi
log "Backend ready (PID $BACKEND_PID) → http://localhost:3000"

# ═══════════════════════════════════════════════════════════════════════════
# 8. Frontend
# ── Same ts_filter approach as the backend.
# ═══════════════════════════════════════════════════════════════════════════
info "Frontend..."
( cd client && npm run dev 2>&1 | ts_filter ) > "$LOG_DIR/frontend.log" &
FRONTEND_PID=$!
info "Frontend starting (PID $FRONTEND_PID) — waiting for Vite..."

if ! wait_log "Local:" "$LOG_DIR/frontend.log" "$FRONTEND_PID"; then
  die "Frontend crashed on startup." "$LOG_DIR/frontend.log"
fi
log "Frontend ready (PID $FRONTEND_PID) → http://localhost:5173"

# ═══════════════════════════════════════════════════════════════════════════
# Ready
# ═══════════════════════════════════════════════════════════════════════════
echo -e "\n${GREEN}${BOLD}✨ Go Fish is ready!${NC}"
echo -e "${DIM}──────────────────────────────────────${NC}"
echo -e "  Frontend   →  ${BOLD}http://localhost:5173${NC}"
echo -e "  Backend    →  ${BOLD}http://localhost:3000${NC}"
echo -e "${DIM}──────────────────────────────────────${NC}"
echo -e "  Log files  →  logs/backend.log  logs/frontend.log"
echo -e "                (every line timestamped — safe to tail -f directly)"
echo -e "  DB watchdog:  every ${DB_WATCHDOG_INTERVAL}s, auto-restarts on failure"
echo -e "  ${MAGENTA}⚡ GEN${NC}  AI generation  ${GREEN}✓ OK${NC}  ready/success"
echo -e "  ${RED}✖ ERR${NC}  errors         ${YELLOW}⚠ WRN${NC}  warnings"
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop\n"

smart_tail &
TAIL_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
