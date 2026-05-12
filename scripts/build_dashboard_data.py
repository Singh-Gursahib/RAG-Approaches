"""Aggregate everything the Next.js dashboard needs into a single JSON file.

Produces `frontend/web/lib/data.json` consumed at build time by the dashboard.

Run manually after every new experimental run:
    .venv/bin/python scripts/build_dashboard_data.py
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ragureap.analysis import collect_runs, headline_table, per_probe_table, pairwise_significance


OUT_PATH = Path("frontend/web/lib/data.json")


def main() -> None:
    runs = collect_runs(Path("runs"), latest_only=True)
    if not runs:
        raise SystemExit("No runs found under runs/. Run experiments first.")

    # --- Headline & per-probe (mean + bootstrap CI) ---
    headline = headline_table(runs)
    per_probe = per_probe_table(runs)

    # --- Pairwise significance (Holm-corrected) ---
    pairwise_em = pairwise_significance(runs, metric="em")
    pairwise_f1 = pairwise_significance(runs, metric="f1")

    # --- Per-question, per-approach correctness for the Explorer / Compare pages ---
    by_qid: dict[str, dict] = {}
    for key, r in runs.items():
        approach = r["approach"]
        for g in r["grades"]:
            qid = g["qid"]
            if qid not in by_qid:
                by_qid[qid] = {
                    "qid": qid,
                    "type": g["type"],
                    "gold": g["gold"],
                    "predictions": {},
                }
            by_qid[qid]["predictions"][approach] = {
                "pred": g["prediction"],
                "em": int(g["em"]),
                "f1": float(g["f1"]),
                "correct": int(g["correct"]),
            }
    questions = sorted(by_qid.values(), key=lambda q: (q["type"], q["qid"]))

    # --- Win/Loss matrix: % of questions where row beats column on EM ---
    approaches = sorted({r["approach"] for r in runs.values()})
    by_approach = {a: next(r for r in runs.values() if r["approach"] == a) for a in approaches}
    win_matrix: dict[str, dict[str, dict]] = {}
    for a in approaches:
        win_matrix[a] = {}
        a_grades = {g["qid"]: g for g in by_approach[a]["grades"]}
        for b in approaches:
            if a == b:
                win_matrix[a][b] = {"wins": 0, "losses": 0, "ties": 0, "n": 0}
                continue
            b_grades = {g["qid"]: g for g in by_approach[b]["grades"]}
            shared = sorted(set(a_grades) & set(b_grades))
            wins = losses = ties = 0
            for q in shared:
                ea, eb = a_grades[q]["em"], b_grades[q]["em"]
                if ea > eb:
                    wins += 1
                elif eb > ea:
                    losses += 1
                else:
                    ties += 1
            win_matrix[a][b] = {"wins": wins, "losses": losses, "ties": ties, "n": len(shared)}

    # --- Cumulative project spend ---
    ledger_path = Path("runs/.budget_ledger.jsonl")
    cumulative_spend = 0.0
    n_calls = 0
    if ledger_path.is_file():
        for line in ledger_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            cumulative_spend += float(entry.get("cost_usd", 0.0))
            n_calls += 1

    # --- Eval set stats ---
    eval_set_rows = [
        json.loads(l) for l in Path("tests/eval_set.jsonl").read_text().splitlines() if l.strip()
    ]
    probe_counts: dict[str, int] = defaultdict(int)
    for q in eval_set_rows:
        probe_counts[q["type"]] += 1

    # --- Corpus stats ---
    corpus_dir = Path("data/eval_corpus")
    corpus_docs = []
    for p in sorted(corpus_dir.glob("*.txt")):
        text = p.read_text(encoding="utf-8")
        corpus_docs.append({
            "doc_id": p.stem,
            "words": len(text.split()),
            "chars": len(text),
        })

    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": {
            "name": "RAG_Ureap",
            "budget_cap_usd": 5.0,
            "cumulative_spend_usd": round(cumulative_spend, 4),
            "spend_pct": round(cumulative_spend / 5.0 * 100, 2),
            "total_llm_calls": n_calls,
            "model": "gemini-3-flash-preview",
        },
        "corpus": {
            "n_docs": len(corpus_docs),
            "total_words": sum(d["words"] for d in corpus_docs),
            "documents": corpus_docs,
        },
        "eval_set": {
            "n_questions": len(eval_set_rows),
            "by_probe_type": dict(probe_counts),
        },
        "headline": headline.to_dict(orient="records"),
        "per_probe": per_probe.to_dict(orient="records"),
        "pairwise_em": pairwise_em.to_dict(orient="index"),
        "pairwise_f1": pairwise_f1.to_dict(orient="index"),
        "win_matrix": win_matrix,
        "questions": questions,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2, default=float), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(f"  {len(headline)} approaches · {len(questions)} questions")
    print(f"  spend ${cumulative_spend:.4f} / $5.00 ({100 * cumulative_spend / 5:.1f}%)")


if __name__ == "__main__":
    main()
