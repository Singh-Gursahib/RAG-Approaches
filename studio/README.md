<div align="center">

# 🗺️ RAG Atlas

**An interactive studio for testing retrieval strategies on your own documents, with your own API key.**

Compare seven RAG and non-RAG approaches live · grade them on your data · see cost, latency, and
hallucination risk · get a domain-aware recommendation.

*A hands-on companion to the [RAG_Ureap](../README.md) research framework.*

</div>

---

## What is this?

The RAG literature is full of variants — naive vector retrieval, hybrid BM25+dense, HyDE,
cross-encoder reranking, full-context, recursive summarization, sliding-window — and almost no one
gets to see them **run head-to-head, under identical conditions, on data that looks like their own**.

RAG Atlas closes that gap interactively. You bring a corpus and a Gemini API key; it runs any mix of
the seven reference strategies *live*, streams each one's reasoning step by step, and shows you the
answers, the retrieved chunks, the cost, the latency, and — if you supply gold answers — a fully
scored leaderboard with confidence intervals and statistical significance.

> This is **not** the static results dashboard in [`../frontend/web/`](../frontend/web), which
> visualizes the *paper's* fixed numbers. RAG Atlas executes the approaches on demand.

### Why it's different

- **Bring your own key, bring your own data.** Nothing is hard-coded to a benchmark. Your key lives in
  your browser; your documents are processed in a private session.
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
- **Replay** — reproduce the paper's bundled 8K-token corpus + 34-question evaluation with your own
  key, shown side-by-side with the published numbers.
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
│  • BYO Gemini key (browser sessionStorage)     │ ─────▶ │  • Extracts X-Gemini-Key per request │
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

Your Gemini API key:
- is entered in the browser and stored **only** in that tab's `sessionStorage`;
- is sent to the backend **per request** via the `X-Gemini-Key` header, used to construct a one-shot
  model client, and **never persisted to disk, never written to logs, never returned in any response**;
- is scrubbed from any upstream error message before it leaves the server (`deps.redact`).

There is no database, no auth, and no server-side user state. Sessions (your uploaded corpus) live in
memory in a private temp directory and are evicted on a TTL.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI · `uvicorn` · SSE-over-POST · reuses `ragureap` (ChromaDB, BM25, sentence-transformers, bge-reranker, google-generativeai) |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · Recharts · lucide-react |
| Generator | Gemini (`gemini-3-flash-preview` by default) — the model layer is a thin adapter; other providers are a documented extension point |
| Storage | Browser `localStorage` (history, saved configs) — nothing server-side |

**Design language:** an "editorial research instrument" — warm bone canvas, near-black ink, a single
clay accent, a per-approach palette shared with the paper figures, Geist (display + UI) + JetBrains
Mono (numerals), motion that clarifies and respects `prefers-reduced-motion`.

---

## Getting started

### Prerequisites
- Python 3.11+ and Node 18+ (developed on Node 22).
- A Gemini API key — get a free one at <https://aistudio.google.com/app/apikey>.

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
> cross-encoder (~1 GB). These are one-time and free; only Gemini calls cost money (cents).

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

- **Model & price.** The default generator is `gemini-3-flash-preview`. Per request you can override
  retrieval (`top_k`, candidate pool), the model's temperature and max output tokens, and the price
  table — the Profiler's price-tier slider re-prices any run against any provider's rates client-side.
- **CORS.** Set `RAG_ATLAS_CORS_ORIGINS` (comma-separated) to allow non-default web origins.
- **API base.** Set `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`) if the backend runs elsewhere.

### Reproducing the paper

Open **Replay**, add your key, and run. It executes the bundled corpus + 34-question evaluation
(`data/eval_corpus/` and `tests/eval_set.jsonl`) and compares your numbers to the published headline.
Expect small deltas (model preview drift, temperature/seed).

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
│       ├── deps.py              # X-Gemini-Key extraction + redaction
│       ├── sessions.py          # in-memory session + per-approach index cache
│       ├── service.py           # orchestration over the ragureap approaches/metrics/stats
│       ├── streaming.py         # SSE-over-POST helper (worker thread → event stream)
│       ├── pricing.py · catalog.py · schemas.py
│       └── routers/             # meta, keys, corpus, run, eval, replay
│   └── tests/                   # 24 tests, mocked LLM → zero spend
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
.venv/bin/python -m pytest studio/server/tests        # 24 tests, no API spend (LLM mocked)

# frontend (from studio/web)
npm run dev        # dev server
npm run build      # production build (type-checks)
npm run lint       # eslint
```

See [`QA_CHECKLIST.md`](QA_CHECKLIST.md) for the manual test pass.

### Extending

- **Add a model provider.** Implement a client with a `generate()` method returning text + token
  counts (mirroring `ragureap.llm.gemini.GeminiClient`) and swap it in `service.make_client`.
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
