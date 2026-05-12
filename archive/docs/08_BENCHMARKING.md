# 08 — Benchmarking Methodology

> How we run experiments at scale, what test suites every domain ships, and how we keep results reproducible. The goal: every claim in the paper traces back to a manifest under `runs/` that anyone with the repo + the same model APIs can re-execute.

---

## 1. What "A Benchmark" Means Here

A **benchmark** is a triple `(suite, domain, ground_truth)`. Every domain ships seven suites (see `07_DATASETS.md §5`). A **benchmark run** is the cross-product `technique × suite × domain × seed`. The `BenchmarkRunner` (in `src/ragureap/benchmarks/runner.py`) iterates this matrix.

A run is identified by:

- `run_id` (timestamp + technique + domain + seed)
- `config_hash` (sha256 of resolved Hydra config)
- `dataset_hash` (sha256 of the benchmark's `qa.jsonl` content)
- `git_sha` (code version)

Re-running with all four matched should reproduce metrics within bootstrap CI.

---

## 2. Test Suite Taxonomies

The framework ships seven test suite types. Each domain has all seven. Suite definitions live in `benchmarks/suites/<name>.py` and produce questions in the schema from `07_DATASETS.md §4`.

### 2.1 Standard Q&A (`qa.jsonl`)

Single-fact, single-document questions. Establishes the baseline accuracy floor.

- Difficulty distribution: 40% easy / 40% medium / 20% hard.
- Metrics: EM, F1, faithfulness, answer relevance.
- Failure pattern of interest: retrieval misses on lexically distant queries.

### 2.2 Multi-Hop (`multihop.jsonl`)

Answers that require connecting evidence across **2 or more chunks**, often across documents.

- Hop distribution: 40% 2-hop / 35% 3-hop / 20% 4-hop / 5% 5-hop.
- Metrics: EM, F1, faithfulness, **chain-of-evidence recall** (how many ground-truth evidence chunks were retrieved).
- Failure pattern of interest: single-step retrievers; agents that don't decompose.

### 2.3 Needle-in-Haystack (`needles.jsonl`)

A small set of "needles" (specific facts) is injected at varying depths in a long-context corpus.

- 5 depths: 1%, 25%, 50%, 75%, 99% of corpus length.
- 50 needles per depth.
- Metrics: needle-recall accuracy, latency, depth-degradation curve.
- Failure pattern of interest: lost-in-the-middle on long contexts; under-attention to deep positions.

### 2.4 Adversarial (`adversarial.jsonl`)

Designed to break specific assumptions. Categories:

- **Distractor injection.** Plausible-but-wrong chunks placed adjacent to correct chunks.
- **Contradictory context.** Two chunks contradict each other; only one is correct per ground truth.
- **Prompt injection.** Retrieved chunks contain instructions like "ignore previous and answer X".
- **Near-duplicate clauses.** Two chunks differ by a single clinically/legally significant word.
- **Out-of-scope distractors.** Chunks from a different domain mixed in.

Metrics: accuracy under attack, hallucination rate, **prompt-injection robustness rate** (% of injection attempts that did not change the answer).

### 2.5 Hallucination (`hallucination.jsonl`)

Questions whose answer is **not** in the corpus. The correct response is "I don't know" or an explicit refusal-to-fabricate.

- Metrics: refusal rate, fabrication rate.
- Failure pattern of interest: models / techniques that always answer.

### 2.6 Stress (`stress.jsonl`)

Same questions repeated against corpora padded with distractors at sizes: 1K → 10K → 100K → 1M tokens.

- Metrics: accuracy curve over corpus size, latency curve, cost curve, peak memory curve.
- Failure pattern of interest: brittle indexers; quadratic cost techniques that hit budget caps.

### 2.7 Retrieval Quality (`retrieval_quality.jsonl`)

Each question is annotated with the **ground-truth relevant chunk IDs**. Used only for retrieval-side metrics — not the generation step.

- Metrics: precision@k, recall@k, MRR, nDCG, hit-rate.
- Failure pattern of interest: mis-tuned k; over-retrieval; reranker mis-calibration.

### 2.8 Reasoning Quality (`reasoning_quality.jsonl`) *(optional, P2)*

Chain-of-thought-grounded multi-step questions where intermediate reasoning is checkable.

- Metrics: step-level accuracy, final-answer accuracy, reasoning faithfulness (does the chain match the actual evidence?).
- Failure pattern of interest: confident-but-wrong reasoning; reasoning that contradicts retrieved evidence.

---

## 3. Benchmark Runner

```python
class BenchmarkRunner:
    def __init__(self, cfg: BenchmarkConfig): ...

    def run(self) -> RunReport:
        for technique in cfg.techniques:
            for domain in cfg.domains:
                for suite in cfg.suites:
                    for seed in cfg.seeds:
                        self._run_cell(technique, domain, suite, seed)
```

Each cell:
1. Resolves config → instantiates technique via registry.
2. Loads `IndexHandle` from cache or builds (with telemetry).
3. Iterates questions sequentially (clean per-query latency) or with bounded concurrency.
4. Streams to `runs/<run_id>/outputs.jsonl` via `RunRecorder`.
5. After all questions: invokes the configured `Evaluator` set, writes `metrics.json`.

### 3.1 Cell ordering

Cells are executed in **technique-first** order so that all domains finish for a single technique before moving on — this isolates technique-level bugs.

### 3.2 Cost ceiling

Each cell can specify `max_cost_usd`. The recorder aborts cleanly when the ceiling is hit, marking the cell `aborted` with the partial metrics computed on completed questions.

### 3.3 Resumability

A cell can be marked `interrupted`. A resume command (`python -m ragureap resume --run <id>`) re-loads the manifest, replays the inputs.jsonl up to the last completed question, and continues from there.

---

## 4. Reproducibility Discipline

Every cell records:

- `git_sha` (short).
- `code_version` (from `pyproject.toml`).
- `config_hash` (sha256 of canonical resolved config).
- `dataset_hash` (sha256 of suite content).
- `embedder` model + version.
- `generator` model + version + provider.
- `judge` model + version (if used).
- `seed` (per-cell).
- `prompt_template_hashes` (one per template referenced).

A `replay` command re-executes a cell using only its manifest as input. A passing replay must produce metrics within bootstrap CI of the original.

---

## 5. Statistical Rigor

### 5.1 Multi-seed runs

Every cell that includes any LLM call runs **≥3 seeds**. Generators are configured with `temperature=0` and `seed=` where supported. Even at temperature 0, provider-side non-determinism creates per-seed variance — multi-seed averaging makes this explicit.

### 5.2 Confidence intervals

For each metric we compute a **95% bootstrap BCa CI** with `n=1000` resamples. Sample-level metrics (per-question scores) are bootstrapped at the question level.

### 5.3 Pairwise comparisons

When the paper claims "X beats Y", we report:

- Paired Wilcoxon signed-rank on per-question metrics.
- Holm correction across the comparison family.
- An effect size (median difference) alongside the p-value.

### 5.4 Multiple-comparison families

A "family" = one (metric, suite, domain) triple compared across techniques. Holm correction applied per family. Cross-family claims are reported separately.

### 5.5 Sample-size targets

| Suite | Target n | Rationale |
|---|---|---|
| qa | 200–500 | Stable EM/F1 estimates |
| multihop | 100 | Synthesis cost limits |
| needles | 50 × 5 depths = 250 | Curve resolution |
| adversarial | 100 | Coverage of categories |
| hallucination | 50 | Sufficient for refusal-rate CI |
| stress | 20 × 4 sizes = 80 | Curve over corpus size |
| retrieval_quality | 200 | Stable precision/recall |

These thresholds drive the synthetic-Q&A target counts in `07_DATASETS.md`.

---

## 6. Smoke vs Full Benchmarks

Two named benchmark modes:

**Smoke** (`configs/benchmark/smoke.yaml`)
- 10 questions × 3 suites × 1 seed.
- Used as a CI gate; runs in <5 minutes per technique.
- Required to pass before merging any new technique.

**Full** (`configs/benchmark/full.yaml`)
- All 7 suites × 3 seeds.
- Targets per-domain sample-size goals (§5.5).
- Used in Phase 12 for the paper experiment matrix.

**Adversarial-only** (`configs/benchmark/adversarial.yaml`)
- Just §2.4 + §2.5 suites for robustness studies.

---

## 7. Cost / Latency / Memory Budgets

Each technique × domain run is budgeted along three axes:

| Axis | Budget | Source |
|---|---|---|
| Cost ($) | per-run cap, e.g., `max_cost_usd: 5.0` for smoke | config |
| Latency p95 | reported, not capped | metrics |
| Peak memory | reported, capped only on local-model runs | telemetry |

The aggregate budget for the **full Phase 12 sweep** is estimated up-front (~$200–500 across 13 RAG + 8 non-RAG techniques × 7 domains × 3 seeds at smoke-suite size) and tracked in `EXPERIMENT_LOG.md`'s cost tracker.

---

## 8. Concurrency Strategy

For a benchmark with N questions:

- **Sequential mode** (default): one question at a time per cell. Clean per-query latency timing. Latency is a primary reported metric.
- **Throughput mode**: `--concurrency K` (e.g., 8 or 16) — for large sweeps where p50 latency need not be measured (it would be inflated by GPU contention anyway). Used in Phase 12 for cost-time efficiency.

The mode is recorded in the manifest; cross-mode comparisons are flagged.

---

## 9. Caching Policy

| Artifact | Cache | Invalidation |
|---|---|---|
| Embeddings | SQLite `data/processed/.embedding_cache.sqlite` | Embedder model change |
| Indices | `data/processed/<domain>/<technique>/` | Dataset hash + chunker config change |
| RAPTOR / GraphRAG summaries | Sidecar | Indexing-LLM ID + prompt hash change |
| MemoRAG memory | Sidecar | Memory-LM + prompt hash change |
| Gemini explicit cache | Server-side | TTL or corpus update |
| Synthetic Q&A | `data/benchmarks/<domain>/` | Manual regeneration only |

A run never silently uses a stale cache — cache lookups are content-addressed.

---

## 10. Anti-Cheating Discipline

Synthetic Q&A is generated by an LLM. To avoid the trap of "the same LLM family that generated questions also answers them":

- **Q&A generator** is fixed at Gemini Pro for all synthesis.
- **Answer generators** under test that are also Gemini-family are flagged in the paper as a potential confound; we additionally run Ollama-hosted generators on a sub-sample to check the trend holds.
- **Judge models** are different from the system under test wherever possible (e.g., gpt-4o judges Gemini-generated answers, and vice versa).

---

## 11. Failure Mode Catalog

Every benchmark run produces a `failures.jsonl` listing:

- Failed cells (with exception trace).
- Aborted cells (cost ceiling hit).
- Questions where the technique failed with an error.

These feed the "Failure Modes Catalog" section of `FINDINGS.md`.

---

## 12. CI Integration

- Smoke benchmark runs on every PR that touches `techniques/` or `core/`.
- Full benchmark runs on a manual trigger (cost-aware).
- Reproducibility test: a fixed `(technique, domain, seed)` tuple is run on each release tag and the metrics are compared to the canonical `runs/release-vX.Y/` golden manifest. Drift > CI bound fails the release.

---

## 13. What Phase 9 Will Deliver

By Phase 9 close:
- `benchmarks/suites/` implementations for all 7 suite types.
- `benchmarks/runner.py` end-to-end.
- All seven suites populated with ground truth across all 7 domains (small tier).
- Smoke benchmark on every P0 technique passing in CI.
- A first **Phase 12 dry-run** (small sample) to estimate full-sweep cost.
