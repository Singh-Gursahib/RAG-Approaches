#!/usr/bin/env bash
# RAG Atlas — launch the FastAPI backend (:8000) and the Next.js app (:3000) together.
# Usage:  ./studio/run.sh        (from repo root or anywhere)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_PY="$REPO_ROOT/.venv/bin/python"
WEB_DIR="$SCRIPT_DIR/web"

if [[ ! -x "$VENV_PY" ]]; then
  echo "✗ Python venv not found at $REPO_ROOT/.venv"
  echo "  Create it:  python3 -m venv .venv && .venv/bin/pip install -e '.[dev]' -r studio/server/requirements.txt"
  exit 1
fi

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  echo "→ Installing web dependencies (first run)…"
  (cd "$WEB_DIR" && npm install)
fi

cleanup() {
  echo ""
  echo "→ Shutting down RAG Atlas…"
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ Starting FastAPI backend on http://localhost:8000  (docs: /docs)"
(cd "$REPO_ROOT" && "$REPO_ROOT/.venv/bin/uvicorn" studio.server.app.main:app --reload --port 8000) &

echo "→ Starting Next.js app on http://localhost:3000"
(cd "$WEB_DIR" && npm run dev) &

wait
