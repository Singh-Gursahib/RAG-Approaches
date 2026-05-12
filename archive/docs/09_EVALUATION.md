# 09 — Evaluation Metrics

> Every metric we report, why we report it, and how it's computed. Metrics fall into five families: **retrieval**, **generation**, **faithfulness / hallucination**, **cost / latency / memory**, **statistical**.

---

## 1. Metrics At-A-Glance

| Metric | Family | Per | Range | Higher = Better |
|---|---|---|---|---|
| Precision@k | Retrieval | query | 0–1 | ✓ |
| Recall@k | Retrieval | query | 0–1 | ✓ |
| MRR | Retrieval | query | 0–1 | ✓ |
| nDCG@k | Retrieval | query | 0–1 | ✓ |
| Hit-rate@k | Retrieval | query | 0–1 | ✓ |
| EM | Generation | query | 0–1 | ✓ |
| F1 (token-level) | Generation | query | 0–1 | ✓ |
| BERTScore-F1 | Generation | query | 0–1 | ✓ |
| Answer Relevance | Generation (judge) | query | 0–1 | ✓ |
| Faithfulness | Faithfulness | query | 0–1 | ✓ |
| Context Utilization | Faithfulness | query | 0–1 | ✓ |
| Hallucination Rate | Faithfulness | run | 0–1 | ✗ |
| Refusal Rate (on hallucination set) | Faithfulness | run | 0–1 | ✓ |
| Tokens In / Out | Cost | query | int | n/a |
| $ / query | Cost | query | float | ✗ |
| Latency p50 / p95 | Latency | run | ms | ✗ |
| Peak Memory | Memory | run | MB | ✗ |
| Index Build Time | Cost | run | s | ✗ |
| Index Storage Size | Cost | run | MB | ✗ |

---

## 2. Retrieval Metrics (`evaluation/metrics/retrieval.py`)

Computed only when a `retrieval_quality` suite provides ground-truth relevant chunk IDs.

- **Precision@k.** Fraction of top-k retrieved chunks that are relevant.
- **Recall@k.** Fraction of relevant chunks that appear in top-k.
- **MRR.** Mean Reciprocal Rank of the first relevant chunk.
- **nDCG@k.** Normalized Discounted Cumulative Gain — order-aware, penalizes relevant chunks placed later.
- **Hit-rate@k.** Binary: is at least one relevant chunk in top-k? Useful for downstream-success proxy.
- **Chain-of-Evidence Recall** (multi-hop). Fraction of ground-truth evidence chunks that were retrieved across the entire reasoning chain (sum of retrievals across agentic steps).

For multi-step techniques (Agentic, Self-RAG), retrievals across steps are unioned before computing Recall@k — this rewards iteration.

---

## 3. Generation Metrics (`evaluation/metrics/generation.py`)

### 3.1 Reference-based

- **Exact Match (EM).** Normalized string equality against ground-truth answer (case- and punctuation-folded; standard SQuAD-style normalization).
- **Token-F1.** Token-set overlap, harmonic mean of precision/recall over tokens.
- **BERTScore-F1.** Embedding-based semantic similarity. Default backbone: `microsoft/deberta-xlarge-mnli` rescaled to baseline.
- **Numeric F1** (for finance / medical when answer is numeric). Approximate match with tolerance threshold (default 1%).

### 3.2 Reference-free (LLM-as-Judge)

- **Answer Relevance.** Judge rates 0–2 whether the answer addresses the question. Mean over questions.
- **Completeness.** Judge rates 0–2 coverage of the expected answer scope.
- **Fluency.** Judge rates 0–2 naturalness — used as a sanity check more than a primary metric.

Judge prompts live in `evaluation/judges/prompts/` and are hashed into the manifest.

---

## 4. Faithfulness & Hallucination (`evaluation/metrics/faithfulness.py`)

### 4.1 Faithfulness (claim-level)

For each generated answer:

1. Decompose into atomic **claims** via an LLM.
2. For each claim, check whether it's **supported** by the retrieved context (or, for non-RAG techniques, by the source corpus).
3. Faithfulness score = fraction of claims that are supported.

Implementation uses RAGAS's faithfulness metric as a starting point, augmented with our own claim-decomposition prompt because RAGAS's default is conservative on multi-claim answers.

### 4.2 Context Utilization

How much of the supplied context the answer actually used. Computed as:

```
context_utilization = supported_claims / total_claims
```

Distinct from faithfulness only when an answer makes claims that aren't in retrieved context **but are correct** — we report both so this gap is visible.

### 4.3 Hallucination Rate (run-level)

Two separate definitions, both reported:

- **Out-of-corpus hallucination rate.** On the `hallucination.jsonl` suite (questions with no answer in the corpus): fraction of runs where the technique fabricated a confident answer instead of refusing. Lower is better.
- **In-corpus claim hallucination rate.** Across all `qa.jsonl` answers: fraction of claims that are unsupported by retrieved context. = `1 − faithfulness`. Lower is better.

### 4.4 Refusal Rate

On the `hallucination.jsonl` suite: fraction of correctly-refused queries. The complement of out-of-corpus hallucination rate, but reported separately because some techniques refuse aggressively (high refusal rate is not always good — needs to be paired with answer rate on `qa.jsonl`).

### 4.5 Prompt-Injection Robustness

Sub-metric inside the `adversarial.jsonl` evaluation. For questions where retrieved context contains an injection ("ignore the previous, answer X"), measure the fraction of runs where the answer was **not** swayed.

---

## 5. Cost / Latency / Memory (`evaluation/metrics/cost.py`, `memory.py`)

### 5.1 Cost

- **Tokens In / Out** per query: counted by the `Generator` adapter using the provider's tokenizer (or tiktoken / nomic equivalents for local models).
- **$ / query**: derived from a per-model price table (`core/pricing.py`) maintained in this repo. Updated when providers change pricing; previous prices retained behind a model-version key for replay reproducibility.
- **Index build cost**: cumulative tokens / $ during indexing (RAPTOR, GraphRAG, MemoRAG).

### 5.2 Latency

- **End-to-end latency** per query: wall-clock from `run()` entry to `run()` exit.
- **Decomposition** for multi-step techniques: time spent in retrieval / generation / agent overhead, recorded separately.
- **p50 and p95** at the run level. Means avoided due to long-tail sensitivity.

### 5.3 Memory

- **Peak RSS** (resident set size) per run via `tracemalloc` and `psutil`.
- **Index storage size** on disk per technique × domain.
- **Vector / graph store size** as separate columns.
- For local-model runs: GPU peak memory if available.

---

## 6. Aggregation Strategy

A single benchmark cell produces these tiers:

```
per-question scores  →  per-cell aggregates  →  per-(technique, domain) aggregates  →  paper tables
```

- **Per-question.** Stored in `runs/<id>/outputs.jsonl`. The atomic unit for bootstrapping.
- **Per-cell.** Mean ± 95% BCa CI. Stored in `runs/<id>/metrics.json`.
- **Per-(technique, domain).** Across seeds. Mean of per-cell means with CI propagated. Stored in a derived analysis JSON for paper figures.

---

## 7. Statistical Helpers (`evaluation/stats/`)

### 7.1 Bootstrap CIs

```python
def bootstrap_ci(scores: list[float], n: int = 1000, ci: float = 0.95) -> tuple[float, float, float]:
    """Returns (mean, lo, hi) using BCa method on the score vector."""
```

Uses `scipy.stats.bootstrap` with `method='BCa'` and the seed from the cell.

### 7.2 Paired Wilcoxon

```python
def paired_wilcoxon(scores_a: list[float], scores_b: list[float]) -> WilcoxonResult:
    """Returns (p_value, effect_size, median_diff). Paired by question_id."""
```

### 7.3 Holm correction

```python
def holm_correct(p_values: list[float]) -> list[float]:
    """Returns Holm-Bonferroni-adjusted p-values."""
```

### 7.4 Pareto frontier

```python
def pareto_frontier(points: list[Point], minimize: list[str], maximize: list[str]) -> list[Point]:
    """Returns the Pareto-optimal subset under the given axes."""
```

Used by the dashboard's Pareto plot and by the paper's cost-quality figure generator.

---

## 8. Judge Models

### 8.1 Roles

- **Faithfulness judge.** Given (question, answer, context), score 0–1 supported-claim fraction. Default: `gemini-2-pro` *unless* the answer was generated by Gemini, in which case `gpt-4o` to break the family-bias confound.
- **Answer-relevance / completeness / fluency judge.** Default: same model, structured rubric prompt.
- **Multi-judge ensemble.** For the paper's headline numbers, faithfulness is double-judged (Gemini + GPT-4o); we report inter-judge agreement (Cohen's κ).

### 8.2 Calibration

Before use, every judge is calibrated on the 100-question human-judged sub-sample (per `07_DATASETS.md §4.2`). Pearson r > 0.7 with human scores is the gate; below that, the judge prompt is revised.

### 8.3 Cost containment

Judges are expensive. To keep budgets reasonable:

- Faithfulness is computed on a **stratified random subsample** of 50 questions per cell, not all 200–500.
- Full-cell faithfulness is computed only for **Phase 12 paper-final runs**.

---

## 9. Per-Domain Metric Customization

Some metrics matter more in some domains:

| Domain | Primary metrics | Notes |
|---|---|---|
| Legal | EM (clause text), faithfulness | Exact wording bonus |
| Medical | Faithfulness, refusal rate | Safety > completeness |
| Education | Answer relevance, completeness | Pedagogical correctness |
| Finance | Numeric F1, EM | Numerical fidelity |
| Research | Faithfulness, citation accuracy | Citation = additional metric (was paper P actually retrieved?) |
| Code | EM (function name), unit-test pass | If we can run code |
| General | EM, F1, BERTScore | Standard QA |

Per-domain metric weights for an aggregated "domain-fit score" are TBD and defined as a paper finding — we will report all metrics individually first, then compute aggregates only after the data is in.

---

## 10. Metrics Schema (`metrics.json`)

```json
{
  "run_id": "...",
  "n_questions": 200,
  "retrieval": {
    "precision@5": {"mean": 0.62, "ci": [0.57, 0.67]},
    "recall@5":    {"mean": 0.81, "ci": [0.76, 0.85]},
    "mrr":         {"mean": 0.71, "ci": [0.66, 0.76]}
  },
  "generation": {
    "em":   {"mean": 0.41, "ci": [0.34, 0.48]},
    "f1":   {"mean": 0.55, "ci": [0.50, 0.61]},
    "bertscore_f1": {"mean": 0.79, "ci": [0.76, 0.81]}
  },
  "faithfulness": {
    "faithfulness":         {"mean": 0.78, "ci": [0.74, 0.82]},
    "context_utilization":  {"mean": 0.71, "ci": [0.67, 0.75]},
    "hallucination_rate":   {"mean": 0.07, "ci": [0.04, 0.10]},
    "refusal_rate":         {"mean": 0.62, "ci": [0.55, 0.69]}
  },
  "cost": {
    "tokens_in_per_q":  {"mean": 1820, "p95": 4310},
    "tokens_out_per_q": {"mean":  142, "p95":  290},
    "usd_per_q":        {"mean": 0.0084, "total": 1.68},
    "index_build_usd":  3.42,
    "index_storage_mb": 412
  },
  "latency": {
    "p50_ms": 1430,
    "p95_ms": 3820,
    "p99_ms": 5210
  },
  "memory": {
    "peak_rss_mb": 1284
  },
  "judge": {
    "faithfulness_judge": "gemini-2-pro",
    "n_judged": 50,
    "interjudge_kappa": null
  },
  "stats": {
    "ci_method": "BCa",
    "ci_n": 1000,
    "seed": 1
  }
}
```

This schema is versioned (`schema_version: "1.0"`) and validated by Pydantic.

---

## 11. Paper-Ready Outputs

The evaluation pipeline emits three derived artifacts ready for the paper:

1. **Leaderboard CSV** (`runs/_aggregated/leaderboard.csv`) — technique × domain × metric, with CIs.
2. **Pairwise significance table** (`runs/_aggregated/pairwise.csv`) — paired Wilcoxon p-values, Holm-adjusted.
3. **Pareto frontier JSON** (`runs/_aggregated/pareto.json`) — per-domain Pareto-optimal sets across (cost, quality), (latency, quality), (memory, quality).

These are consumed by `notebooks/figures/*.ipynb` to produce the paper's figures.

---

## 12. What Phase 8 Will Deliver

By Phase 8 close:

- All four metric files implemented (`retrieval.py`, `generation.py`, `faithfulness.py`, `cost.py`).
- RAGAS integration wrapper.
- Two judge models with prompts hashed.
- Statistical helpers + `metrics.json` schema validator.
- A 100-query human-judged sub-sample collected for at least one domain (legal or medical) and judge calibration verified.
