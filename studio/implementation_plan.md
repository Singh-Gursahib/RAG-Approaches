# Ureap Studio — Implementation Plan

> **What this is.** An interactive, world-class Next.js application — *Ureap Studio* — that lets
> users explore, compare, and live-test the seven RAG / non-RAG strategies from the RAG_Ureap
> research project using **their own Gemini API key**, on **their own documents**, with a polished,
> educational, Apple-grade interface.
>
> **What this is NOT.** The existing `frontend/web/` static results dashboard. That visualizes the
> *paper's* fixed numbers. Ureap Studio is a *live execution* product: bring a key, bring a corpus,
> run approaches, compare, learn, decide.
>
> **Canonical research context.** Read the repo root `IMPLEMENTATION_PLAN.md`, `FINDINGS.md`, and the
> seven approaches in `src/ragureap/approaches/` before touching backend code. This plan does not
> re-derive that work; it *wraps and surfaces* it.

---

## 0. Operating Contract (read this first)

- **Folder.** Everything for this initiative lives under `studio/`. The only file we touch outside
  `studio/` is a thin re-export if the FastAPI server needs it — and even that imports the existing
  `ragureap` package read-only. **We never modify `src/ragureap/` core logic.** If a core change is
  truly required, it gets logged in the repo's `DECISIONS.md` first and justified.
- **Two processes, one product.** `studio/server/` (FastAPI, Python, reuses `ragureap`) and
  `studio/web/` (Next.js). Local-first: `make studio` (or a single script) launches both.
- **Bring Your Own Key.** The user's Gemini API key is entered in the browser, kept in memory /
  `sessionStorage` only, sent to the backend per-request via an `X-Gemini-Key` header, and **never
  written to disk, never logged, never persisted server-side.** This is a hard security rule.
- **Phase workflow.** User says "go do phase N" → agent executes the whole phase → updates
  `studio/MEMORY.md` → stops and waits. Phases are linear; sub-phases inside a phase may be reordered
  if dependencies demand, but the phase's exit criteria are the gate.
- **Quality bar.** Production-grade, not prototype. Every screen has: a considered empty state, a
  loading state, an error state, keyboard accessibility, and at least one intentional motion moment.
- **Design source of truth.** `frontend-skill.md` (repo root). Distinctive, intentional, non-generic.
  Refined-minimalist direction (see §Design Language below). No Inter/Roboto. No purple-on-white.

---

## Design Language (binding for all UI phases)

**Aesthetic direction:** *Editorial research instrument.* Calm, warm, paper-like canvas; near-black
ink; one confident warm accent; data-viz palette per approach. The feeling of a beautifully
typeset science journal that happens to be interactive. Apple-grade restraint: generous whitespace,
precise optical alignment, type that carries the hierarchy, motion that clarifies rather than decorates.

- **Type.**
  - Display / editorial headings: **Fraunces** (optical high-contrast serif; carries the "premium
    journal" feel; italic for emphasis moments).
  - UI / body: **Geist Sans** (crisp, modern, distinctive; not Inter).
  - Numerals / identifiers / traces / code: **JetBrains Mono** (tabular numerals for metrics).
- **Color tokens** (CSS variables in `globals.css`):
  - `--canvas` warm bone `#FBF9F5`, `--surface` `#FFFFFF`, `--ink` `#1A1A1A`, `--ink-muted` `#6B6B6B`,
    `--line` `rgba(0,0,0,0.08)`.
  - Accent: clay `#CF4520` (continuity with the paper's figures + existing dashboard).
  - Per-approach palette (reuse exactly from `frontend/web/lib/colors.ts` so Studio, dashboard, and
    paper figures are visually coherent): sliding_window `#1d1d1f`, full_context `#cf4520`,
    rerank `#2d6a4f`, naive `#6b7280`, hyde `#b8761a`, hybrid `#8b6f5e`, recursive_summary `#9b1d20`.
  - Semantic: success `#2d6a4f`, warning `#b8761a`, danger `#9b1d20`.
- **Motion.** Framer Motion. Page-load staggered fade-up (animation-delay ladder). Spring-based
  micro-interactions on buttons/cards. Route transitions (shared layout). Live trace timeline reveals
  step-by-step. Cost/latency tickers count up. Respect `prefers-reduced-motion` everywhere.
- **Surfaces.** Soft cards (`--surface`, hairline `--line`, large radius, restrained shadow). Glass
  only on the sticky header + key-status pill — nowhere it hurts legibility.
- **Texture.** Subtle film-grain overlay on the canvas (very low opacity) for depth, matching the
  dashboard's existing grain.

---

## Folder Structure (target end-state)

```
studio/
├── implementation_plan.md          ← THIS FILE
├── MEMORY.md                       ← live handoff (≤150 lines, updated every phase)
├── README.md                       ← (Phase 10) how to run, architecture, security note
├── run.sh                          ← (Phase 1) launches server + web together
├── server/                         ← FastAPI backend (reuses ragureap)
│   ├── pyproject.toml / requirements.txt
│   ├── app/
│   │   ├── main.py                 ← FastAPI app, CORS, lifespan, error handlers
│   │   ├── deps.py                 ← API-key extraction, per-request GeminiClient factory
│   │   ├── sessions.py             ← in-memory session + built-index cache (TTL, LRU)
│   │   ├── schemas.py              ← Pydantic request/response models
│   │   ├── service.py              ← orchestration: build indexes, run approaches, grade
│   │   ├── streaming.py            ← SSE helpers (trace + cost events)
│   │   ├── pricing.py              ← model price table (overridable)
│   │   └── routers/
│   │       ├── meta.py             ← /health, /approaches, /domains, /pricing
│   │       ├── corpus.py           ← /corpus (upload/paste → chunk preview)
│   │       ├── run.py              ← /run (single question, 1+ approaches, SSE)
│   │       ├── eval.py             ← /eval (question set + gold → metrics + stats)
│   │       └── replay.py           ← /replay (bundled case-study corpus + eval set)
│   └── tests/                      ← pytest: schema, service, key-isolation, eval math
└── web/                            ← Next.js 14 (App Router) app
    ├── package.json
    ├── next.config.mjs / tsconfig.json / tailwind.config.ts / postcss.config.mjs
    ├── app/
    │   ├── layout.tsx              ← fonts, shell, providers, grain
    │   ├── globals.css             ← tokens, typography, motion utilities
    │   ├── page.tsx                ← landing / onboarding
    │   ├── playground/page.tsx     ← ask-anything live runner
    │   ├── compare/page.tsx        ← side-by-side comparison + viz
    │   ├── evaluate/page.tsx       ← full eval harness
    │   ├── replay/page.tsx         ← reproduce the paper's case study
    │   ├── profiler/page.tsx       ← cost × quality × latency profiler
    │   ├── recommend/page.tsx      ← "which approach for which domain" recommender
    │   └── history/page.tsx        ← experiment history + saved configs
    ├── components/
    │   ├── ui/                     ← Button, Card, Input, Tooltip, Tag, Toast, Modal, Skeleton, …
    │   ├── viz/                    ← ParetoChart, LatencyBars, TokenBars, ProbeRadar, WinLoss, ForestPlot
    │   ├── run/                    ← ApproachPicker, CorpusUploader, TraceTimeline, AnswerCard, CostTicker
    │   ├── learn/                  ← ApproachExplainer, DomainGuide, Tour, HelpPopover
    │   └── shell/                  ← Header, Nav, KeyStatusPill, KeyModal, Footer
    └── lib/
        ├── api.ts                  ← typed fetch client + SSE hook
        ├── key.ts                  ← BYO-key storage (sessionStorage), redaction
        ├── approaches.ts           ← labels, colors, taglines, families, explainers (mirrors core)
        ├── domains.ts              ← domain → recommended approaches (from FINDINGS.md)
        ├── store.ts                ← history + saved configs (IndexedDB/localStorage)
        ├── types.ts                ← shared API types (kept in sync with server schemas.py)
        └── format.ts               ← fmtUSD, fmtPct, fmtMs, tokenfmt
```

---

# The 10 Phases

Each phase: **Goal · Sub-phases · Key files · Exit criteria.** Mark `[x]` in MEMORY.md when done.

---

## Phase 1 — Foundation, Scaffolding & Dev Orchestration

**Goal.** Both apps exist, install cleanly, talk to each other over a health check, and launch with a
single command. Design tokens and the app shell render. No features yet — just a trustworthy skeleton.

**Sub-phases.**
1.1 **Backend scaffold.** Create `studio/server/` with FastAPI, `uvicorn`, `pydantic`, and a
   `requirements.txt` (or extend the repo `pyproject.toml` with a `studio` optional-dependency group).
   Confirm the server can `import ragureap` (the editable install in `.venv`).
1.2 **`/health` endpoint** returning `{status, ragureap_version, model_default}` — proves the package
   import path works.
1.3 **CORS + lifespan.** Allow `localhost:3000`. Add a startup log that warns embeddings/reranker
   models download on first use.
1.4 **Next.js scaffold.** Create `studio/web/` (Next 14 App Router, TypeScript, Tailwind). Mirror the
   existing dashboard's tooling versions where sensible. Add Framer Motion, lucide-react, recharts, clsx.
1.5 **Design tokens & fonts.** `globals.css` with the full token set (§Design Language). Wire Fraunces +
   Geist + JetBrains Mono (next/font). Tailwind config maps tokens + per-approach colors.
1.6 **App shell.** `layout.tsx`: sticky glass header, nav placeholder, grain overlay, footer. A single
   styled landing placeholder that fetches `/health` and shows backend status (proves end-to-end wiring).
1.7 **Dev orchestration.** `studio/run.sh` (and a root `make studio` target) that boots uvicorn +
   `next dev` concurrently. `studio/README.md` stub with the run command.
1.8 **Lib primitives.** `lib/format.ts`, `lib/types.ts` (initial), `lib/api.ts` (typed fetch base).

**Key files.** `server/app/main.py`, `server/requirements.txt`, `web/app/layout.tsx`,
`web/app/globals.css`, `web/tailwind.config.ts`, `web/lib/api.ts`, `studio/run.sh`, `studio/README.md`.

**Exit criteria.**
- `studio/run.sh` boots both; visiting `localhost:3000` shows the shell with a green "backend
  connected" status sourced from `/health`.
- Fonts and color tokens render; grain visible; reduced-motion respected.
- `pytest studio/server/tests` runs (one health test passing).

---

## Phase 2 — Backend Core: Sessions, BYO-Key, Live Single-Question Runs

**Goal.** The heart of the product: ingest a corpus, build per-approach indexes once, answer a single
question with one or more approaches using the **user's** key, and stream the trace + cost live.

**Sub-phases.**
2.1 **Key handling (`deps.py`).** Extract `X-Gemini-Key` header. Build a per-request `GeminiClient`
   with that key (the existing client already accepts `api_key=`). If absent/invalid → 401 with a
   clear message. **Never log the key**; add a redaction guard in any error path.
2.2 **Pricing (`pricing.py`).** Wrap `ragureap.eval.cost.Price`; allow per-request price override
   (input/output per-M) so users can model their own tier. Default = repo defaults.
2.3 **Per-session budget ledger.** A lightweight in-memory ledger per session (NOT the project's
   `$5` global file ledger). Optional user-set soft cap; default off. Surfaces cumulative spend.
2.4 **Corpus ingestion (`/corpus`).** Accept pasted text or uploaded `.txt`/`.md` files (multipart).
   Reuse `data/chunk.py` (`chunk_document`) + a corpus model. Return a **chunk preview**: counts,
   token estimate, per-doc breakdown, and the first N chunks (so the UI can teach chunking). Configurable
   `target_tokens` / `overlap_tokens`.
2.5 **Session + index cache (`sessions.py`).** A session id maps to: corpus, chunks, full_text, and a
   cache of *built approach indexes* (Chroma/BM25/reranker are expensive — build once per
   (session, approach), reuse across questions). LRU + TTL eviction; memory-bounded; thread-safe.
2.6 **Approach orchestration (`service.py`).** Given a session + approach name + question + key:
   instantiate the registered approach (reuse `runner.APPROACH_REGISTRY` / `_eager_register`), run
   `setup()` once (cached), `attach_llm(client)`, call `answer()`, and return the `AnswerWithTrace`
   serialized (steps, tokens, latency, cost, retrieved chunk ids + scores + text).
2.7 **`/run` endpoint + SSE (`run.py`, `streaming.py`).** Accept `{session_id, question, approaches[],
   config}`. Stream Server-Sent Events: `approach_start`, `step` (per TraceStep), `approach_done`
   (answer + totals), `error`, `done`. This powers the live trace timeline. Provide a non-streaming
   fallback for environments without SSE.
2.8 **Robust errors.** Map Gemini rate-limit / quota / safety-block / empty-output cases (the client
   already handles many) to typed, user-friendly API errors. Per-approach failures don't kill the run.
2.9 **Schemas (`schemas.py`) + tests.** Pydantic models for every request/response. Tests:
   key-isolation (no key in logs/responses), corpus chunking, single-approach run with a **mocked**
   LLM (no real spend), SSE event ordering.

**Key files.** `server/app/deps.py`, `sessions.py`, `service.py`, `streaming.py`, `pricing.py`,
`schemas.py`, `routers/corpus.py`, `routers/run.py`, `routers/meta.py` (add `/approaches`, `/pricing`).

**Exit criteria.**
- With a real key (manual), a pasted corpus + one question through `/run` streams trace steps and
  returns an answer + honest per-approach cost/latency/tokens.
- Building indexes is cached: a second question on the same session does **not** re-embed.
- All backend tests green with a mocked LLM (zero spend in CI).
- Key never appears in any response body, log line, or error trace (test-enforced).

---

## Phase 3 — Backend Eval Harness, Replay & Profiler Endpoints

**Goal.** Everything needed to *grade* and *reproduce*: run a question set with gold answers, compute
the paper's metrics + statistics, replay the bundled case study, and expose cost/latency aggregates.

**Sub-phases.**
3.1 **Eval input model.** Accept a question set: `[{id, type, question, gold_answer}]` (type ∈ the five
   probe types, optional). Validate; cap size with a clear message (protect the user's wallet).
3.2 **`/eval` orchestration.** For each selected approach: build index once, answer every question,
   grade with `ragureap.eval.metrics` (`grade_one`, `aggregate`) → overall EM/F1, per-probe-type
   breakdown, hallucination correctness. Stream progress via SSE (question-by-question, live cost).
3.3 **Statistics.** Reuse `ragureap.eval.stats` for percentile-bootstrap 95% CIs and Holm-corrected
   paired Wilcoxon. Return pairwise significance matrices and per-approach CIs (mirrors the paper).
3.4 **Win-loss matrix.** Compute head-to-head per-question win/loss/tie counts between approaches
   (same logic as the dashboard's `win_matrix`).
3.5 **Cost/latency aggregation.** Per approach: total + per-question cost, p50/p95 latency, tokens
   in/out. Shape it for the Pareto + profiler views.
3.6 **Replay (`/replay`).** Bundle (read-only) the repo's `data/eval_corpus/` + `tests/eval_set.jsonl`.
   Expose `/replay/meta` (corpus + question set description) and let `/eval` accept `source: "bundled"`
   so users reproduce the paper's headline numbers with their own key. Include a pre-flight cost estimate.
3.7 **Pre-flight cost estimator.** Given approaches × question count, estimate spend *before* running
   (so the UI can warn). Reuse the price table + rough token heuristics.
3.8 **Tests.** Eval math against canned predictions with known EM/F1; stats sanity; replay loads the
   bundled assets; pre-flight estimate is monotonic in question count.

**Key files.** `server/app/routers/eval.py`, `routers/replay.py`, extend `service.py`, `schemas.py`.

**Exit criteria.**
- `/eval` on a small user-supplied gold set returns EM/F1, per-probe, CIs, pairwise significance, and
  win-loss — matching the metrics the paper reports.
- `/replay` reproduces the case-study corpus + 34-question set; a full replay (mocked in tests, real
  when the user runs it) produces a leaderboard consistent with `FINDINGS.md`.
- Pre-flight estimate returned before any spend.

---

## Phase 4 — Design System, App Shell & BYO-Key Experience

**Goal.** The reusable UI foundation and the key-entry experience. After this phase the app *feels*
premium even before features land.

**Sub-phases.**
4.1 **UI primitives (`components/ui/`).** Button (primary/ghost/quiet + loading), Card, Input/Textarea,
   Select, Tag/Chip, Tooltip, HelpPopover, Toast system, Modal/Dialog, Skeleton, EmptyState, Tabs,
   Slider, Switch, ProgressBar, Badge. All keyboard-accessible, focus-ringed, motion-aware.
4.2 **Iconography & illustration.** lucide-react throughout; a small set of tasteful inline SVG
   illustrations for empty states / onboarding (no stock clip-art feel).
4.3 **Shell (`components/shell/`).** Sticky glass `Header` with logo wordmark (Fraunces), primary
   `Nav` (Playground · Compare · Evaluate · Replay · Profiler · Recommend · History), and a
   `KeyStatusPill` (shows "Key connected" / "Add key", click → KeyModal).
4.4 **BYO-key flow (`KeyModal`, `lib/key.ts`).** Modal to paste the Gemini key, with: a "how to get a
   key" link, a "test key" button (calls `/health` with the key or a cheap probe), masked display,
   "clear key" action, and an explicit **"stored in this browser session only, never uploaded to us"**
   reassurance. Persist to `sessionStorage`; inject via `X-Gemini-Key` in `lib/api.ts`.
4.5 **API client + SSE hook (`lib/api.ts`).** Typed fetch wrapper (attaches key + base URL), error
   normalization, and a `useEventStream` React hook for `/run` and `/eval` SSE with reconnect + abort.
4.6 **Motion primitives.** Shared `fadeUp`, `stagger`, route-transition wrapper, and a `<Reveal>`
   component. Reduced-motion variants.
4.7 **Approach + domain metadata (`lib/approaches.ts`, `lib/domains.ts`).** Mirror core labels/colors
   and author the *educational* layer: one-paragraph plain-English explainer per approach, "best for /
   weak at", cost/latency character, and domain → recommended-approach mappings derived from
   `FINDINGS.md` (e.g., needle-critical → rerank; sub-window corpus → full_context/sliding_window;
   never recursive_summary for factoid recall).

**Key files.** `web/components/ui/*`, `web/components/shell/*`, `web/lib/key.ts`, `web/lib/api.ts`,
`web/lib/approaches.ts`, `web/lib/domains.ts`, motion utilities in `globals.css` + a `motion.ts`.

**Exit criteria.**
- A component gallery (temporary `/_kitchen` route, removed in Phase 10) renders every primitive in
  all states.
- Key modal stores/clears a key in sessionStorage; "test key" gives clear success/failure; key is
  masked and never rendered in full after entry.
- Nav + header responsive, accessible (keyboard + screen-reader labels), motion respects preferences.

---

## Phase 5 — Playground: Ask-Anything Live Runner

**Goal.** The core interactive loop. Upload/paste a corpus, configure chunking + retrieval, pick one
or more approaches, ask a question, watch each approach think live, read the answers.

**Sub-phases.**
5.1 **Guided layout.** A calm three-step flow (Corpus → Approaches → Ask) with progress affordance,
   contextual help at each step, and graceful empty states + examples ("try a sample corpus").
5.2 **CorpusUploader (`components/run/`).** Drag-drop / paste / sample-load. Shows live chunk preview
   from `/corpus` (chunk count, token estimate, per-doc bars). Chunking controls (target/overlap)
   with inline "what is chunking?" help and sensible defaults.
5.3 **ApproachPicker.** Cards per approach: label, family tag, color, one-line tagline, expandable
   plain-English explainer (from `lib/approaches.ts`), and a "recommended for your corpus size" hint
   (e.g., full_context flagged green when corpus fits comfortably; warned when large). Multi-select.
5.4 **Retrieval config.** top_k, top_n (rerank/hybrid), temperature, max_output_tokens — only the
   controls relevant to the selected approaches, each with a tooltip. Defaults from the paper.
5.5 **Pre-flight estimate.** Before running, show estimated cost/latency for the selection (from
   `/run` pre-flight or a client estimate) so users opt in knowingly.
5.6 **Live run via SSE.** "Run" triggers `/run` streaming. For each approach a `TraceTimeline`
   reveals steps as they arrive (retrieve → rerank → generate, etc.), with per-step tokens/latency/cost
   and an animated `CostTicker`. Per-approach error surfaces inline without aborting siblings.
5.7 **AnswerCard.** Final answer per approach, with retrieved-chunk inspector (expand to see which
   chunks were used, scores, and where the answer came from), total cost/latency/tokens, and a
   "NOT_IN_CONTEXT → honest refusal" badge when the model abstains.
5.8 **Persistence hook.** On completion, write the run to history (`lib/store.ts`, fleshed out in
   Phase 9) so it appears in History and can seed a saved config.

**Key files.** `web/app/playground/page.tsx`, `web/components/run/CorpusUploader.tsx`,
`ApproachPicker.tsx`, `TraceTimeline.tsx`, `AnswerCard.tsx`, `CostTicker.tsx`, `RetrievalConfig.tsx`.

**Exit criteria.**
- End-to-end: paste corpus → pick 2–3 approaches → ask → watch live traces → read answers, all with a
  real key, under a believable cost shown up front.
- Re-asking on the same corpus is fast (index reuse from Phase 2).
- Every state (empty, loading, streaming, error, done) is designed, not default.

---

## Phase 6 — Comparison & Data Visualization

**Goal.** Turn a multi-approach run into an insight-rich comparison: side-by-side answers, trace diffs,
retrieval-quality inspection, and the cost × quality × latency visualizations.

**Sub-phases.**
6.1 **Compare view (`/compare`).** Pull the most recent (or a selected) multi-approach run. Columnar
   side-by-side of answers with alignment to the question; highlight agreement vs. divergence.
6.2 **Trace diff.** Step-by-step comparison of pipelines (e.g., HyDE's extra rewrite step vs. naive),
   visually explaining *why* approaches differ — an educational centerpiece.
6.3 **Retrieval-quality inspector.** For RAG approaches, show retrieved chunk overlap across
   approaches, and (when gold/source is known, e.g., replay) whether the supporting chunk was retrieved.
6.4 **Viz components (`components/viz/`).** `ParetoChart` (cost × F1/answer-confidence; recharts
   scatter; reuse the dashboard's visual style), `LatencyBars`, `TokenBars`, `ProbeRadar`,
   `WinLossMatrix`, `ForestPlot` — adapted from the existing dashboard components for consistency.
6.5 **Cost/latency panel.** Per-approach cost, latency p50/p95, tokens, with the animated count-ups
   and clear "cheapest / fastest / best" callouts.
6.6 **Insights strip.** Auto-generated plain-English observations for the current comparison ("Naive
   and Rerank retrieved the same chunks here, so the extra rerank cost bought nothing on this
   question") — templated from the trace data + the research findings.

**Key files.** `web/app/compare/page.tsx`, `web/components/viz/*`, `web/components/run/TraceDiff.tsx`,
`RetrievalInspector.tsx`, `InsightsStrip.tsx`.

**Exit criteria.**
- A multi-approach run renders a side-by-side comparison with trace diff + retrieval inspector.
- Pareto / latency / token charts render from live run data and match the dashboard's visual language.
- At least three templated insights fire correctly on a representative comparison.

---

## Phase 7 — Full Evaluation Harness UI

**Goal.** Reproduce the paper's *methodology* on the user's own data: bring a question set with gold
answers, grade approaches, and read a trustworthy results dashboard with CIs and significance.

**Sub-phases.**
7.1 **Eval setup (`/evaluate`).** Corpus (reuse uploader) + a question-set editor/uploader accepting
   JSONL or a guided table editor (`{question, gold_answer, type}`), with validation and probe-type
   hints. Sample/template question sets offered.
7.2 **Approach selection + pre-flight.** Multi-select with the full cost estimate for
   approaches × questions, plus an optional soft budget cap the user can set.
7.3 **Run with live progress.** `/eval` SSE: a per-approach progress bar advancing question-by-question
   with a running cost ticker and ETA. Cancelable.
7.4 **Results dashboard.** Leaderboard (EM/F1 with bootstrap CIs, sortable), per-probe-type breakdown
   (radar + table), win-loss matrix, pairwise significance (Holm-corrected) rendered honestly (show
   "statistically tied" where the paper would).
7.5 **Hallucination-risk panel.** Per-approach hallucination correctness on the deliberately-absent
   questions, framed as "refusal honesty" — a first-class safety view (high value for legal/healthcare).
7.6 **Per-question explorer.** Table of every question × approach with EM/F1, prediction vs. gold,
   and correctness, filterable by probe type — mirrors the dashboard's question diff.
7.7 **Export.** Download results as JSON/CSV; "save as experiment" into History.

**Key files.** `web/app/evaluate/page.tsx`, `web/components/run/QuestionSetEditor.tsx`,
`EvalProgress.tsx`, `HallucinationPanel.tsx`, plus reused `viz/` components.

**Exit criteria.**
- A user-supplied gold set runs end-to-end and produces a leaderboard + per-probe + win-loss +
  significance + hallucination panel, all from `/eval`.
- CIs and "statistically tied" framing render honestly (no over-claiming separation).
- Results export and persist to History.

---

## Phase 8 — Replay Case Study, Cost/Latency Profiler & Recommendations Engine

**Goal.** Three high-trust surfaces: reproduce the paper, profile cost/quality/latency, and *advise*.

**Sub-phases.**
8.1 **Replay (`/replay`).** A polished walkthrough: describe the bundled 8K-token corpus + 34-question
   set + five probe types, show the *expected* paper numbers, then "Run it with your key" → live
   `/eval` against bundled assets → user's reproduction shown next to the paper's published figures.
8.2 **Reproduction delta.** Side-by-side "paper vs. your run" with a gentle explanation of why small
   deltas occur (model preview drift, seed/temperature), reinforcing the framework's honesty.
8.3 **Profiler (`/profiler`).** A dedicated cost × quality × latency studio over any run/eval in
   History: interactive Pareto (toggle EM/F1/confidence), cost-per-correct-answer, latency
   distributions, token economics, and a "what changes if I switch model price tier?" slider that
   re-prices instantly (client-side, using the per-call token records).
8.4 **Recommendations engine (`/recommend`).** A guided recommender: the user picks a use case
   (education, legal research, healthcare, enterprise search, customer support, knowledge management)
   and answers 3–4 plain-English questions (corpus size, needle vs. reasoning, refusal sensitivity,
   budget sensitivity). Output: a ranked recommendation with rationale tied to specific research
   findings (e.g., "Healthcare → prioritize refusal honesty + needle recall → Reranker or Full-Context;
   avoid Recursive Summarization, which strips identifiers"). Every claim links to the evidence.
8.5 **Domain guides (`components/learn/DomainGuide.tsx`).** Short, beautiful explainers per domain with
   the recommended stack and caveats, reusable inside Recommend and as standalone learning content.

**Key files.** `web/app/replay/page.tsx`, `web/app/profiler/page.tsx`, `web/app/recommend/page.tsx`,
`web/components/learn/DomainGuide.tsx`, `RecommenderWizard.tsx`, `PriceTierSlider.tsx`.

**Exit criteria.**
- Replay runs the bundled case study with the user's key and shows reproduction vs. paper side-by-side.
- Profiler re-prices a past run live via the price-tier slider; Pareto/latency/token views are correct.
- Recommender returns an evidence-linked, domain-specific recommendation for all six use cases.

---

## Phase 9 — Experiment History, Saved Configs, Onboarding & Education Layer

**Goal.** Make experimentation *effortless and sticky*: remember what users did, let them rerun/save
configurations, and weave teaching throughout.

**Sub-phases.**
9.1 **Persistence (`lib/store.ts`).** IndexedDB (with localStorage fallback) for: experiment history
   (runs + evals, with metadata + results snapshot), and saved configurations (corpus ref, approaches,
   retrieval settings). Versioned schema; export/import all data as a JSON file.
9.2 **History view (`/history`).** Timeline/list of past experiments with quick stats, filters
   (type, approach, date), reopen-in-Playground/Evaluate, duplicate, delete, and "compare two past
   runs". Beautiful empty state for first-time users.
9.3 **Saved configs.** Name/save a configuration from any run; one-click apply. Ship a few curated
   starter configs ("Needle stress test", "Multi-hop reasoning", "Refusal honesty check").
9.4 **Onboarding flow.** First-visit guided tour (spotlight steps): add key → load sample corpus →
   pick approaches → run → read results. Skippable, resumable, never nags. Tasteful, not a popup storm.
9.5 **Education layer.** Contextual `HelpPopover`s on every non-obvious control; an "Explain this
   approach" affordance everywhere an approach appears; a glossary (chunking, embeddings, reranking,
   RRF, HyDE, EM/F1, bootstrap CI, probe types) reachable from any `?` icon.
9.6 **Empty/example states.** Every page that can be empty offers a one-click example that demonstrates
   value immediately (sample corpus + sample question + a sensible approach selection).

**Key files.** `web/lib/store.ts`, `web/app/history/page.tsx`, `web/components/learn/Tour.tsx`,
`Glossary.tsx`, `HelpPopover.tsx`, `SavedConfigs.tsx`.

**Exit criteria.**
- Runs and evals persist across reloads; history reopen/duplicate/delete works; export/import round-trips.
- Saved configs apply correctly; starter configs present.
- Onboarding tour runs once, is skippable/resumable; glossary + contextual help reachable everywhere.

---

## Phase 10 — Polish, Accessibility, Performance, Docs & QA

**Goal.** Take it from "feature-complete" to "Apple-grade shippable." Nothing half-finished.

**Sub-phases.**
10.1 **Motion orchestration pass.** Consistent page-load ladders, route transitions, and one signature
   moment per page. Audit timing/easing; kill any motion that doesn't clarify. Verify reduced-motion.
10.2 **Accessibility audit.** Keyboard traversal of every flow, focus management in modals/SSE updates,
   ARIA labels/roles, color-contrast (AA+), screen-reader pass on the key flows, `aria-live` for live
   trace/cost updates. Fix all findings.
10.3 **Responsive pass.** Mobile/tablet/desktop for every page; charts degrade gracefully; nav collapses
   elegantly.
10.4 **Performance.** Code-split charts, memoize heavy renders, virtualize long tables (per-question
   explorer), lazy-load illustrations, check first-load JS budgets. Production build clean.
10.5 **Resilience.** Network-failure, invalid-key, quota-exceeded, empty-corpus, oversized-corpus,
   model-safety-block — every error has a designed, recoverable state with a helpful message.
10.6 **Remove scaffolding.** Delete `/_kitchen`, dead code, TODOs. Lint + typecheck clean on both apps.
10.7 **Docs.** Finalize `studio/README.md`: architecture diagram, the **BYO-key security note**, run
   instructions (`run.sh` / `make studio`), how to point at a different model/price tier, and a
   "reproduce the paper" pointer. Add a short root README mention linking to Studio.
10.8 **Final QA script.** A written manual test pass covering all six use-case recommendations, a live
   playground run, a full eval, a replay, and a profiler re-price — documented as a checklist.

**Key files.** `studio/README.md`, cross-cutting edits across `web/` and `server/`.

**Exit criteria.**
- `next build` and backend start clean; lint/typecheck green; no scaffolding routes remain.
- Accessibility, responsive, and performance passes documented as complete with fixes applied.
- README explains architecture + security + how to run + how to swap models; QA checklist passes.

---

## Phase Gate Summary

| Phase | One sentence | Gate |
|---|---|---|
| 1 | Both apps boot and handshake. | `run.sh` launches both; shell shows backend status. |
| 2 | Live single-question runs with BYO key + SSE. | `/run` streams traces; index cache works; key never leaks. |
| 3 | Eval + replay + profiler endpoints. | `/eval` returns paper-grade metrics; `/replay` loads bundled assets. |
| 4 | Design system + key experience. | Primitives gallery; key modal; SSE hook; a11y baseline. |
| 5 | Playground end-to-end. | Paste corpus → pick approaches → live answers. |
| 6 | Comparison + visualization. | Side-by-side + trace diff + Pareto/latency/token charts. |
| 7 | Full eval harness UI. | Gold set → leaderboard + CIs + win-loss + hallucination panel. |
| 8 | Replay + profiler + recommender. | Reproduce paper; re-price live; domain recommendations. |
| 9 | History, saved configs, onboarding, education. | Persistence + tour + glossary + examples. |
| 10 | Polish, a11y, perf, docs. | Clean build; audits done; README + QA checklist. |

---

## What I Need From You (Upfront)

1. **Gemini API key for development.** The product is BYO-key, but I need a working key to test live
   runs during Phases 2–8. You already have one in the repo `.env` (`GOOGLE_API_KEY`); confirm I may
   use it for development testing (each full test run is well under a few cents on
   `gemini-3-flash-preview`). I will never commit it or print it.
2. **Spend comfort.** Confirm a small dev-testing budget (e.g., "up to $1 of API spend for building/
   testing Studio"). All automated tests mock the LLM (zero spend); only my manual end-to-end checks
   cost anything.
3. **Product name.** Working title is **"Ureap Studio"** — say the word if you'd prefer another name /
   wordmark and I'll thread it through.
4. **Model scope.** The paper is model-agnostic, but the live runner currently targets Gemini (the only
   implemented client). OK to ship Gemini-only for v1 with the price-tier slider for cost modeling, and
   list "other providers" as a documented extension point? (Adding OpenAI/Anthropic clients would be a
   later phase.)
5. **Nothing else required.** No database (history is browser-local), no third-party services, no auth.
   Node 18+ and the existing `.venv` are sufficient.

> Answer #1–#4 whenever convenient; I can begin Phase 1 immediately (it needs no key or spend).

---

*This plan is the contract for Ureap Studio. Update `studio/MEMORY.md` after every phase. Do not modify
`src/ragureap/` core logic without logging it in the repo's `DECISIONS.md` first.*
