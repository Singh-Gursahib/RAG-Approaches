# 14 — Roadmap & Phased Timeline

> A consolidated view of when each phase happens, dependencies between phases, expected effort, and exit gates. The detailed checklists live in `PHASES.md`; this document is the **time-and-scope** view.

---

## 1. Phase Dependencies (DAG)

```
Phase 0 ─────────────────────────────────────────────────────► Phase 14
  │
  └──► Phase 1 (Scaffolding)
         │
         ├──► Phase 2 (Data + Domains)
         │      │
         │      └──► Phase 3 (P0 Baselines) ──┐
         │                                    │
         │                                    ├──► Phase 8 (Eval Framework)
         │                                    │      │
         │                                    │      └──► Phase 9 (Benchmark Suites)
         │                                    │             │
         │      ┌─── Phase 4 (Adv Retrieval) ─┤             │
         │      │                             │             │
         │      ├─── Phase 5 (Tree/Graph/Mem) ┤             │
         │      │                             │             │
         │      ├─── Phase 6 (Agentic)       ┤             │
         │      │                             │             │
         │      └─── Phase 7 (Adv Non-RAG)   ┘             │
         │                                                  │
         └──► Phase 10 (Frontend) ──────────────────────────┤
                                                            │
                                  Phase 11 (Hybrids) ◄──────┤
                                       │                    │
                                       └──► Phase 12 (Cross-Domain) ───► Phase 13 (Paper) ───► Phase 14 (Release)
```

Phases 4, 5, 6, 7 can run in parallel after Phase 3 lands. Phase 10 (frontend) depends only on Phase 8 metrics being stable.

---

## 2. Effort Estimates

These are **rough estimates** for a single AI-agent + user collaborator working part-time. Actual cadence depends on user availability for reviews and decisions.

| Phase | Estimated effort | Calendar (assuming part-time) |
|---|---|---|
| 0 | Research & Planning | done in days; complete at end of Phase 0 |
| 1 | Scaffolding | 1–2 sessions |
| 2 | Data + Domains | 3–5 sessions (parallelizable across domains) |
| 3 | P0 Baselines | 2–3 sessions |
| 4 | Advanced Retrieval | 4–6 sessions |
| 5 | Tree / Graph / Memory RAG | 5–7 sessions |
| 6 | Agentic & Adaptive | 3–4 sessions |
| 7 | Advanced Non-RAG | 4–5 sessions |
| 8 | Evaluation Framework | 3–4 sessions |
| 9 | Benchmark Suites | 4–5 sessions |
| 10 | Frontend (a + b) | 4–6 sessions |
| 11 | Hybrid Architectures | 4–6 sessions |
| 12 | Cross-Domain Experiments | 5–8 sessions (compute-bound) |
| 13 | Paper Drafting | 6–8 sessions |
| 14 | Release | 1–2 sessions |

Total: ~50–75 working sessions. Assuming 2–3 sessions / week, project spans ~5–8 months.

---

## 3. Exit Gates Per Phase

A phase is **closed** only when all checklist items are ticked AND the exit gate is passed. Exit gates are testable.

| Phase | Exit Gate |
|---|---|
| 0 | All `docs/` present + `README.md` / `PROGRESS.md` / `PHASES.md` initialized + user approval |
| 1 | `make install && pytest` succeed in fresh venv; `docker compose up` brings up all services; `/health` returns 200 |
| 2 | Small-tier corpus + benchmark Q&A in place for all 7 domains; ingestion idempotent |
| 3 | Smoke benchmark passes for `naive_rag`, `full_context`, `recursive_summary` on legal domain end-to-end with metrics + run manifest |
| 4 | Each technique passes smoke benchmark on all 7 domains; ablation configs exist |
| 5 | Tree/Graph/Memory techniques pass smoke benchmark on at least 3 graph-rich domains |
| 6 | Agentic techniques run with bounded steps and pass smoke benchmark; loop bounds tested |
| 7 | Non-RAG techniques pass smoke benchmark; long-context-native baseline produces reference numbers |
| 8 | Every technique × domain run produces `metrics.json`; bootstrap CI + Wilcoxon utilities tested; judge calibration ≥ 0.7 r vs human spot-check |
| 9 | All 7 suite types implemented; ground-truth Q&A hash-pinned; smoke benchmark covers all suites |
| 10a | Streamlit MVP usable for run + compare + Pareto views |
| 10b | Next.js dashboard deployable; comparison + Pareto + run-detail working |
| 11 | All 6 hybrid implementations pass smoke benchmark; ablation matrices populated |
| 12 | Full sweep complete; leaderboard + Pareto + significance tables generated; FINDINGS.md synthesized |
| 13 | LaTeX draft compiles; figures regenerate from notebooks; reproducibility tarball builds; internal review checklist passed |
| 14 | Public release; demo video; archived DOI |

---

## 4. Critical Path

The shortest sequence to a publishable paper:

```
Phase 0 → 1 → 2 → 3 → 8 → 9 → 4 (P0+P1) → 5 → 6 → 11 → 12 → 13
```

Phases 7 (advanced non-RAG) and 10b (Next.js dashboard) and parts of Phase 12 (large-tier corpora) are off the critical path and can be deferred or parallelized.

---

## 5. Cost Budget Estimate

Aggregate API cost across the project, conservative:

| Phase | Estimated $ | Reason |
|---|---|---|
| 1–2 | < $5 | Scaffolding + small ingestion |
| 3 | $5–15 | Smoke benchmarks |
| 4–7 | $50–150 | Per-technique smoke + ablations |
| 8–9 | $20–50 | Judge calibration + ground-truth synthesis |
| 10 | < $10 | Dashboard testing |
| 11 | $30–80 | Hybrid smoke benchmarks |
| 12 | $200–500 | Full cross-domain sweep with multi-seed CI |
| 13 | $20–50 | Re-runs for paper figures |
| **Total** | **~$350–860** | One full pass to a paper-ready state |

This is tracked live in `EXPERIMENT_LOG.md`'s cost tracker. A `max_cost_usd` ceiling per phase prevents runaway.

---

## 6. Compute Envelope Assumptions

Default assumption (revised after user supplies actual envelope):
- **CPU:** 8 cores, 32 GB RAM.
- **GPU:** none required; CPU-friendly cross-encoder rerankers via sentence-transformers.
- **Disk:** 100 GB free (raw + processed + runs).
- **Network:** stable broadband; Gemini API + dataset downloads.

Stretch (if available): single GPU (8–24 GB VRAM) accelerates local-model ablations and BERTScore.

---

## 7. Risk Register

Top risks and mitigations:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Provider price changes mid-project | Medium | Medium | Pricing pinned in repo; raw token counts reported alongside $ |
| Gemini API rate-limiting | Medium | High | Retry-with-backoff; batch concurrency cap; switch to Flash for cost-sensitive paths |
| Synthetic Q&A quality | Medium | Medium | Human spot-check; multi-validator pipeline; family-bias judge cross-check |
| GraphRAG indexing cost blow-up | Medium | High | Per-phase $ ceiling; index-once-cache-many; use Flash for extraction |
| Reproducibility drift across model versions | High | Medium | Pin model versions with date suffix; replay test on release |
| Hybrid #6 meta-router undertrained | Medium | Medium | Trained from full Phase 12 data; fallback to "best-domain-stack" baseline |
| Scope creep (more techniques, more domains) | High | Medium | P0/P1/P2 priority enforced; new asks go to "future work" |
| Researcher / agent context loss between sessions | High | Medium | The handoff protocol in `README.md` + `PROGRESS.md` |

---

## 8. Decision Points (Will Re-Confirm With User)

These need explicit user input at the noted phase. Defaults documented; user can override.

| Decision | Phase | Default |
|---|---|---|
| API keys provided | 1 | Gemini required; OpenAI / Cohere optional |
| MIMIC DUA available | 2 | No (PMC OA only) |
| Full corpus tier vs small | 12 | Small for v1; medium if budget permits |
| Frontend ambition | 10 | Streamlit MVP first; Next.js after Phase 10 |
| Paper venue | 13 | ACL / EMNLP Findings |
| Public-release license | 14 | Apache 2.0 |

---

## 9. Done-Definition For The Project

The project is **done** when:

1. All 21 + 6 hybrid techniques are implemented and pass smoke benchmarks across all 7 domains.
2. Phase 12 cross-domain experiments are complete with statistical CIs.
3. The paper is submitted (not necessarily accepted — submission is the project's exit).
4. The reproducibility tarball builds and re-runs verify within bootstrap CI.
5. The repo is publicly released with a permanent DOI.
6. `FINDINGS.md` answers the framing question: "What is the best long-context strategy for a given use case?" with evidence.

Anything beyond is "future work" and goes to a v2 plan.

---

## 10. After Submission

- **Camera-ready** (if accepted): integrate reviewer feedback; one extra ablation cycle if needed.
- **v0.2.0** release with reviewer-requested experiments.
- **Demo paper** at the venue's demo track (if applicable).
- **Talk** materials.
- **Blog post** announcing the framework's open release.

These are tracked under `Phase 14+` in a future revision of `PHASES.md`.

---

## 11. Where Each Document Plugs In

| When working on phase X, primarily read… | Files |
|---|---|
| Phase 1 | `02_PROJECT_ARCHITECTURE`, `03_BACKEND_DESIGN` |
| Phase 2 | `07_DATASETS`, `02_PROJECT_ARCHITECTURE` |
| Phases 3–7 | `05_RAG_APPROACHES`, `06_NONRAG_APPROACHES` |
| Phase 8 | `09_EVALUATION` |
| Phase 9 | `08_BENCHMARKING`, `07_DATASETS` |
| Phase 10 | `04_FRONTEND_DESIGN`, `11_OBSERVABILITY` |
| Phase 11 | `10_HYBRID_PROPOSALS` |
| Phase 12 | `08_BENCHMARKING`, `09_EVALUATION` |
| Phase 13 | `12_PAPER_WORKFLOW` |
| Phase 14 | `12_PAPER_WORKFLOW`, `13_TOOLS_AND_REPOS` |

This mapping keeps a contributor / future agent oriented to the relevant spec for the work at hand.

---

## 12. End Of Phase 0

When this document is complete, Phase 0 is **done pending user approval**. The next action:

1. User confirms the plan is acceptable.
2. User provides Gemini API key (and any optional keys / decisions).
3. User specifies compute envelope (or accepts default in §6).
4. Phase 1 begins.

Until that approval, no scaffolding code is written. The handoff protocol in `README.md` ensures any new agent session can pick up at exactly this point.
