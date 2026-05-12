# 04 — Frontend / UI Design

> The dashboard's job is to make the **comparative experiment** legible: launch runs, watch them stream, compare them side-by-side, and surface Pareto trade-offs. Two-stage delivery: **Streamlit MVP** (Phase 10a) → **Next.js polished dashboard** (Phase 10b).

---

## 1. UX Principles

1. **Comparison is the verb.** Every screen should make "X vs Y vs Z" cheap. Single-run views exist mainly to feed comparison views.
2. **Cost is always visible.** Every metric is shown alongside its **cost** (tokens, $, latency). No quality number without its price.
3. **Reproducibility is one click away.** From any run, "copy replay command" should produce a CLI string that re-runs the experiment.
4. **Progressive disclosure.** Default views show 3–5 numbers; drilldowns expose intermediate artifacts (retrieved chunks, reflection tokens, judge rationales).
5. **Stream, don't refresh.** Long runs stream progress via SSE; the UI never blocks on a request.

---

## 2. Two-Stage Plan

### 2.1 Streamlit MVP (Phase 10a)

**Goal:** Functional UI in days, not weeks. Drives Phase 11–12 internal experiments.

Pages (multipage Streamlit app under `frontend/streamlit_app/`):
- **`pages/01_run.py`** — single-run launcher: pick technique, domain, benchmark, seeds; "Run" → SSE log + final metrics.
- **`pages/02_compare.py`** — multi-run comparison: pick 2–6 runs; side-by-side metrics table + per-question diff.
- **`pages/03_pareto.py`** — Pareto plots for a chosen domain across all runs.
- **`pages/04_runs.py`** — run history (filterable table backed by `runs/`).
- **`pages/05_inspect.py`** — drill into a single run: per-question retrieved chunks, judge rationales, reflection tokens.

State management: Streamlit session state + read-only access to `runs/` folder + REST calls to FastAPI for launch.

### 2.2 Next.js Dashboard (Phase 10b)

**Goal:** Public-facing, paper-companion artifact. Used in screenshots in the paper and for a demo video.

Stack: Next.js 14 (app router) + TypeScript + Tailwind + shadcn/ui + recharts/visx for plots + tRPC or simple REST.

Routes:
- `/` — overview: latest runs, "best per domain" cards.
- `/run/new` — run launcher form.
- `/runs` — run table with filters (technique, domain, status, date).
- `/runs/[id]` — run detail (manifest, metrics, per-question explorer).
- `/compare?runs=a,b,c` — comparison view.
- `/pareto/[domain]` — Pareto plots per domain.
- `/leaderboard` — domain × technique leaderboard with CIs.
- `/findings` — rendered `FINDINGS.md` (markdown to HTML).
- `/decisions` — rendered `DECISIONS.md`.

---

## 3. Information Architecture

The most important screens, sketched:

### 3.1 Run Detail (single run)

```
┌─────────────────────────────────────────────────────────────────┐
│  graph_rag · legal · seed=1            run_id 20260612-1402-... │
│  Status: complete · 50 queries · 3m12s · $0.42                  │
├─────────────────────────────────────────────────────────────────┤
│  Faithfulness   0.78 ± 0.04    EM       0.41 ± 0.06             │
│  Recall@5       0.86 ± 0.03    Halluc.  0.07 ± 0.02             │
│  Tokens in/out  84,310 / 7,221  Latency p50 1.4s · p95 3.8s     │
├─────────────────────────────────────────────────────────────────┤
│  [Per-question explorer]                                        │
│  Q. "How does Article 5 of GDPR interact with…"                 │
│    Answer:  …                                          ▼ expand │
│    Retrieved: 5 chunks  →  inspect graph subgraph               │
│    Judge:    faithful=2/2, complete=1/2, fluency=2/2            │
└─────────────────────────────────────────────────────────────────┘
[ Replay command ▢ ] [ Export run.tar.gz ] [ Share permalink ]
```

### 3.2 Comparison view

```
┌─────────────────────────────────────────────────────────────────┐
│  Comparing 3 runs · domain=legal · benchmark=full               │
├──────────────────┬─────────────┬─────────────┬─────────────────┤
│  Metric          │ naive_rag   │ hybrid_rag  │ graph_rag       │
├──────────────────┼─────────────┼─────────────┼─────────────────┤
│  Faithfulness    │ 0.61 ± .05  │ 0.71 ± .04  │ 0.78 ± .04 ★    │
│  EM              │ 0.28 ± .07  │ 0.36 ± .06  │ 0.41 ± .06 ★    │
│  Hallucination   │ 0.18 ± .03  │ 0.11 ± .02  │ 0.07 ± .02 ★    │
│  Cost / query    │ $0.0021     │ $0.0034     │ $0.0084         │
│  Latency p50     │ 0.7s        │ 1.1s        │ 1.4s            │
│  Significance    │ baseline    │ p<.01 vs N  │ p<.001 vs N     │
└─────────────────────────────────────────────────────────────────┘
[ Per-question diff ] [ Pareto plot ] [ Failure mode breakdown ]
```

★ = best in column. Pairwise significance via paired Wilcoxon with Holm correction is computed server-side.

### 3.3 Pareto plot

X-axis: cost per query (log scale). Y-axis: faithfulness (or chosen metric). Each technique is a labeled point with a 95% CI ellipse. The Pareto frontier is highlighted; off-frontier techniques are greyed.

A toggle switches Y-axis among `faithfulness`, `EM`, `recall@5`, `1 - hallucination`, etc., and X-axis among `cost`, `latency_p50`, `peak_memory_mb`.

### 3.4 Per-question diff

For a chosen pair (or triple) of runs, list questions where they disagree. For each: side-by-side answers, retrieved chunks, judge rationales. This is the qualitative debugging surface.

---

## 4. Backend Contract for the UI

The UI reads only from:
- **FastAPI endpoints** (see `03_BACKEND_DESIGN.md §7`): `/runs`, `/runs/{id}`, `/runs/{id}/stream`, `/runs/{id}/outputs`, `/compare`, `/techniques`, `/domains`.
- **Static markdown** for `FINDINGS.md`, `DECISIONS.md` (rendered server-side or client-side).

The UI never reads `runs/` directly — that's the FastAPI's job. This keeps the UI deployable independently.

---

## 5. Visualization Components

| Component | Library | Purpose |
|---|---|---|
| Metric tables with CI | shadcn `Table` + custom CI cell | Comparison views |
| Pareto scatter | recharts `ScatterChart` | Trade-off plots |
| Run timeline | recharts `LineChart` | Cost / latency over time |
| Confidence bands | custom SVG overlay | CI ellipses |
| Markdown render | `react-markdown` + `rehype-highlight` | FINDINGS / DECISIONS |
| Chunk inspector | shadcn `Sheet` (drawer) | Drill into retrieved chunks |
| Graph subgraph viewer | `react-flow` | GraphRAG context inspection |
| Reflection token timeline | custom horizontal stepper | Self-RAG / Agentic inspection |

---

## 6. Real-Time Updates

Long runs stream progress over SSE:

```
event: progress
data: {"run_id":"...", "completed":12, "total":50, "current_q":"..."}

event: question
data: {"q_id":"q42", "answer":"...", "metrics":{...}}

event: complete
data: {"run_id":"...", "metrics":{...}}
```

The UI keeps a single EventSource per run and updates the run-detail page in place.

---

## 7. Authentication & Access

- **Phase 10a (Streamlit MVP):** localhost only, no auth.
- **Phase 10b (Next.js):** optional GitHub OAuth for the public version. The paper companion site is read-only; experiment launching requires login.
- API keys for Gemini etc. live server-side only — the UI never touches them.

---

## 8. Theming & Branding

- Light / dark mode toggle (system default).
- Monospace numbers in metric tables (tabular-nums).
- Color palette: neutral greys + a single accent (TBD). Charts use the Okabe-Ito colorblind-safe palette.
- No animations on metric transitions (avoid bias toward "best" being eye-catching).

---

## 9. Performance Budget (Next.js)

- Initial bundle ≤ 250 KB gzipped.
- Comparison view loads ≤ 6 runs × 200 questions in ≤ 500 ms after data fetch.
- Pareto plot renders ≤ 50 points in ≤ 100 ms.
- All long-running queries paginated.

---

## 10. Testing

- **Streamlit:** smoke tests via `streamlit testing` framework.
- **Next.js:** Playwright end-to-end (run-launcher → run-detail → comparison flow).
- **Visual regression:** chromatic or playwright-screenshots on key pages.

---

## 11. What Phase 10 Will Deliver

Phase 10a (week 1):
- Streamlit MVP with all 5 pages working against FastAPI.
- Internal use only.

Phase 10b (weeks 2–3):
- Next.js scaffold, comparison + Pareto + run-detail pages.
- Public read-only deployment for paper companion.

Phase 14 polish:
- Demo video.
- Embed-ready paper figures from the dashboard.

---

## 12. Out of Scope (For Now)

- Multi-tenant accounts.
- Annotation / labeling UI for human evaluation. *(If we add the 100-query human-judged sub-sample as a UI feature, it goes in Phase 13.)*
- Live editing of configs from the UI (config still authored in YAML; UI displays).
