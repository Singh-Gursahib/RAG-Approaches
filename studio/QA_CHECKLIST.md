# RAG Atlas — Manual QA Checklist

Run before shipping. Boot with `./studio/run.sh` (backend :8000, web :3000/3001).
Have a Gemini API key ready (kept in-browser only).

## Smoke
- [ ] Backend health pill in header shows **Backend connected**.
- [ ] Header **? → Glossary** opens; "Take the product tour" launches the tour.
- [ ] First visit auto-launches the onboarding tour; **Skip** dismisses it; it doesn't reappear.
- [ ] All nav routes load: Playground, Compare, Evaluate, Replay, Profiler, Recommend, History.
- [ ] Mobile width (<1024px): hamburger opens the mobile menu; links navigate and close it.

## Key handling (security)
- [ ] **Add your key** modal: paste key → **Test key** returns success.
- [ ] After saving, the key shows masked (e.g. `AIza••••••••wxyz`); **Clear** removes it.
- [ ] DevTools Network: the key is sent only as `X-Gemini-Key`; never appears in a response body.
- [ ] Reload the tab: key persists (sessionStorage). Close the tab + reopen: key is gone.

## Playground (live run)
- [ ] **Load sample** populates corpus; chunk preview updates as you drag chunk-size/overlap.
- [ ] Pick 2–3 strategies; the pre-flight **≈ $/run** estimate appears.
- [ ] Run a suggested question → each strategy streams its trace; answers + cost/latency/tokens render.
- [ ] An answer with no support shows the **Honest refusal** badge.
- [ ] Retrieved-chunk inspector expands on RAG strategies.
- [ ] **Save as config** stores a named config (appears in History).

## Compare
- [ ] After a Playground run, `/compare` shows answers side-by-side with agreement badges.
- [ ] Insights strip, cost/latency/token bars, cost×latency Pareto, pipeline diff, retrieval inspector all render.
- [ ] From History, **Compare** on a run deep-links to `/compare?run=<id>` and selects it.

## Evaluate
- [ ] **Load sample set** fills the question table; add/remove rows works; JSONL import works.
- [ ] Run → live per-strategy progress + running cost.
- [ ] Results: leaderboard with CIs, forest plot, probe radar (EM/F1 toggle), win-loss matrix,
      significance ("statistically tied" honest framing), refusal-honesty panel, per-question explorer.
- [ ] **JSON** / **CSV** export download; the eval is saved to History.

## Replay
- [ ] `/replay` shows the bundled case study (4 docs, 34 questions, probe counts).
- [ ] Run with key → reproduction completes; **your-run-vs-paper** delta table renders; full results show.

## Profiler
- [ ] `/profiler` (or History → **Profile**) loads a stored eval.
- [ ] Moving the **price-tier sliders** re-prices cost, $/correct, and the Pareto instantly; **Reset** restores defaults.

## Recommend
- [ ] Pick each of the 6 use cases → 4 questions → a ranked recommendation with rationale appears.
- [ ] "Best fit" reflects the answers (e.g. large corpus demotes Full-Context; needle demotes Recursive Summary).

## History
- [ ] Runs, evals, and configs listed with search + tab filters.
- [ ] **Apply** a saved/starter config → lands in Playground with settings applied.
- [ ] **Export** downloads JSON; **Import** of that file restores everything.
- [ ] Delete works for each item type.

## Resilience
- [ ] Backend stopped → header pill shows **Backend offline**; actions show a clear error toast.
- [ ] Invalid key → run shows a per-strategy error, not a crash.
- [ ] `prefers-reduced-motion` on → no large motion; content still fully usable.
