# RAG Atlas walkthrough: testing GLM 5.3 Flash

This document follows RAG Atlas step by step, from the first visit to a full replay of the paper's case study on GLM 5.3 Flash, and ends by reopening the saved results. Every screenshot is listed with its absolute path.

## Before you start

- Start both servers from the repository root: `.venv/bin/uvicorn studio.server.app.main:app --port 8000` and `cd studio/web && npm run dev`, then open http://localhost:3000.
- Add an OpenRouter API key with the key pill in the header, or put `OPENROUTER_API_KEY` in the repository's `.env` file. This walkthrough used the `.env` option, so the key never appears on screen.
- RAG Atlas sends only the key and content type to OpenRouter. It sends no app name, referrer, or other attribution.
- Screenshots were captured on Fri, 11 Sep 2026 05:44:45 GMT at 1440 × 900 (2× scale) with Chrome.

## Test record

- Saved result file: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/results/20260911T062638Z_replay_z-ai-glm-5-3-flash_bebd51.json`
- Paper sweep file (Gemini 3 Flash): `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/results/20260512T163536Z_replay_google-gemini-3-flash-preview_paper-sweep.json`
- Model: GLM 5.3 Flash (`z-ai/glm-5.3-flash`), open weights, via OpenRouter
- Settings: temperature 0.3, 3 runs (seeds 0, 1, 2), reasoning low, 512-token answer budget (max_tokens sent 640), top-k 5, rerank pool 20, chunks of 150 tokens with 30 overlap
- Dataset: RAG_Ureap case study, 4 documents, 34 questions, 102 graded answers per strategy
- Runtime: 32.7 minutes, 1147 model calls, 27929 reasoning tokens, total cost $0.2276
- App attribution headers sent to OpenRouter: none

| Strategy | GLM 5.3 Flash F1 | Gemini 3 Flash F1 (paper) | Δ F1 | GLM EM | Paper EM | GLM cost / run | Paper cost / run |
|---|---|---|---|---|---|---|---|
| Reranker | 87.1% ± 0.7 | 83.3% ± 0.8 | +3.8 | 69.6% | 66.7% | $0.0051 | $0.0123 |
| Naive RAG | 86.2% ± 0.0 | 83.6% ± 1.2 | +2.6 | 70.6% | 66.7% | $0.0042 | $0.0122 |
| Hybrid RAG | 83.3% ± 0.0 | 79.7% ± 1.0 | +3.6 | 67.6% | 62.7% | $0.0043 | $0.0122 |
| HyDE | 81.3% ± 1.7 | 83.8% ± 1.2 | -2.5 | 65.7% | 66.7% | $0.0073 | $0.0186 |
| Sliding-Window | 80.8% ± 4.1 | 87.5% ± 2.5 | -6.6 | 64.7% | 69.6% | $0.0348 | $0.0972 |
| Recursive Summary | 71.7% ± 4.4 | 20.6% ± 0.0 | +51.1 | 59.8% | 20.6% | $0.0109 | $0.0068 |
| Full-Context | 49.0% ± 3.8 | 88.1% ± 1.2 | -39.1 | 36.3% | 66.7% | $0.0094 | $0.0912 |

F1 and EM are means of the runs, ± the run-to-run standard deviation.

### Follow-up runs

- GLM 5.3 Flash · paper case study · 3 runs · Full-Context · high reasoning: Full-Context F1 91.5% ± 0.7, EM 75.5%, cost per run $0.0070, reasoning high (max_tokens 2560), 0 truncation retries. File: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/results/20260911T063633Z_replay_z-ai-glm-5-3-flash_662a06.json`
- GLM 5.3 Flash · paper case study · 1 run · Full-Context · low reasoning: Full-Context F1 93.1% ± 0.0, EM 79.4%, cost per run $0.0091, reasoning low (max_tokens 5120), 0 truncation retries. File: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/results/20260911T064627Z_replay_z-ai-glm-5-3-flash_0220b6.json`

## First visit

Open http://localhost:3000. The first visit shows a short tour; skip it or step through it.

### Step 1. Onboarding tour

On the first visit a short tour explains the five steps: add a key, load a corpus, pick strategies, run, and compare.

![Onboarding tour](screenshots/01-onboarding-tour.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/01-onboarding-tour.png`

### Step 2. Home page

The home page. The header holds the navigation, the backend status, the help menu, and the key status pill.

![Home page](screenshots/02-home-hero.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/02-home-hero.png`

## Learn how each strategy works

The home page animates all seven strategies. Pick one on the left to see how it moves a question through the corpus.

### Step 3. Simulation: Naive RAG

The animated explainer for Naive RAG: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Naive RAG](screenshots/03-simulation-naive-rag.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/03-simulation-naive-rag.png`

### Step 4. Simulation: Hybrid RAG

The animated explainer for Hybrid RAG: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Hybrid RAG](screenshots/04-simulation-hybrid-rag.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/04-simulation-hybrid-rag.png`

### Step 5. Simulation: HyDE

The animated explainer for HyDE: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: HyDE](screenshots/05-simulation-hyde.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/05-simulation-hyde.png`

### Step 6. Simulation: Reranker

The animated explainer for Reranker: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Reranker](screenshots/06-simulation-reranker.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/06-simulation-reranker.png`

### Step 7. Simulation: Full-Context

The animated explainer for Full-Context: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Full-Context](screenshots/07-simulation-full-context.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/07-simulation-full-context.png`

### Step 8. Simulation: Recursive Summary

The animated explainer for Recursive Summary: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Recursive Summary](screenshots/08-simulation-recursive-summary.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/08-simulation-recursive-summary.png`

### Step 9. Simulation: Sliding-Window

The animated explainer for Sliding-Window: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.

![Simulation: Sliding-Window](screenshots/09-simulation-sliding-window.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/09-simulation-sliding-window.png`

### Step 10. How it works

The home page's summary of the workflow.

![How it works](screenshots/10-home-how-it-works.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/10-home-how-it-works.png`

## Help and the OpenRouter key

The header has a glossary and the key status pill. This walkthrough used a server-side key from the repository's .env file, so no key was typed into the browser.

### Step 11. Glossary

The ? button in the header opens a glossary of the terms used across the app.

![Glossary](screenshots/11-glossary.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/11-glossary.png`

### Step 12. OpenRouter API key

The key dialog. Paste an OpenRouter key (stored only in this browser tab) or rely on a server key from the repo's .env. It also explains that requests carry no app attribution.

![OpenRouter API key](screenshots/12-openrouter-key-dialog.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/12-openrouter-key-dialog.png`

## Playground: a first question on GLM 5.3 Flash

The Playground runs one question through several strategies at once, on the model you choose.

### Step 13. Playground

The Playground is a three-step flow: corpus, strategies and model, then a question.

![Playground](screenshots/13-playground-start.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/13-playground-start.png`

### Step 14. Load a corpus

Load sample fills in a small synthetic corpus and shows how it is chunked.

![Load a corpus](screenshots/14-playground-sample-corpus.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/14-playground-sample-corpus.png`

### Step 15. Pick strategies and a model

Pick strategies, then a model. Gemini 3 Flash, the paper's model, is the default.

![Pick strategies and a model](screenshots/15-playground-strategies-and-model.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/15-playground-strategies-and-model.png`

### Step 16. Model dropdown

The model dropdown lists the curated OpenRouter models with their lab, live price, and badges for the paper's model and open-weights models, plus a custom slug option.

![Model dropdown](screenshots/16-model-dropdown.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/16-model-dropdown.png`

### Step 17. Custom model slug

Custom model slug accepts any OpenRouter model id. Use this model checks it against OpenRouter's model list first.

![Custom model slug](screenshots/17-model-custom-slug.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/17-model-custom-slug.png`

### Step 18. GLM 5.3 Flash selected

GLM 5.3 Flash selected. With reasoning on Lowest available, the note explains this model always reasons, so the app requests low effort.

![GLM 5.3 Flash selected](screenshots/18-model-glm-selected.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/18-model-glm-selected.png`

### Step 19. Ask a question

Type a question or pick a suggested one. The tag shows a pre-flight cost estimate.

![Ask a question](screenshots/19-playground-question.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/19-playground-question.png`

### Step 20. Run in progress

Each strategy streams its pipeline live: indexing, retrieval, and generation, with a running cost.

![Run in progress](screenshots/20-playground-running.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/20-playground-running.png`

### Step 21. Playground answers

Answers from each strategy on GLM 5.3 Flash, with the pipeline trace, tokens, latency, and cost of every step.

![Playground answers](screenshots/21-playground-results.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/21-playground-results.png`

### Step 22. Retrieved chunks

Open a card's retrieved chunks to see exactly what the model was given, with retrieval scores.

![Retrieved chunks](screenshots/22-playground-retrieved-chunks.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/22-playground-retrieved-chunks.png`

## Compare

Compare lays out the most recent Playground run side by side.

### Step 23. Compare

Compare lays out the last run side by side: answers, insights, cost, latency, tokens, a cost × latency chart, the pipeline diff, and the retrieval inspector.

![Compare](screenshots/23-compare.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/23-compare.png`

## Evaluate your own data

Evaluate grades strategies on your own questions with known answers. This walkthrough shows the setup; the full graded test below uses Replay.

### Step 24. Evaluate

Evaluate grades strategies on your own questions with gold answers: corpus, question set, strategies, then model, temperature, and number of runs. Load the results from a previous test sits at the top.

![Evaluate](screenshots/24-evaluate-setup.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/24-evaluate-setup.png`

### Step 25. Evaluate: model and runs

Every strategy uses the same model. Runs repeats the whole evaluation with a different seed each time.

![Evaluate: model and runs](screenshots/25-evaluate-model-and-runs.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/25-evaluate-model-and-runs.png`

## Recommend

Recommend suggests a starting strategy for a use case.

### Step 26. Recommend

Recommend asks for a use case and a few constraints, then ranks strategies with reasons drawn from the research.

![Recommend](screenshots/26-recommend.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/26-recommend.png`

## History

History keeps everything you have run in this browser.

### Step 27. History

History keeps runs, evaluations, and saved configurations in this browser, with search, export, and import.

![History](screenshots/27-history.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/27-history.png`

## The GLM 5.3 Flash test: setup

Replay reruns the paper's case study on a new model. The test used GLM 5.3 Flash with the paper's settings.

### Step 28. Replay

Replay reruns the paper's bundled case study (4 documents, 34 questions) on any model and compares the numbers with the published Gemini 3 Flash results.

![Replay](screenshots/30-replay-page.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/30-replay-page.png`

### Step 29. Replay settings

GLM 5.3 Flash with the paper's settings: temperature 0.3 and 3 runs. The green tag confirms the settings match the paper. Reasoning is Lowest available, which is low effort for GLM 5.3 Flash.

![Replay settings](screenshots/31-replay-model-settings.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/31-replay-model-settings.png`

### Step 30. Previous tests (before the run)

Before the test, the saved-tests list holds only the paper's own Gemini 3 Flash sweep.

![Previous tests (before the run)](screenshots/32-previous-tests-before-run.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/32-previous-tests-before-run.png`

### Step 31. Strategies and estimate

All seven strategies are selected. The tag estimates cost and the number of model calls before anything is spent.

![Strategies and estimate](screenshots/33-replay-strategies-and-estimate.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/33-replay-strategies-and-estimate.png`

## The test in progress

Progress updates live. Each bar counts graded answers for one strategy across all three runs.

### Step 32. Progress (0.4 min)

The run has started: strategies build their indexes and begin answering.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.0022 spent Full-Context 10/102 · run 1/3 · $0.002177 Sliding-Window 0/102 · $0.000000 HyDE 0/102 · $0.000000 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (0.4 min)](screenshots/34-replay-progress-01.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-01.png`

### Step 33. Progress (4.4 min)

Live progress after 4.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.0172 spent Full-Context 64/102 · run 2/3 · $0.017223 Sliding-Window 0/102 · $0.000000 HyDE 0/102 · $0.000000 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (4.4 min)](screenshots/34-replay-progress-02.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-02.png`

### Step 34. Progress (8.4 min)

Live progress after 8.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.0402 spent Full-Context 102/102 · $0.028072 Sliding-Window 11/102 · run 1/3 · $0.012149 HyDE 0/102 · $0.000000 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (8.4 min)](screenshots/34-replay-progress-03.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-03.png`

### Step 35. Progress (12.4 min)

Live progress after 12.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.1359 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 15/102 · run 1/3 · $0.003446 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (12.4 min)](screenshots/34-replay-progress-04.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-04.png`

### Step 36. Progress (16.4 min)

Live progress after 16.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.1438 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 47/102 · run 2/3 · $0.011124 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (16.4 min)](screenshots/34-replay-progress-05.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-05.png`

### Step 37. Progress (20.4 min)

Live progress after 20.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.1538 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 99/102 · run 3/3 · $0.021276 Naive RAG 0/102 · $0.000000 Reranker 0/102 · $0.000000 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (20.4 min)](screenshots/34-replay-progress-06.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-06.png`

### Step 38. Progress (24.4 min)

Live progress after 24.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.1729 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 102/102 · $0.021760 Naive RAG 102/102 · $0.012747 Reranker 35/102 · run 2/3 · $0.005940 Hybrid RAG 0/102 · $0.000000 Recursive Summary 0/102 · $0.000000

![Progress (24.4 min)](screenshots/34-replay-progress-07.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-07.png`

### Step 39. Progress (28.4 min)

Live progress after 28.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.1893 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 102/102 · $0.021760 Naive RAG 102/102 · $0.012747 Reranker 102/102 · $0.015163 Hybrid RAG 48/102 · run 2/3 · $0.007139 Recursive Summary 0/102 · $0.000000

![Progress (28.4 min)](screenshots/34-replay-progress-08.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-08.png`

### Step 40. Progress (32.4 min)

Live progress after 32.4 minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.

Progress at capture time: REPRODUCING ON GLM 5.3 FLASH… $0.2116 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 102/102 · $0.021760 Naive RAG 102/102 · $0.012747 Reranker 102/102 · $0.015163 Hybrid RAG 102/102 · $0.012851 Recursive Summary 68/102 · run 2/3 · $0.016577

![Progress (32.4 min)](screenshots/34-replay-progress-09.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-09.png`

### Step 41. Progress (33.0 min)

Replay complete after 32.9 minutes. Every strategy finished all 34 questions three times.

Progress at capture time: REPLAY COMPLETE $0.2276 spent Full-Context 102/102 · $0.028072 Sliding-Window 102/102 · $0.104427 HyDE 102/102 · $0.021760 Naive RAG 102/102 · $0.012747 Reranker 102/102 · $0.015163 Hybrid RAG 102/102 · $0.012851 Recursive Summary 102/102 · $0.032549

![Progress (33.0 min)](screenshots/34-replay-progress-10.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/34-replay-progress-10.png`

## Results

When the run finishes, the results are saved to disk and shown in full.

### Step 42. Saved test details

The finished test is saved as JSON in studio/results/. The card lists the model, temperature, runs and seeds, reasoning effort, token budget, retrieval and chunking settings, total cost, model calls, and wall time.

![Saved test details](screenshots/40-result-saved-test-details.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/40-result-saved-test-details.png`

### Step 43. GLM 5.3 Flash vs the paper

GLM 5.3 Flash against the paper's Gemini 3 Flash results: mean F1 gap, rank agreement, how many strategies land inside the paper's 95% confidence intervals, the top strategy, and per-strategy F1 and cost.

![GLM 5.3 Flash vs the paper](screenshots/41-result-glm-vs-paper.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/41-result-glm-vs-paper.png`

### Step 44. Leaderboard

Mean F1 and EM over 3 runs with the run-to-run spread and bootstrap 95% confidence intervals, plus cost per run and median latency.

![Leaderboard](screenshots/42-result-leaderboard.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/42-result-leaderboard.png`

### Step 45. F1 confidence intervals

Each strategy's F1 with its 95% confidence interval. Overlapping bars mean the difference may be noise.

![F1 confidence intervals](screenshots/43-result-f1-confidence-intervals.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/43-result-f1-confidence-intervals.png`

### Step 46. Per-probe radar

F1 by probe type (needle, multi-hop, distractor, hallucination, sanity).

![Per-probe radar](screenshots/44-result-per-probe-radar.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/44-result-per-probe-radar.png`

### Step 47. Head-to-head wins

How often each strategy is right where another is wrong, across all question-run pairs.

![Head-to-head wins](screenshots/45-result-head-to-head-wins.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/45-result-head-to-head-wins.png`

### Step 48. Statistical significance

Holm-corrected paired Wilcoxon p-values. Pairs that aren't significant are shown as statistically tied.

![Statistical significance](screenshots/46-result-significance.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/46-result-significance.png`

### Step 49. Refusal honesty

How often each strategy correctly refuses questions whose answer is not in the corpus.

![Refusal honesty](screenshots/47-result-refusal-honesty.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/47-result-refusal-honesty.png`

### Step 50. Question explorer

Every question with its gold answer. Ticks show the majority result and x/3 counts correct runs.

![Question explorer](screenshots/48-result-question-explorer.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/48-result-question-explorer.png`

### Step 51. Question explorer: answers

Click a question to read every strategy's answer from each of the three runs.

![Question explorer: answers](screenshots/49-result-question-expanded.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/49-result-question-expanded.png`

### Step 52. Switch to EM

The F1 / EM switch redraws every chart with exact match instead of token F1.

![Switch to EM](screenshots/50-result-em-confidence-intervals.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/50-result-em-confidence-intervals.png`

### Step 53. Full results page

The whole Replay page after the GLM 5.3 Flash test.

![Full results page](screenshots/51-replay-results-full-page.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/51-replay-results-full-page.png`

## History and Profiler after the test

The finished test also appears in History and can be explored in the Profiler.

### Step 54. History after the test

The replay appears in History tagged with its model.

![History after the test](screenshots/52-history-after-test.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/52-history-after-test.png`

### Step 55. Profiler

The Profiler starts from GLM 5.3 Flash's list price and shows cost × quality, cost per correct answer, latency, and token use. The sliders re-price the run for any other model.

![Profiler](screenshots/53-profiler-glm.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/53-profiler-glm.png`

## Load the results from a previous test

Saved tests can be reopened at any time without re-running anything.

### Step 56. Previous tests (after the run)

After the test the list holds two saved tests: GLM 5.3 Flash and the paper's Gemini 3 Flash sweep.

![Previous tests (after the run)](screenshots/54-previous-tests-after-run.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/54-previous-tests-after-run.png`

### Step 57. Loaded GLM 5.3 Flash test

The saved GLM 5.3 Flash test reopened from its JSON file. Nothing is re-run and nothing is spent.

![Loaded GLM 5.3 Flash test](screenshots/55-loaded-glm-test-details.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/55-loaded-glm-test-details.png`

### Step 58. Loaded comparison

The comparison with the paper, rebuilt from the saved file.

![Loaded comparison](screenshots/56-loaded-glm-vs-paper.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/56-loaded-glm-vs-paper.png`

### Step 59. Loaded leaderboard

The leaderboard from the saved file, identical to the one shown when the run finished.

Leaderboard identical to the live run: yes.

![Loaded leaderboard](screenshots/57-loaded-glm-leaderboard.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/57-loaded-glm-leaderboard.png`

### Step 60. Loaded paper sweep

The paper's Gemini 3 Flash sweep loads the same way, imported from the research runs and checked against the paper's table.

![Loaded paper sweep](screenshots/58-loaded-paper-sweep-details.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/58-loaded-paper-sweep-details.png`

### Step 61. Paper sweep leaderboard

The published Gemini 3 Flash leaderboard, for side-by-side reading with GLM 5.3 Flash.

![Paper sweep leaderboard](screenshots/59-loaded-paper-sweep-leaderboard.png)

Screenshot: `/Users/macbook/Documents/MyProjects/RAG_Ureap/studio/docs/walkthrough/screenshots/59-loaded-paper-sweep-leaderboard.png`
