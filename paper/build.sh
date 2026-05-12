#!/usr/bin/env bash
# Compile paper/draft.tex → paper/draft.pdf using tectonic.
#
# Usage:
#   ./paper/build.sh               # standard build
#   ./paper/build.sh --open        # build then open in default viewer (macOS)
#   ./paper/build.sh --regen       # regenerate figures + tables first, then build
#
# To edit the LaTeX and rebuild:
#   1) edit paper/draft.tex (or any figure script)
#   2) run this script

set -euo pipefail

PAPER_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$PAPER_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

REGEN=0
OPEN_AFTER=0
for arg in "$@"; do
    case "$arg" in
        --regen) REGEN=1 ;;
        --open)  OPEN_AFTER=1 ;;
        --help|-h)
            sed -n '2,12p' "$0"; exit 0 ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

if [ ! -x ".venv/bin/python" ]; then
    echo "ERROR: .venv/bin/python not found. Run \`make install\` first." >&2
    exit 1
fi

if ! command -v tectonic >/dev/null; then
    echo "ERROR: tectonic is not installed."
    echo "  Install with: brew install tectonic"
    exit 1
fi

if [ "$REGEN" = "1" ]; then
    echo "[paper] regenerating sweep aggregates + figures..."
    .venv/bin/python scripts/aggregate_seeds.py >/dev/null
    .venv/bin/python scripts/make_paper_figures.py >/dev/null
    .venv/bin/python scripts/make_paper_figures_extra.py >/dev/null
    echo "[paper] figures and tables refreshed."
fi

echo "[paper] compiling paper/draft.tex with tectonic..."
cd "$PAPER_DIR"
tectonic -X compile draft.tex --keep-logs --keep-intermediates -o "$PAPER_DIR"

if [ -f "$PAPER_DIR/draft.pdf" ]; then
    SIZE=$(du -h "$PAPER_DIR/draft.pdf" | cut -f1)
    PAGES=$(.venv/bin/python -c "
import re, sys
with open('$PAPER_DIR/draft.log', errors='ignore') as f:
    text = f.read()
m = re.search(r'Output written.*\\((\\d+) pages', text)
print(m.group(1) if m else '?')
" 2>/dev/null || echo "?")
    echo "[paper] ✓ built draft.pdf  (${SIZE}, ${PAGES} pages)"
    if [ "$OPEN_AFTER" = "1" ]; then
        open "$PAPER_DIR/draft.pdf"
    fi
else
    echo "[paper] ✗ draft.pdf not produced — see draft.log for errors."
    exit 1
fi
