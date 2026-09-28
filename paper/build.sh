#!/usr/bin/env bash
# Compile a paper source (paper/<NAME>.tex → paper/<NAME>.pdf) using tectonic.
#
# Usage:
#   ./paper/build.sh                     # build paper/ieee_draft.tex (IEEE paper)
#   ./paper/build.sh --open              # build then open in default viewer (macOS)
#   ./paper/build.sh --regen             # regenerate figures + tables first, then build
#   ./paper/build.sh ieee_draft --regen  # regenerate IEEE figures, then build
#
# To edit the LaTeX and rebuild:
#   1) edit paper/<NAME>.tex (or any figure script)
#   2) run this script

set -euo pipefail

PAPER_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$PAPER_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

REGEN=0
OPEN_AFTER=0
TARGET="ieee_draft"
for arg in "$@"; do
    case "$arg" in
        --regen) REGEN=1 ;;
        --open)  OPEN_AFTER=1 ;;
        --help|-h)
            sed -n '2,12p' "$0"; exit 0 ;;
        -*) echo "Unknown flag: $arg" >&2; exit 2 ;;
        *) TARGET="$arg" ;;
    esac
done
if [ ! -f "$PAPER_DIR/${TARGET}.tex" ]; then
    echo "ERROR: $PAPER_DIR/${TARGET}.tex not found." >&2
    exit 2
fi

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
    if ls studio/results/*.json >/dev/null 2>&1; then
        .venv/bin/python scripts/export_cross_model_tables.py >/dev/null
    else
        echo "[paper] no saved RAG Atlas results; keeping existing GLM 5.3 Flash tables."
    fi
    .venv/bin/python scripts/make_paper_figures_ieee.py >/dev/null
    echo "[paper] figures and tables refreshed."
fi

echo "[paper] compiling paper/${TARGET}.tex with tectonic..."
cd "$PAPER_DIR"
tectonic -X compile "${TARGET}.tex" --keep-logs --keep-intermediates -o "$PAPER_DIR"

if [ -f "$PAPER_DIR/${TARGET}.pdf" ]; then
    SIZE=$(du -h "$PAPER_DIR/${TARGET}.pdf" | cut -f1)
    PAGES=$(pdfinfo "$PAPER_DIR/${TARGET}.pdf" 2>/dev/null | awk '/^Pages/ {print $2}' || echo "?")
    echo "[paper] ✓ built ${TARGET}.pdf  (${SIZE}, ${PAGES} pages)"
    if [ "$OPEN_AFTER" = "1" ]; then
        open "$PAPER_DIR/${TARGET}.pdf"
    fi
else
    echo "[paper] ✗ ${TARGET}.pdf not produced — see ${TARGET}.log for errors."
    exit 1
fi
