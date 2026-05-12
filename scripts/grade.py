"""Human-grading helper for a run.

Two modes:
  --emit       (default) Write `runs/<id>/review.md` with every prediction next
               to its gold answer + auto-grade. User reads, optionally marks
               disagreements, and runs the same script with --apply.

  --verify     For any question whose gold span is contested, grep the corpus
               and print the matching context. Useful when the user thinks the
               gold answer is wrong.

Usage:
    python scripts/grade.py runs/<run_id>                  # default: --emit
    python scripts/grade.py runs/<run_id> --verify hop-04  # grep corpus for the disputed gold
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ragureap.data.corpus import load_corpus
from ragureap.eval.metrics import grade_one


def emit_review(run_dir: Path) -> Path:
    preds_path = run_dir / "predictions.jsonl"
    if not preds_path.is_file():
        raise FileNotFoundError(f"{preds_path} not found")

    rows = [json.loads(l) for l in preds_path.read_text().splitlines() if l.strip()]
    out = run_dir / "review.md"
    lines: list[str] = []
    lines.append(f"# Manual grading review — `{run_dir.name}`\n")
    lines.append(
        "Auto-grades shown; if you disagree, edit the `correct` column on a line "
        "and the agent will reconcile (and grep-verify) when prompted.\n"
    )
    lines.append("| QID | Type | Gold | Prediction | Auto EM | Auto F1 | Correct? |")
    lines.append("|---|---|---|---|---|---|---|")
    correct = 0
    for r in rows:
        g = grade_one(r["qid"], r["type"], r["prediction"], r["gold_answer"])
        ok = "✓" if g.correct else "✗"
        if g.correct:
            correct += 1
        gold = r["gold_answer"].replace("|", "\\|")
        pred = r["prediction"].replace("|", "\\|").replace("\n", " ")[:120]
        lines.append(
            f"| `{r['qid']}` | {r['type']} | {gold} | {pred} | {int(g.em)} | {g.f1:.2f} | {ok} |"
        )
    lines.append("")
    lines.append(f"**Auto-grade total: {correct}/{len(rows)} correct ({100 * correct / len(rows):.1f}%).**")
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def verify_gold(qid: str, eval_set_path: Path, corpus_dir: Path, n_context: int = 80) -> None:
    """Grep the corpus for the gold span and print surrounding context."""
    eval_set = [json.loads(l) for l in eval_set_path.read_text().splitlines() if l.strip()]
    q = next((x for x in eval_set if x["id"] == qid), None)
    if q is None:
        print(f"No question with id {qid!r} in {eval_set_path}")
        return

    print(f"QID: {q['id']}")
    print(f"Type: {q['type']}")
    print(f"Question: {q['question']}")
    print(f"Gold: {q['gold_answer']}")
    print(f"Source doc: {q.get('source_doc') or '(none)'}")
    span = q.get("source_span")
    if span is None:
        print("No source_span recorded; cannot grep.")
        return

    docs = load_corpus(corpus_dir)
    text = "\n".join(d.text for d in docs)
    idx = text.find(span)
    if idx < 0:
        print(f"\n[!] source_span not found verbatim in corpus: {span!r}")
        return
    start = max(0, idx - n_context)
    end = min(len(text), idx + len(span) + n_context)
    snippet = text[start:end]
    print(f"\nContext around gold span:\n---\n…{snippet}…\n---")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Grading helper.")
    parser.add_argument("run_dir", type=Path, help="Path to runs/<run_id>/")
    parser.add_argument("--verify", default=None, help="Grep-verify a specific QID's gold span.")
    parser.add_argument(
        "--eval-set", default=Path("tests/eval_set.jsonl"), type=Path,
        help="Path to eval_set.jsonl (used by --verify).",
    )
    parser.add_argument(
        "--corpus-dir", default=Path("data/eval_corpus"), type=Path,
        help="Corpus dir (used by --verify).",
    )
    args = parser.parse_args(argv)

    if args.verify:
        verify_gold(args.verify, args.eval_set, args.corpus_dir)
        return 0

    out = emit_review(args.run_dir)
    print(f"Review file written: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
