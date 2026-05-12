# 11 — Observability, Logging & Run Tracking

> Everything we capture during a run, where it lives, and how we read it back. The "show your work" layer that makes experiments reproducible and debuggable.

---

## 1. Goals

1. **Every claim is auditable.** Any number in the paper traces to a question, retrieved chunks, judge rationale, and config.
2. **Local-first.** Default observability is zero external dependencies. The repo + `runs/` folder is enough to debug offline.
3. **Optional cloud mirror.** W&B / OTEL can be enabled per-run for collaborative dashboards but never required.
4. **Cheap writes, ergonomic reads.** Append-only JSONL during runs; aggregated views materialized on demand.

---

## 2. The Run Folder Is The System Of Record

```
runs/<run_id>/
├── manifest.json              # config + git SHA + dataset/model hashes + seed
├── config.snapshot.yaml       # exact resolved Hydra config
├── inputs.jsonl               # one line per question (q_id + content)
├── outputs.jsonl              # one line per question (full TechniqueResult)
├── metrics.json               # aggregated metrics (schema in 09)
├── failures.jsonl             # failed questions with exception traces
└── logs/
    ├── events.jsonl           # structured run events (info / warn / error)
    ├── retries.jsonl          # API-retry log
    ├── tool_calls.jsonl       # for agentic techniques: every tool call
    └── llm_calls.jsonl        # one row per LLM call
```

A typical 200-question benchmark run is < 100 MB. Anything not in this layout is debugging cruft, not data.

---

## 3. Structured Logging

`core/logging.py` exposes a single `get_logger()` returning a structlog-style JSON logger. Every entry:

```json
{
  "ts": "2026-06-12T14:02:15.218Z",
  "level": "info",
  "run_id": "20260612-1402-graph_rag-legal-1",
  "event": "retrieval.completed",
  "q_id": "legal-mh-0001",
  "k": 5,
  "latency_ms": 142
}
```

Loggers are run-scoped. The `RunRecorder` configures a per-run sink that writes to `runs/<id>/logs/events.jsonl`. Console output goes to stderr (human-readable, **not** the system of record).

---

## 4. LLM Call Logging

Every call through any `Generator` adapter is logged to `logs/llm_calls.jsonl`:

```json
{
  "ts": "...", "run_id": "...", "q_id": "legal-mh-0001",
  "provider": "gemini", "model": "gemini-1.5-pro", "model_version": "2026-04-30",
  "purpose": "answer | rewrite | summarize | judge | route",
  "tokens_in": 1820, "tokens_out": 142,
  "latency_ms": 1410, "cost_usd": 0.0084,
  "cache_hit": false, "retry_count": 0,
  "prompt_template_id": "answer.legal.v1", "prompt_template_hash": "ab12cd34"
}
```

This file is the **source of truth** for cost, latency, and token metrics. Aggregations in `metrics.json` are derived from this stream.

The `purpose` field is critical — it lets us separate "answer" from "rewrite" / "summarize" / "judge" calls when computing per-query cost-of-answer.

---

## 5. Tool / Agent Step Logging

Multi-step techniques (Self-RAG, Agentic, hybrids #1/#3/#6) write per-step rows to `tool_calls.jsonl`:

```json
{
  "ts": "...", "q_id": "...",
  "step": 2, "node": "retrieve", "tool": "vector_search",
  "input": {"query": "...", "k": 5},
  "output_summary": {"hits": 5, "top_score": 0.83},
  "latency_ms": 87
}
```

This makes agent traces inspectable in the dashboard's per-question explorer without re-running anything.

---

## 6. Metrics Pipeline

```
runs/<id>/outputs.jsonl
  └─ evaluation/metrics/* (run on close)
       └─ runs/<id>/metrics.json
            └─ pipelines/aggregate.py (on demand)
                 ├─ runs/_aggregated/leaderboard.csv
                 ├─ runs/_aggregated/pairwise.csv
                 └─ runs/_aggregated/pareto.json
```

Aggregation is idempotent and rebuilds from per-run JSONs. If `metrics.json` is regenerated, derived files invalidate themselves.

---

## 7. Cost / Memory / Latency Telemetry

`core/telemetry/cost.py`:
- Wraps `Generator.generate()` to record tokens and convert to $ via `core/pricing.py`.
- Maintains a process-level running tally (queryable for cost-ceiling enforcement).
- Emits one `llm_calls.jsonl` row per call.

`core/telemetry/memory.py`:
- Samples `psutil.Process().memory_info().rss` at 1 Hz during `run()`.
- Records peak in `metrics.json.memory.peak_rss_mb`.
- For local runs: samples `nvidia-smi` output if available.

`core/telemetry/latency.py`:
- Stopwatch context managers: `with stopwatch("retrieval"): ...` records to a per-query timing dict.
- p50 / p95 / p99 computed at metrics-aggregation time.

---

## 8. Determinism & Replay

`runs/<id>/manifest.json` captures everything needed to re-execute:

```bash
python -m ragureap replay --run runs/20260612-1402-graph_rag-legal-1/
```

`replay`:
1. Loads manifest, config snapshot.
2. Verifies git SHA matches (warns if not).
3. Verifies dataset hash matches (errors if not).
4. Re-runs all questions with the recorded seed.
5. Diffs new metrics vs original; asserts within bootstrap CI.

Replay output goes to `runs/<original_id>__replay/` and never overwrites the original.

---

## 9. Optional Cloud Mirroring

### W&B

Setting `WANDB_PROJECT=ragureap` mirrors per-run metrics to W&B. Local artifacts remain authoritative; W&B is read-only commentary. Mirror writes:
- Final metrics as `wandb.summary`.
- `outputs.jsonl` as a W&B Table (sampled to ≤ 200 rows).
- Cost / latency / memory as time series for sweeps.

### OpenTelemetry

`OTEL_EXPORTER_OTLP_ENDPOINT` enables OTLP traces of LLM calls and retrievals. Useful for long agentic runs to inspect Jaeger/Honeycomb-style waterfalls. Off by default.

---

## 10. Inspector CLI

```bash
# Latest run summary
python -m ragureap inspect --run latest --view summary

# Failure breakdown
python -m ragureap inspect --run <id> --view failures

# Cost per query, sorted
python -m ragureap inspect --run <id> --view cost --sort desc | head -20

# Specific question, full trace
python -m ragureap inspect --run <id> --q-id legal-mh-0001
```

Each `--view` is a thin formatter over the JSONL streams.

---

## 11. Run Retention Policy

Run folders are gitignored; only `manifest.json` is committed under `runs/index/` so the experiment ledger lives in version control even if bulk artifacts don't.

Local retention:
- All Phase-12 runs kept indefinitely.
- Phase-3 to Phase-11 smoke runs older than 30 days are gzipped.
- Failed / aborted runs older than 7 days are deleted unless tagged `keep`.

A nightly script (`scripts/run_gc.py`) enforces this.

---

## 12. Observability Checklist (For New Techniques)

When adding a technique, verify:
- [ ] Every LLM call goes through a `Generator` adapter (auto-logged).
- [ ] Every retrieval goes through a `Retriever` adapter (auto-logged).
- [ ] Multi-step techniques write to `tool_calls.jsonl`.
- [ ] No direct stdout/stderr writes from technique code.
- [ ] `intermediate` field on `TechniqueResult` populated with technique-specific debug data.
- [ ] `index()` writes its own indexing-cost telemetry.

A `tests/integration/test_observability.py` asserts these invariants for every registered technique.

---

## 13. Why JSONL Over A Database

We chose flat JSONL files over SQLite/Postgres for run artifacts:
- **Append-only is fast.** Stream-write during long runs without locks.
- **Diff-friendly.** Reviewers can `git diff` two manifests directly.
- **No schema migrations** during a research project.
- **Cloud-portable.** A `runs.tar.gz` is a self-contained reproducibility package.

If aggregation patterns get complex, we'll load JSONL into DuckDB ad hoc — never a long-running DB. Recorded as ADR-008 if/when crossed.

---

## 14. What Each Phase Delivers For Observability

- **Phase 1:** `RunRecorder`, `core/logging.py`, telemetry modules, manifest writer, log file layout.
- **Phase 8:** `pipelines/aggregate.py`, `inspect` CLI, optional W&B mirror, OTEL hooks.
- **Phase 10:** dashboard views over the same JSONL streams.
