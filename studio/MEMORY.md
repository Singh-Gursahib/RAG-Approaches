# RAG Atlas — MEMORY (handoff to future self)

> Read this + `studio/implementation_plan.md` first, every session. Update after every phase.
> Keep ≤150 lines. This is the resume point.

## Project summary
**RAG Atlas** (product name — confirmed) is a new, world-class **Next.js + FastAPI** app (lives under `studio/`) that
lets users live-test the 7 RAG / non-RAG strategies from the RAG_Ureap research project using **any
OpenRouter model with their own OpenRouter key**, on **their own documents** — with an Apple-grade, educational interface. It is
NOT the existing `frontend/web/` static results dashboard; that one only visualizes the paper's fixed
numbers. Studio runs approaches *live* and teaches users which approach fits which domain.

The research backend is feature-complete (paper done). Studio wraps the existing `src/ragureap/`
package read-only via a FastAPI server and surfaces it through a polished UI.

## Tech stack & key decisions
- **Backend:** FastAPI (`studio/server/`) reusing `ragureap` (the editable install in repo `.venv`).
  SSE for live trace/cost streaming. In-memory session + per-(session,approach) index cache.
- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind + Framer Motion + recharts + lucide.
- **BYO key (hard rule):** OpenRouter key entered in browser → `sessionStorage` only → sent per-request as
  `X-OpenRouter-Key` header → **never persisted server-side, never logged, never in any response/error.**
  Fallback: `OPENROUTER_API_KEY` in repo-root `.env` (gitignored, chmod 600). Never print/commit it; never type it into web forms.
- **Anonymity to OpenRouter (hard rule, user-requested):** send ONLY `Authorization` + `Content-Type`. Never
  `HTTP-Referer`, `X-OpenRouter-Title`/`X-Title`, `X-OpenRouter-Categories`, `X-OpenRouter-App-Visibility`, or a `user` field.
  All calls server-side (`app/openrouter.py`); `tests/test_openrouter.py` enforces it.
- **No DB, no auth, no 3rd-party services.** History + saved configs are browser-local (IndexedDB).
- **Local-first:** `studio/run.sh` (and `make studio`) boots server + web together.
- **Do NOT modify `src/ragureap/` core.** If unavoidable, log in repo `DECISIONS.md` first.
- **Design:** "Editorial research instrument" — warm bone canvas, near-black ink, clay accent `#cf4520`,
  per-approach palette reused from `frontend/web/lib/colors.ts`. Fonts: Fraunces (display) + Geist Sans
  (UI) + JetBrains Mono (numerals). Motion respects `prefers-reduced-motion`. Source: `frontend-skill.md`.
- **7 approaches:** naive, hybrid, hyde, rerank (RAG); full_context, recursive_summary, sliding_window
  (non-RAG). All behind the `Approach` protocol (`setup()` + `answer()` → `AnswerWithTrace`).
- **Key findings to surface (from FINDINGS.md):** at sub-window corpus scale non-retrieval wins
  (full_context F1 .881, sliding_window .875); recursive_summary catastrophically loses identifiers
  (only statistically significant loser); hallucination refusal ~100% across 6/7; F1 > EM as headline.

## Environment (verified Phase 1)
- Python: repo-root `.venv` (py 3.11.8). `ragureap` installed editable + fastapi/uvicorn/sse-starlette/python-multipart. `import ragureap` → 0.1.0 OK.
- Node v22.15.1, npm 11.5.2. Web deps installed in `studio/web/node_modules` (Next 14.2.16 audit warnings = known advisories, pinned to match dashboard; bump later).
- Backend run: `.venv/bin/uvicorn studio.server.app.main:app --port 8000` (from repo root). Web: `cd studio/web && npm run dev`. Both: `./studio/run.sh` or `make studio`.
- ⚠️ Port 3000 is often occupied by the separate `Zeinab-Memorily` project — `next dev` auto-falls-back to 3001. Backend default 8000 is free. The `/api/*`→`:8000` rewrite (next.config.mjs) reads NEXT_PUBLIC_API_BASE at server start.
- `next build` passes clean (typecheck+lint); homepage 131kB first load. `pytest studio/server/tests` → 3 passing.

## Phase status
- ✅ P1  Foundation/scaffold — DONE. Both apps boot; Next→/api/health→FastAPI handshake live; tokens/fonts/shell/homepage; web build clean.
- ✅ P2  Backend core — DONE. Sessions+index cache, BYO-key (X-Gemini-Key), single-question SSE runs. Verified live: naive run → "1991" for $0.000048.
- ✅ P3  Backend eval/replay/estimate — DONE. /eval (CIs+pairwise+win-loss), /eval/estimate, /replay. 24 backend tests green (zero spend, mocked LLM+approach).
- ✅ P4  Design system + shell + BYO-key UX — DONE. UI primitives, KeyModal/KeyStatusPill (+ /key/check backend), Toast, useStream SSE hook, expanded approaches.ts + domains.ts, samples, motion, store. `/kitchen` gallery.
- ✅ P5  Playground — DONE. 3-step guided flow (corpus→strategies→ask), CorpusUploader (paste/upload/sample + live chunk preview), ApproachPicker (explainers + fit hint), RetrievalConfig, pre-flight estimate, live SSE run, AnswerCard (trace timeline + retrieved-chunk inspector + refusal badge + CostTicker), saves to history. Live-verified: naive+full_context → "MULBERRY-7Q" for $0.0001.
- ✅ P6  Comparison & viz — DONE. `/compare` reads latest playground run from store → AnswerColumns (agreement), InsightsStrip (templated), MetricBars (cost/latency/tokens), ParetoChart (cost×latency), TraceDiff, RetrievalInspector. Playground now persists per-step traces.
- ✅ P7  Eval harness UI — DONE. `/evaluate`: corpus + QuestionSetEditor (table/JSONL/sample) + ApproachPicker + estimate → live EvalProgress (SSE) → Leaderboard(+CIs), ForestPlot, ProbeRadar, WinLossMatrix, SignificanceTable (honest "tied"), HallucinationPanel, QuestionExplorer, JSON/CSV export, saves to history. Live-verified eval for $0.0002.
- ✅ P8  Replay + Profiler + Recommender — DONE. `/replay` (bundled corpus+evalset via /replay/meta + /replay/run SSE → your-vs-paper delta table + EvalResultsView). `/profiler` (stored evals + price-tier sliders re-price client-side from token counts → cost×F1 Pareto, $/correct, latency, tokens). `/recommend` (use-case wizard → ranked recs w/ rationale via lib/recommend.ts + DomainGuide). Extracted shared `components/eval/EvalResultsView.tsx` (used by evaluate + replay). Build: 9 routes clean.
- ✅ P9  History, saved configs, onboarding, education — DONE. `/history` (runs+evals+configs, tabs/search, export/import all JSON, reopen→/compare?run=, /profiler?eval=, apply config→playground, delete). Saved configs in store.ts (+4 starters seeded once). Playground: applies pending config on mount + "Save as config". Onboarding Tour (first-visit, skippable) + Glossary via header HelpMenu "?"; OnboardingGate mounted in layout (events: rag-atlas:start-tour / open-glossary). History added to nav.
- ✅ P10 Polish, a11y, perf, docs, QA — DONE. Mobile nav menu (Header). recharts code-split via next/dynamic (ParetoChart/ProbeRadar) → first-load JS dropped ~100kB on heavy routes (evaluate 247→148, compare/profiler ~206→~105, replay 243→144). a11y: darkened ink-muted/faint for AA, Modal focus mgmt + return focus, aria-live on streaming regions, aria-current/labels on nav. Removed /kitchen. FooterHelp (glossary/tour links). Wrote studio/README.md (detailed) + QA_CHECKLIST.md; root README links to studio. lint clean, tsc clean, 24 backend tests pass, all 8 routes 200 + /kitchen 404.

## ✅ PROJECT COMPLETE — all 10 phases done. RAG Atlas is feature-complete and shippable.

## OpenRouter migration (2026-09-10) — DONE in code, GUI test pending
- Backend: `openrouter.py` (client: reasoning "lowest" = none if allowed else lowest effort; max_tokens scaled by
  effort fraction to keep 512-token answer budget; retry once on empty+length; cost from usage.cost), `models_catalog.py`
  (5 curated: google/gemini-3-flash-preview [paper], google/gemini-3.7-flash, google/gemini-3.8-flash, z-ai/glm-5.3-flash,
  deepseek/deepseek-v4.1-flash; live /models 1h cache + `data/openrouter_models_snapshot.json`), `results_store.py`
  (`studio/results/*.json`), routers `results.py` (/results, /results/{id}), /models, /models/lookup, /pricing?model=.
- Evals take `repeats` 1–5 (seeds 0..n-1). Aggregation = paper's `scripts/aggregate_seeds.py` (mean of per-run means,
  ddof=1 std, pooled bootstrap CI n_boot=2000 seed=0, cost per run). recursive_summary gets a fresh instance per repeat.
  Question concurrency 4 only for full_context/sliding_window/recursive_summary.
- Chroma shim in service.py: unique collection names (in-process EphemeralClients shared "ragureap" and clobbered each other).
- `server/scripts/import_paper_sweep.py` → saved result `20260512T163536Z_replay_google-gemini-3-flash-preview_paper-sweep`
  (verified == paper/tables/sweep_headline.csv). 45 backend tests pass.
- Web: `components/run/ModelPicker.tsx` (dropdown + custom slug + reasoning + RunsControl), `lib/model.ts` (useLLMConfig,
  remembered choice), `components/eval/{SavedResultsModal (“Load the results from a previous test”),ResultMetaCard}`,
  Replay (model, T, runs, paper-settings button, similarity stats vs paper), Evaluate (Step 4 Model), multi-run Leaderboard/QuestionExplorer.
- `.claude/launch.json`: rag-atlas-api (:8000) + rag-atlas-web (:3000).

## GLM 5.3 Flash GUI test — DONE 2026-09-11
- Saved: `studio/results/20260911T062638Z_replay_z-ai-glm-5-3-flash_bebd51.json` (T=0.3, 3 runs, low effort, max_tokens 640,
  32.7 min, $0.2276, 1147 calls, 13 truncation retries, 0 errors). 61 screenshots + `studio/docs/walkthrough/WALKTHROUGH.md`
  (built by `automation/build-walkthrough.js` from `capture-log.jsonl`; capture scripts `capture-tour.js`, `capture-replay.js`).
- F1 GLM vs Gemini(paper): rerank .871/.833, naive .862/.836, hybrid .833/.797, hyde .813/.838, sliding .808/.875,
  recursive .717/.206, full_context .490/.881 (real model behaviour: full prompt sent, ~9.4K tok/q; GLM says NOT_IN_CONTEXT /
  misreads numbers). Spearman ρ=-0.36; RAG strategies within ±4 pts; non-RAG swing hugely by model.
- Follow-up (user-approved) `…glm-5-3-flash_662a06.json`: Full-Context only, **high** effort (max_tokens 2560), 3 runs →
  F1 .915±.007 EM .755, $0.0070/run, 0 truncation retries, ~61 reasoning tok/call. Low effort (640) had 11 retries, ~209
  reasoning tok/call, F1 .490 → the collapse was a starved reasoning/token budget, NOT a GLM long-context weakness.
  "Lowest available" + 512 answer budget starves mandatory-reasoning models on long prompts; flag before paper claims.
- FIX (user-approved): `openrouter.MIN_REASONING_TOKENS = 1024` → max_tokens ≥ 1024/effort_fraction (GLM low → 5120).
  Check run `…_0220b6.json` (Full-Context, lowest→low, 5120, 1 run): F1 .931 EM .794, 0 retries, $0.0091. 47 tests pass.
- Word guide: `studio/docs/walkthrough/RAG-Atlas-User-Guide.docx` (28 pp, 48 figs, 1.9 MB) from `automation/build-guide.js`
  (hand-written task-based chapters; 2-per-row grid tables; images from `prepare-doc-images.py` → screenshots/doc-images/ JPEG
  1100px + manifest). USER RULES for the doc: NO file paths under images, NO screenshot appendix, NO folder/file references
  (doc is shared alone); simulations are a gallery, not "steps"; compact layout. Focused captures: `capture-guide-extras.js`
  (g-sim-*, compare/eval/recommend/profiler/history panels), `capture-guide-loaded.js` (path lines hidden via DOM).
- Paper work (paused for the doc): `scripts/export_cross_model_tables.py` → paper/tables/glm53_*.csv, cross_model_f1.csv;
  figure script rewritten (log-cost Pareto w/ label repel, cross-model F1 forest, 2-panel heatmap, honesty dot plot).
  Label placement: obstacle-aware 2-pass repel (strict nearest-anchor, then leader lines) + horizontal dodge (disclosed in caption).
- ✅ PAPER REVISED (2026-09-11): `paper/ieee_draft.tex` rewritten → 11 pp, 0 em dashes, builds clean (only font-shape warnings).
  Two generators (Gemini sweep $1.09 est.; GLM $0.26 billed). New: Table II cross-model, Fig cross_model_f1, figure* heatmap +
  Pareto (both models), Sec "Reasoning Headroom". Claims verified vs CSVs: RAG |Δ|≤3.8 (mean 3.1), within-model spread 67.5/38.1,
  5/7 in Gemini CIs w/ headroom, ρ=0.39, RS 0.206→0.717, SW refusal 0.667 on GLM. Forest_f1 figure dropped from tex.
  Not updated (not asked): FINDINGS.md, paper/draft.tex (accessible v1).
- Fixed during test: Next dev proxy gzip buffered SSE → `compress:false` + `Cache-Control: no-cache, no-transform` + 15s keepalive.

## User's pending asks (in order) — see conversation
1. ✅ GLM GUI test + walkthrough MD.
2. **STOP and ask before creating the Word "how to use" doc** — user will say when.
3. Then paper: remove em dashes, fix overlapping scatter/Pareto points, add GLM 5.3 Flash results + similarity to Gemini,
   frame as model-agnostic (pipeline choice matters more than the LLM).

Legend: ✅ done · 🟡 in progress · ⬜ not started

## Files built in Phase 1
- Server: `studio/server/app/{__init__,main}.py`, `routers/meta.py` (/health, /), `requirements.txt`, `tests/test_health.py`.
- Web: `studio/web/` — package.json, tsconfig, next.config.mjs (rewrites /api/*→:8000), tailwind.config.ts, postcss, .eslintrc, .gitignore; `app/{layout,page,globals.css}`; `lib/{api,format,types,key,approaches}.ts`; `components/shell/{Header,BackendStatus}.tsx`, `components/ui/Reveal.tsx`.
- Orchestration: `studio/run.sh`, root `Makefile` `studio:` target, `studio/README.md`.
- Design: tokens in globals.css (warm bone canvas, clay accent, per-approach palette); fonts Fraunces(display)+Geist Sans(UI)+JetBrains Mono(numerals); grain overlay; reduced-motion handled.

## Backend API (Phase 2+3, for the frontend to consume via /api/*)
- `GET /health`, `GET /approaches` (catalog: key,label,family,color,tagline,steps), `GET /pricing`.
- `POST /corpus/preview` {documents[],chunking} → stats + sample_chunks (stateless, no key).
- `POST /session` {documents[],chunking} → {session_id, stats, sample_chunks}. `DELETE /session/{id}`.
- `POST /run` {session_id,question,approaches[],retrieval,llm,price,soft_cap_usd} + `X-Gemini-Key` → **SSE**. Events: run_start, approach_start, index_building, index_ready, step, approach_done (answer,cost_usd,latency_ms,tokens,refused,retrieved[]), approach_error, done.
- `POST /eval` {session_id,questions[{id?,type?,question,gold_answer}],approaches[],...} + key → **SSE**. Events: eval_start, approach_eval_start, question_done, approach_eval_done, eval_done{results}. results = {approaches,headline[],per_probe[],pairwise_em/f1,win_matrix,questions[],totals}.
- `POST /eval/estimate` (no key) → per-approach cost estimate. `GET /replay/meta` (bundled corpus+evalset+paper_headline). `POST /replay/run` {approaches?}+key → SSE eval over bundled assets.
- SSE = POST returning text/event-stream; **client must read with `fetch`+ReadableStream** (native EventSource can't send the key header). Parse `event:`/`data:` frames. Phase 4 builds `useEventStream` hook + `api.ts` methods for these.
- Server seams (tests patch): `service.get_approach_class`, `service.make_client`. Sessions write user docs to a temp dir + point config.paths.eval_corpus there so recursive_summary/sliding_window (which call load_corpus) work unchanged.

## Frontend building blocks now available (for P6+)
- `lib/api.ts` (health, approaches, pricing, checkKey, corpusPreview, createSession, estimate, replayMeta), `lib/sse.ts` (`streamSSE` + `useStream` hook — POST SSE via fetch reader), `lib/useKey.ts`, `lib/store.ts` (saveRun/listRuns/getLatestRun — playground runs persist for Compare), `lib/approaches.ts` (APPROACHES w/ explainer/bestFor/weakAt/color/steps; PROBE_LABEL/COLOR), `lib/domains.ts` (DOMAINS recommender data), `lib/samples.ts` (SAMPLE_CORPUS/QUESTIONS/EVAL), `lib/motion.ts`.
- UI: `components/ui/{Button,Card,Input,Tag,Tooltip,Toast,Modal,Skeleton,EmptyState,Controls(Slider/Switch/Segmented),Reveal}`. Run: `components/run/{CorpusUploader,ApproachPicker,RetrievalConfig,TraceTimeline,AnswerCard,CostTicker,runState}`.
- ToastProvider wraps app in layout. Header has KeyStatusPill + BackendStatus. Tailwind colors: approach-{sliding,full,rerank,naive,hyde,hybrid,recursive}, probe-{...}.
- ⚠️ Next: folders starting `_` are NON-routable; dev gallery is `/kitchen` (no underscore). Remove in P10.

## Reusable viz + components (for P8+)
- `components/viz/{ParetoChart (generic x/y scatter),MetricBars,ForestPlot,ProbeRadar,WinLossMatrix}`. recharts used in ParetoChart + ProbeRadar.
- `components/eval/{QuestionSetEditor,EvalProgress,Leaderboard,SignificanceTable,HallucinationPanel,QuestionExplorer}`. `lib/export.ts` (exportJSON/CSV).
- `lib/store.ts` now also has `saveEval/listEvals/getEval/getLatestEval/deleteEval` (StoredEval{results:EvalResults}). EvalResults type in types.ts; `EvalQuestionResult.question_text?` attached client-side by index (backend omits it).
- Eval SSE events: eval_start, approach_eval_start, index_building/ready, question_done{i,n,em,f1,cost_usd}, approach_eval_done, eval_done{results}.

## Active task / immediate next step
**ALL 10 PHASES COMPLETE.** RAG Atlas is feature-complete, builds clean, lint/tsc/tests green.
Possible future polish (not required): virtualize QuestionExplorer for very large evals; add OpenAI/Anthropic
model clients (service.make_client is the seam); per-step live streaming inside an approach (currently steps
stream post-hoc per approach). To run: `./studio/run.sh` or `make studio`. QA: studio/QA_CHECKLIST.md.

## Reference (for P10)
- Routes (10): / playground compare evaluate replay profiler recommend history kitchen _not-found. NAV in components/shell/Header.tsx (nav hidden <lg → needs mobile menu in P10).
- Store API: runs (saveRun/listRuns/getRun/getLatestRun/deleteRun), evals (saveEval/listEvals/getEval/getLatestEval/deleteEval), configs (listConfigs/saveConfig/deleteConfig/ensureStarterConfigs), pending (setPendingConfig/takePendingConfig), exportAll/importAll, newId.
- Backend done P2/3: routers meta,keys,corpus,run,eval,replay; 24 tests pass (zero spend). Live-verified: /run, /eval, /key/check paths. Frugal — read GOOGLE_API_KEY from repo .env for any live test.
- Build clean all phases. tsc clean. Use absolute path `cd studio/web` for npm (CWD resets between Bash calls).

## Persistent facts about the user
- Email: gursahib99888@gmail.com. Paper authors: Gursahib Singh + Deeparsh Singh Dang.
- Wants agent-first phased workflow: "go do phase N" → execute fully → update this file → stop & wait.
- Quality bar is explicitly "Apple product design team": premium, intentional, educational, not a demo.
- Audience: users who know RAG basics but aren't experts — educate while guiding.

## Decisions confirmed by user (2026-06-02)
- ✅ Product name: **RAG Atlas** (RAG-oriented, has a homepage — built).
- ✅ May use repo `.env` `GOOGLE_API_KEY` for dev testing live runs — **be frugal** (minimal calls; always mock in automated tests).
- ~~Gemini-only for v1~~ → superseded 2026-09-10: **OpenRouter for all models** (user request), anonymous (no attribution headers).
- ✅ Plan approved; agent-first phased workflow.

## Blockers / open questions
- None. Phase 2 can proceed. When testing live runs, read key from repo `.env` (GOOGLE_API_KEY) and keep spend minimal.
