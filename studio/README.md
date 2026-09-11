<div align="center">

# 🗺️ RAG Atlas

**An interactive studio for testing retrieval strategies on your own documents, with any model on OpenRouter.**

Compare seven RAG and non-RAG approaches live · grade them on your data · see cost, latency, and
hallucination risk · get a domain-aware recommendation.

*A hands-on companion to the [RAG_Ureap](../README.md) research framework.*

</div>

---

## What is this?

The RAG literature is full of variants — naive vector retrieval, hybrid BM25+dense, HyDE,
cross-encoder reranking, full-context, recursive summarization, sliding-window — and almost no one
gets to see them **run head-to-head, under identical conditions, on data that looks like their own**.

RAG Atlas closes that gap interactively. You bring a corpus and an OpenRouter API key and pick a model; it runs any mix of
the seven reference strategies *live*, streams each one's reasoning step by step, and shows you the
answers, the retrieved chunks, the cost, the latency, and — if you supply gold answers — a fully
scored leaderboard with confidence intervals and statistical significance.

> This is **not** the static results dashboard in [`../frontend/web/`](../frontend/web), which
> visualizes the *paper's* fixed numbers. RAG Atlas executes the approaches on demand.

### Why it's different

- **Bring your own key, model, and data.** Nothing is hard-coded to a benchmark or a model. Your key
  lives in your browser; your documents are processed in a private session; model calls reach
  OpenRouter with no app attribution attached.
- **Live, transparent execution.** Every retrieval and model call is streamed as a trace step with its
  own token count, latency, and cost — no black box.
- **The research, made actionable.** The findings from the RAG_Ureap paper power an evidence-linked
  recommender and contextual explanations throughout.

---

## The seven strategies

| Strategy | Family | What it does |
|---|---|---|
| **Naive RAG** | RAG | Embed the query → retrieve top-k chunks → generate. The baseline. |
| **Hybrid RAG** | RAG | BM25 (keyword) + dense (vector) retrieval, fused with Reciprocal Rank Fusion. |
| **HyDE** | RAG | Model drafts a hypothetical answer; that text drives retrieval. |
| **Reranker** | RAG | Retrieve top-20 → cross-encoder re-scores → keep top-5 → generate. |
| **Full-Context** | non-RAG | Drop the entire corpus into one prompt. Unbeatable when it fits. |
| **Recursive Summary** | non-RAG | Summarize each doc once, then answer from the summaries. |
| **Sliding-Window** | non-RAG | Read the corpus one document at a time, carrying a running answer. |

All seven are the **unchanged** reference implementations from `src/ragureap/` — RAG Atlas wraps them,
it doesn't reimplement them.

---

## Features

- **Playground** — paste/upload/sample a corpus, tune chunking live, pick strategies, ask a question,
  and watch each approach stream its trace with a live cost ticker. Inspect retrieved chunks and
  honest-refusal badges.
- **Compare** — side-by-side answers with agreement detection, a pipeline diff, a retrieval-overlap
  inspector, cost/latency/token bars, a cost×latency Pareto, and auto-generated plain-English insights.
- **Evaluate** — bring questions *with gold answers* and get the paper's methodology on your data:
  EM/F1 leaderboard with bootstrap 95% CIs, per-probe radar, win-loss matrix, Holm-corrected
  significance (honest "statistically tied" framing), a refusal-honesty panel, a per-question explorer,
  and JSON/CSV export.
- **Model choice** — a dropdown of curated OpenRouter models (Gemini 3 Flash, the paper's generator;
  Gemini 3.7 Flash; Gemini 3.8 Flash; GLM 5.3 Flash; DeepSeek V4.1 Flash) with live prices, plus any
  custom model slug and a reasoning-effort control. Every strategy in a run uses the same model.
- **Replay** — reproduce the paper's bundled 8K-token corpus + 34-question evaluation on any model,
  repeated like the paper's 3-run sweep, shown side by side with the published Gemini 3 Flash numbers
  plus similarity measures (mean F1 gap, rank agreement, how many strategies land inside the paper's
  confidence intervals).
- **Saved tests** — every finished evaluation or replay is written to `studio/results/` as JSON.
  **Load the results from a previous test** reopens one with exactly the numbers it produced.
- **Profiler** — the economics of retrieval: a price-tier slider re-prices any past evaluation
  instantly (model any provider) and recomputes cost, cost-per-correct-answer, latency, and the
  cost×quality Pareto.
- **Recommend** — a guided wizard: pick a use case (education, legal, healthcare, enterprise search,
  support, knowledge management), answer four questions, get a ranked recommendation with rationale
  drawn from the research.
- **History** — every run, evaluation, and saved configuration, stored only in your browser, with
  search, re-open, apply-config, and full export/import.
- **Learn as you go** — a first-visit tour, a glossary, and contextual help on every non-obvious control.

---

## Architecture

```
┌──────────────────────────────────────────────┐        ┌─────────────────────────────────────┐
│  studio/web  ·  Next.js 14 (App Router)        │        │  studio/server  ·  FastAPI           │
│  localhost:3000                                │        │  localhost:8000                      │
│                                                │ /api/* │                                      │
│  • BYO OpenRouter key (sessionStorage)         │ ─────▶ │  • X-OpenRouter-Key per request      │
│  • Playground / Compare / Evaluate / Replay /  │ (Next  │  • Session + index cache             │
│    Profiler / Recommend / History              │ rewrite│  • Streams traces + cost over SSE    │
│  • History stored in localStorage              │ )      │  • Wraps the read-only `ragureap` pkg│
└──────────────────────────────────────────────┘        └──────────────────┬──────────────────┘
                                                                            │ imports (read-only)
                                                          ┌─────────────────▼──────────────────┐
                                                          │  src/ragureap  (research package)    │
                                                          │  approaches · indexing · llm · eval  │
                                                          └─────────────────────────────────────┘
```

- The browser talks to **`/api/*`**, which Next rewrites to the FastAPI server (same-origin in dev).
- The FastAPI layer is a thin, model-agnostic wrapper. It reuses the research package's approaches,
  metrics, and statistics **without modification**.
- Long-running work (embedding, retrieval, generation) runs in a worker thread and streams **Server-Sent
  Events** back over a POST request; the client reads the stream with `fetch` (so the key can ride in a
  header, which native `EventSource` can't do).

### 🔒 Security model (important)

Your OpenRouter API key:
- is entered in the browser and stored **only** in that tab's `sessionStorage`;
- is sent to the backend **per request** via the `X-OpenRouter-Key` header, used to construct a one-shot
  model client, and **never persisted to disk, never written to logs, never returned in any response**;
- is scrubbed from any upstream error message before it leaves the server (`deps.redact`).

For local use you can instead put the key in the repo-root `.env` (gitignored) as `OPENROUTER_API_KEY`.
The server then uses it whenever a request carries no key, and the header pill reads **Server key**.

**Anonymous to OpenRouter.** OpenRouter attributes traffic to an app only through optional request
headers (`HTTP-Referer`, `X-OpenRouter-Title` / `X-Title`, `X-OpenRouter-Categories`,
`X-OpenRouter-App-Visibility`). RAG Atlas sends none of them and no `user` field: every request carries
only `Authorization` and `Content-Type` (`server/app/openrouter.py`, enforced by tests). Model calls are
made server-side, so no browser Origin or Referer reaches OpenRouter, and the public model list is
fetched without a key.

There is no database, no auth, and no server-side user state. Sessions (your uploaded corpus) live in
memory in a private temp directory and are evicted on a TTL. The only files the server writes are the
finished-test JSON files in `studio/results/`, which contain results and settings but never the key.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI · `uvicorn` · SSE-over-POST · `httpx` · reuses `ragureap` (ChromaDB, BM25, sentence-transformers, bge-reranker) |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · Recharts · lucide-react |
| Generator | Any OpenRouter model via its OpenAI-compatible chat completions API (default `google/gemini-3-flash-preview`, the paper's model) |
| Storage | Browser `localStorage` (history, saved configs, model choice) · finished tests as JSON in `studio/results/` |

**Design language:** an "editorial research instrument" — warm bone canvas, near-black ink, a single
clay accent, a per-approach palette shared with the paper figures, Geist (display + UI) + JetBrains
Mono (numerals), motion that clarifies and respects `prefers-reduced-motion`.

---

## Getting started

### Prerequisites
- Python 3.11+ and Node 18+ (developed on Node 22).
- An OpenRouter API key: create one at <https://openrouter.ai/keys>. Optionally store it in the repo-root
  `.env` as `OPENROUTER_API_KEY=...` so you don't have to paste it into the browser.

### 1. One-time setup (from the repo root)

```bash
# create the Python environment and install the research package + server deps
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"                       # installs the ragureap package
.venv/bin/pip install -r studio/server/requirements.txt # fastapi, uvicorn, sse-starlette, python-multipart

# install the web app's dependencies
cd studio/web && npm install && cd ../..
```

### 2. Run it — the easy way (both servers, one command)

From the **repo root**:

```bash
./studio/run.sh          # or:  make studio
```

This launches the **FastAPI backend on :8000** and the **Next.js app on :3000**
(Next falls back to :3001 if 3000 is taken). Then open the printed URL — usually
**http://localhost:3000** — click **Add your key** in the header, and you're ready.

Press **Ctrl-C** once to stop both servers.

### 2b. Run it — manually (two terminals)

Prefer separate terminals (e.g. to watch logs independently)? Run each half yourself,
**from the repo root**:

```bash
# terminal 1 — backend (http://localhost:8000, API docs at /docs)
.venv/bin/uvicorn studio.server.app.main:app --reload --port 8000
```

```bash
# terminal 2 — frontend (http://localhost:3000)
cd studio/web && npm run dev
```

> **First live run** downloads the local embedding model (~80 MB) and, for the Reranker, the
> cross-encoder (~1 GB). These are one-time and free; only OpenRouter model calls cost money (usually cents).

> ⚠️ Don't run `npm run build` while `npm run dev` is live — they share the `.next` folder and will
> corrupt each other's cache. Stop the dev server first (or build in a separate checkout).

### 3. Stop the servers

```bash
# if you used run.sh: just Ctrl-C in that terminal. Otherwise:
lsof -ti:8000 | xargs kill    # backend
lsof -ti:3000 | xargs kill    # frontend (use :3001 if it fell back)
```

### Useful checks

```bash
.venv/bin/python -m pytest studio/server/tests   # backend tests (LLM mocked → no API spend)
cd studio/web && npm run build                   # production build + type-check (dev server stopped)
cd studio/web && npm run lint                     # eslint
```

---

## Configuration

- **Model.** Any OpenRouter model slug. The curated list, prices, context windows, and reasoning
  controls come from OpenRouter's public model list (cached for an hour, with an offline snapshot in
  `server/app/data/`). Runs record the dollar cost OpenRouter reports for each call.
- **Reasoning.** The default, *Lowest available*, turns reasoning off when a model allows it and
  otherwise uses its lowest effort (GLM 5.3 Flash always reasons, so it runs at `low`). Because
  OpenRouter reserves a share of `max_tokens` for reasoning, the request limit is raised so the answer
  keeps its full budget and reasoning gets at least 1,024 tokens of room. Without that floor, models
  that must reason run out of room on long prompts (GLM 5.3 Flash's Full-Context F1 fell from 0.915 to
  0.490 with a 640-token limit). The limit is only a ceiling; unused tokens cost nothing. An empty
  answer cut off by the limit is retried once with double the limit.
- **Runs.** Evaluate and Replay can repeat a test 1 to 5 times with seeds 0, 1, 2, ... Headline
  numbers then follow the paper: mean of per-run scores ± run-to-run standard deviation, with
  bootstrap confidence intervals over all graded answers.
- **Overrides.** Per request you can also set retrieval (`top_k`, candidate pool), temperature, max
  answer tokens, and the price table; the Profiler's price-tier slider re-prices any run client-side.
- **CORS.** Set `RAG_ATLAS_CORS_ORIGINS` (comma-separated) to allow non-default web origins.
- **API base.** Set `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`) if the backend runs elsewhere.

### Reproducing the paper

Open **Replay**, pick a model, and run. It executes the bundled corpus + 34-question evaluation
(`data/eval_corpus/` and `tests/eval_set.jsonl`) with the paper's settings (temperature 0.3, 3 runs,
512-token answers) and compares your numbers to the published headline. Expect small deltas from the
model, its reasoning settings, and run-to-run sampling.

The paper's own Gemini 3 Flash sweep is available as a saved test. To regenerate it from the research
runs (it refuses to save unless it matches `paper/tables/sweep_headline.csv`):

```bash
.venv/bin/python studio/server/scripts/import_paper_sweep.py
```

---

## Project structure

```
studio/
├── README.md · QA_CHECKLIST.md · implementation_plan.md · MEMORY.md
├── run.sh                       # launches backend + frontend together
├── server/                      # FastAPI backend
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # app, CORS, router wiring, ragureap import shim
│       ├── deps.py              # X-OpenRouter-Key (or OPENROUTER_API_KEY) + redaction
│       ├── openrouter.py        # anonymous OpenRouter client: reasoning, retries, reported cost
│       ├── models_catalog.py    # curated models + live model metadata (offline snapshot in data/)
│       ├── results_store.py     # finished tests saved to / loaded from studio/results/*.json
│       ├── sessions.py          # in-memory session + per-approach index cache
│       ├── service.py           # orchestration over the ragureap approaches/metrics/stats
│       ├── streaming.py         # SSE-over-POST helper (worker thread → event stream)
│       ├── pricing.py · catalog.py · schemas.py
│       └── routers/             # meta, keys, corpus, run, eval, replay, results
│   ├── scripts/import_paper_sweep.py  # the paper's Gemini sweep as a saved test
│   └── tests/                   # 45 tests, mocked LLM → zero spend
├── results/                     # saved tests (JSON), one file per finished evaluation or replay
└── web/                         # Next.js app
    ├── app/                     # /, playground, compare, evaluate, replay, profiler, recommend, history
    ├── components/{ui,shell,run,viz,eval,compare,learn}/
    └── lib/                     # api, sse, key, store, approaches, domains, recommend, samples, …
```

---

## Development

```bash
# backend
.venv/bin/uvicorn studio.server.app.main:app --reload --port 8000
.venv/bin/python -m pytest studio/server/tests        # 45 tests, no API spend (LLM mocked)

# frontend (from studio/web)
npm run dev        # dev server
npm run build      # production build (type-checks)
npm run lint       # eslint
```

See [`QA_CHECKLIST.md`](QA_CHECKLIST.md) for the manual test pass.

### Extending

- **Use a different model gateway.** `service.make_client` builds an `OpenRouterClient`. Any client
  with a `generate(prompt)` method returning an `LLMResponse` (text, token counts, cost, latency) can be
  swapped in there.
- **Add a strategy.** Add it to `src/ragureap/approaches/` behind the `Approach` protocol, register it
  in `ragureap.runner`, and add its metadata to `server/app/catalog.py` + `web/lib/approaches.ts`.

---

## How it relates to the research

RAG Atlas is the interactive surface of the **RAG_Ureap** project — a reproducible comparison of these
seven strategies that culminated in the paper *"Which RAG for Which Domain?"*. The paper's central
claim is that its evaluation should be **reproducible by anyone, on any domain, in about an hour, with
whichever model they prefer.** RAG Atlas is how you do exactly that.

---

## License

Inherits the parent project's license (Apache-2.0). The bundled case-study corpus is synthetic and
authored for this project.
