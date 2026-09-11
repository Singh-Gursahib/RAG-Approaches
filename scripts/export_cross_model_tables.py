"""Export the GLM 5.3 Flash replication to paper tables.

The replication was run through RAG Atlas (studio/), which calls the same
`ragureap` approaches, metrics, and statistics as the research sweep but sends
generation to OpenRouter. Its finished tests are saved as JSON in studio/results/.
This script turns them into CSVs laid out like paper/tables/sweep_headline.csv and
sweep_per_question.csv:

  glm53_headline.csv, glm53_per_question.csv
      all seven strategies; reasoning effort "low" with a 640-token limit
  glm53_fc_headroom_headline.csv, glm53_fc_headroom_per_question.csv
      Full-Context follow-up; reasoning effort "high" with a 2,560-token limit
  cross_model_f1.csv
      Gemini 3 Flash (paper sweep) against GLM 5.3 Flash, per strategy

Usage (from the repo root):
    .venv/bin/python scripts/export_cross_model_tables.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "studio" / "results"
TABLES = ROOT / "paper" / "tables"
MODEL = "z-ai/glm-5.3-flash"

HEADLINE_COLS = [
    "approach", "n_seeds", "n_questions_per_seed",
    "em_seed_mean", "em_seed_std", "em_pooled_lo", "em_pooled_hi",
    "f1_seed_mean", "f1_seed_std", "f1_pooled_lo", "f1_pooled_hi",
    "cost_mean", "cost_std", "p50_ms_mean", "p95_ms_mean",
]
PER_QUESTION_COLS = ["approach", "seed", "qid", "type", "em", "f1", "correct"]


def _newest(predicate, description: str) -> dict:
    runs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(RESULTS.glob("*.json"))]
    matches = [r for r in runs if predicate(r)]
    if not matches:
        raise SystemExit(f"No saved result for {description} in {RESULTS}")
    return max(matches, key=lambda r: r.get("created_at") or "")


def _headline_rows(result: dict):
    for h in result["results"]["headline"]:
        yield {
            "approach": h["approach"],
            "n_seeds": h["n_seeds"],
            "n_questions_per_seed": h["n_questions_per_seed"],
            "em_seed_mean": f"{h['em']:.4f}",
            "em_seed_std": f"{h['em_seed_std']:.4f}",
            "em_pooled_lo": f"{h['em_lo']:.4f}",
            "em_pooled_hi": f"{h['em_hi']:.4f}",
            "f1_seed_mean": f"{h['f1']:.4f}",
            "f1_seed_std": f"{h['f1_seed_std']:.4f}",
            "f1_pooled_lo": f"{h['f1_lo']:.4f}",
            "f1_pooled_hi": f"{h['f1_hi']:.4f}",
            "cost_mean": f"{h['cost_usd']:.4f}",
            "cost_std": f"{h['cost_seed_std']:.4f}",
            "p50_ms_mean": f"{h['p50_ms']:.4f}",
            "p95_ms_mean": f"{h['p95_ms']:.4f}",
        }


def _per_question_rows(result: dict):
    seeds = result["config"]["seeds"]
    for q in result["results"]["questions"]:
        for approach, prediction in q["predictions"].items():
            for run in prediction["preds"]:
                yield {
                    "approach": approach,
                    "seed": seeds[run["repeat"]],
                    "qid": q["qid"],
                    "type": q["type"],
                    "em": run["em"],
                    "f1": run["f1"],
                    "correct": run["correct"],
                }


def _write(name: str, rows, columns) -> list[dict]:
    rows = list(rows)
    with open(TABLES / name, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote paper/tables/{name} ({len(rows)} rows)")
    return rows


def main() -> int:
    full = _newest(
        lambda r: r["model"]["id"] == MODEL and r["source"] == "replay" and len(r["results"]["approaches"]) == 7,
        "the seven-strategy GLM 5.3 Flash replay",
    )
    headroom = _newest(
        lambda r: r["model"]["id"] == MODEL
        and r["results"]["approaches"] == ["full_context"]
        and r["config"]["reasoning_effort_sent"] == "high"
        and r["config"]["repeats"] == 3,
        "the GLM 5.3 Flash Full-Context high-effort follow-up",
    )
    print(f"full replay:  {full['id']} (effort {full['config']['reasoning_effort_sent']}, max_tokens {full['config']['max_tokens_sent']})")
    print(f"FC headroom:  {headroom['id']} (effort high, max_tokens {headroom['config']['max_tokens_sent']})")

    glm = _write("glm53_headline.csv", _headline_rows(full), HEADLINE_COLS)
    _write("glm53_per_question.csv", _per_question_rows(full), PER_QUESTION_COLS)
    fc = _write("glm53_fc_headroom_headline.csv", _headline_rows(headroom), HEADLINE_COLS)
    _write("glm53_fc_headroom_per_question.csv", _per_question_rows(headroom), PER_QUESTION_COLS)

    with open(TABLES / "sweep_headline.csv", encoding="utf-8") as fh:
        gemini = {row["approach"]: row for row in csv.DictReader(fh)}
    rows = []
    for row in glm + [{**fc[0], "approach": "full_context_headroom"}]:
        base = gemini[row["approach"].replace("_headroom", "")]
        rows.append({
            "approach": row["approach"],
            "gemini_f1": base["f1_seed_mean"], "gemini_f1_std": base["f1_seed_std"],
            "gemini_f1_lo": base["f1_pooled_lo"], "gemini_f1_hi": base["f1_pooled_hi"],
            "glm_f1": row["f1_seed_mean"], "glm_f1_std": row["f1_seed_std"],
            "glm_f1_lo": row["f1_pooled_lo"], "glm_f1_hi": row["f1_pooled_hi"],
            "delta_f1": f"{float(row['f1_seed_mean']) - float(base['f1_seed_mean']):+.4f}",
            "gemini_cost_estimated": base["cost_mean"], "glm_cost_billed": row["cost_mean"],
        })
    _write("cross_model_f1.csv", rows, list(rows[0]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
