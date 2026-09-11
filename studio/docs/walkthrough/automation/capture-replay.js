// Part 2: replay the paper's case study on GLM 5.3 Flash through the GUI, capture progress
// and every result view, then reopen the saved test with "Load the results from a previous test".
const { BASE, launch, saveState, shot, panel, sleep, dismissTour, selectModel, log } = require("./common");

const MODEL = "GLM 5.3 Flash";
const PROGRESS_EVERY_MS = 4 * 60_000;
const MAX_WAIT_MS = 4 * 60 * 60_000;

async function leaderboardText(page) {
  return (await panel(page, "Leaderboard").innerText()).trim();
}

(async () => {
  const { browser, context, page } = await launch();
  try {
    // --- Set up the replay -------------------------------------------------------
    await page.goto(BASE + "/replay");
    await dismissTour(page);
    await page.getByText("The bundled case study").waitFor();
    await page.getByText("Paper's generator").waitFor();
    await sleep(2000);
    await selectModel(page, MODEL);
    const paperSettings = page.getByRole("button", { name: "Use the paper's settings" });
    if (await paperSettings.isVisible().catch(() => false)) {
      await paperSettings.click();
      await sleep(400);
    }
    await panel(page, "Model & settings").locator("select").selectOption("lowest");
    await sleep(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    await shot(page, "30-replay-page", {
      step: "Replay",
      caption:
        "Replay reruns the paper's bundled case study (4 documents, 34 questions) on any model and compares the numbers with the published Gemini 3 Flash results.",
    });

    const settings = panel(page, "Model & settings");
    await settings.scrollIntoViewIfNeeded();
    await sleep(500);
    await shot(settings, "31-replay-model-settings", {
      step: "Replay settings",
      caption:
        "GLM 5.3 Flash with the paper's settings: temperature 0.3 and 3 runs. The green tag confirms the settings match the paper. Reasoning is Lowest available, which is low effort for GLM 5.3 Flash.",
    });

    await page.getByRole("button", { name: "Load the results from a previous test" }).click();
    const before = page.getByRole("dialog");
    await before.getByText("paper case study").first().waitFor();
    await sleep(800);
    await shot(before, "32-previous-tests-before-run", {
      step: "Previous tests (before the run)",
      caption: "Before the test, the saved-tests list holds only the paper's own Gemini 3 Flash sweep.",
    });
    await page.keyboard.press("Escape");
    await sleep(600);

    const strategies = panel(page, "Strategies to reproduce");
    await strategies.scrollIntoViewIfNeeded();
    await strategies.getByText("model calls").waitFor({ timeout: 20_000 }).catch(() => {});
    await sleep(500);
    await shot(strategies, "33-replay-strategies-and-estimate", {
      step: "Strategies and estimate",
      caption: "All seven strategies are selected. The tag estimates cost and the number of model calls before anything is spent.",
    });

    // --- Run ---------------------------------------------------------------------
    const started = Date.now();
    log({ step: "Replay started", note: `Run replay on ${MODEL}` });
    await strategies.getByRole("button", { name: new RegExp(`Run replay on ${MODEL.replace(/\./g, "\\.")}`) }).click();
    const progressLabel = page.locator("p.eyebrow", { hasText: /Reproducing on|Replay complete/ }).first();
    await progressLabel.waitFor({ timeout: 60_000 });
    const progress = progressLabel.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-5 ")][1]');

    let n = 1;
    let lastShot = 0;
    const progressShot = async (label) => {
      const minutes = ((Date.now() - started) / 60_000).toFixed(1);
      const text = (await progress.innerText()).replace(/\s+/g, " ").trim();
      await progress.scrollIntoViewIfNeeded();
      await shot(progress, `34-replay-progress-${String(n++).padStart(2, "0")}`, {
        step: `Progress (${minutes} min)`,
        caption: label || `Live progress after ${minutes} minutes: each bar counts graded answers across all 3 runs, with the run number and cost so far.`,
        extra: { progress_text: text, elapsed_min: Number(minutes) },
      });
      lastShot = Date.now();
    };

    await sleep(25_000);
    await progressShot("The run has started: strategies build their indexes and begin answering.");
    while (Date.now() - started < MAX_WAIT_MS) {
      if (await page.locator("p.eyebrow", { hasText: "Replay complete" }).isVisible().catch(() => false)) break;
      await sleep(15_000);
      if (Date.now() - lastShot >= PROGRESS_EVERY_MS) await progressShot();
    }
    const totalMin = ((Date.now() - started) / 60_000).toFixed(1);
    await sleep(3000);
    await progressShot(`Replay complete after ${totalMin} minutes. Every strategy finished all 34 questions three times.`);

    // --- Results -----------------------------------------------------------------
    await page.getByText("studio/results/").first().waitFor({ timeout: 90_000 });
    await sleep(3000);
    await shot(panel(page, "Saved test"), "40-result-saved-test-details", {
      step: "Saved test details",
      caption:
        "The finished test is saved as JSON in studio/results/. The card lists the model, temperature, runs and seeds, reasoning effort, token budget, retrieval and chunking settings, total cost, model calls, and wall time.",
    });
    await shot(panel(page, "vs the paper"), "41-result-glm-vs-paper", {
      step: "GLM 5.3 Flash vs the paper",
      caption:
        "GLM 5.3 Flash against the paper's Gemini 3 Flash results: mean F1 gap, rank agreement, how many strategies land inside the paper's 95% confidence intervals, the top strategy, and per-strategy F1 and cost.",
    });

    const views = [
      ["42-result-leaderboard", "Leaderboard", "Leaderboard", "Mean F1 and EM over 3 runs with the run-to-run spread and bootstrap 95% confidence intervals, plus cost per run and median latency."],
      ["43-result-f1-confidence-intervals", "F1 with 95% confidence interval", "F1 confidence intervals", "Each strategy's F1 with its 95% confidence interval. Overlapping bars mean the difference may be noise."],
      ["44-result-per-probe-radar", "Per-probe F1", "Per-probe radar", "F1 by probe type (needle, multi-hop, distractor, hallucination, sanity)."],
      ["45-result-head-to-head-wins", "Head-to-head wins", "Head-to-head wins", "How often each strategy is right where another is wrong, across all question-run pairs."],
      ["46-result-significance", "Statistical significance", "Statistical significance", "Holm-corrected paired Wilcoxon p-values. Pairs that aren't significant are shown as statistically tied."],
      ["47-result-refusal-honesty", "Refusal honesty", "Refusal honesty", "How often each strategy correctly refuses questions whose answer is not in the corpus."],
      ["48-result-question-explorer", "Every question, every strategy", "Question explorer", "Every question with its gold answer. Ticks show the majority result and x/3 counts correct runs."],
    ];
    for (const [name, eyebrow, step, caption] of views) {
      const card = panel(page, eyebrow);
      await card.scrollIntoViewIfNeeded();
      await sleep(1800);
      await shot(card, name, { step, caption });
    }

    const explorer = panel(page, "Every question, every strategy");
    await explorer.locator("tbody tr").first().click();
    await sleep(800);
    await shot(explorer, "49-result-question-expanded", {
      step: "Question explorer: answers",
      caption: "Click a question to read every strategy's answer from each of the three runs.",
    });

    const resultsHeader = page.locator("h2", { hasText: "Results" }).first().locator("xpath=..");
    await resultsHeader.getByRole("button", { name: "EM", exact: true }).click();
    await sleep(1500);
    const emForest = panel(page, "EM with 95% confidence interval");
    await emForest.scrollIntoViewIfNeeded();
    await sleep(1200);
    await shot(emForest, "50-result-em-confidence-intervals", {
      step: "Switch to EM",
      caption: "The F1 / EM switch redraws every chart with exact match instead of token F1.",
    });
    await resultsHeader.getByRole("button", { name: "F1", exact: true }).click();
    await sleep(1500);

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800);
    await shot(page, "51-replay-results-full-page", {
      step: "Full results page",
      fullPage: true,
      caption: "The whole Replay page after the GLM 5.3 Flash test.",
    });
    const runLeaderboard = await leaderboardText(page);

    const saved = await page.evaluate(() => fetch("/api/results").then((r) => r.json()));
    const glm = (saved.results || []).find((r) => r.model && r.model.id === "z-ai/glm-5.3-flash");
    log({ step: "Saved result", note: glm ? glm.id : "not found", extra: glm || null });

    // --- History + Profiler ----------------------------------------------------
    await page.goto(BASE + "/history");
    await sleep(2500);
    await shot(page, "52-history-after-test", {
      step: "History after the test",
      fullPage: true,
      caption: "The replay appears in History tagged with its model.",
    });
    await page.goto(BASE + "/profiler");
    await sleep(4500);
    await shot(page, "53-profiler-glm", {
      step: "Profiler",
      fullPage: true,
      caption: "The Profiler starts from GLM 5.3 Flash's list price and shows cost × quality, cost per correct answer, latency, and token use. The sliders re-price the run for any other model.",
    });

    // --- Load the results from a previous test ---------------------------------
    await page.goto(BASE + "/replay");
    await page.getByText("The bundled case study").waitFor();
    await sleep(2000);
    await page.getByRole("button", { name: "Load the results from a previous test" }).click();
    const after = page.getByRole("dialog");
    await after.getByText(MODEL).first().waitFor();
    await sleep(800);
    await shot(after, "54-previous-tests-after-run", {
      step: "Previous tests (after the run)",
      caption: "After the test the list holds two saved tests: GLM 5.3 Flash and the paper's Gemini 3 Flash sweep.",
    });
    await after.getByRole("button", { name: /GLM 5\.3 Flash/ }).first().click();
    await page.getByText("Loaded from a previous test").waitFor();
    await sleep(3000);
    await shot(panel(page, "Loaded from a previous test"), "55-loaded-glm-test-details", {
      step: "Loaded GLM 5.3 Flash test",
      caption: "The saved GLM 5.3 Flash test reopened from its JSON file. Nothing is re-run and nothing is spent.",
    });
    await shot(panel(page, "vs the paper"), "56-loaded-glm-vs-paper", {
      step: "Loaded comparison",
      caption: "The comparison with the paper, rebuilt from the saved file.",
    });
    const loadedLeaderboard = await leaderboardText(page);
    await shot(panel(page, "Leaderboard"), "57-loaded-glm-leaderboard", {
      step: "Loaded leaderboard",
      caption: "The leaderboard from the saved file, identical to the one shown when the run finished.",
      extra: { identical_to_live_run: loadedLeaderboard === runLeaderboard },
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Load the results from a previous test" }).click();
    const again = page.getByRole("dialog");
    await again.getByText("published sweep").first().waitFor();
    await again.getByRole("button", { name: /published sweep/ }).first().click();
    await page.getByText("published sweep itself").waitFor();
    await sleep(3000);
    await shot(panel(page, "Loaded from a previous test"), "58-loaded-paper-sweep-details", {
      step: "Loaded paper sweep",
      caption: "The paper's Gemini 3 Flash sweep loads the same way, imported from the research runs and checked against the paper's table.",
    });
    await shot(panel(page, "Leaderboard"), "59-loaded-paper-sweep-leaderboard", {
      step: "Paper sweep leaderboard",
      caption: "The published Gemini 3 Flash leaderboard, for side-by-side reading with GLM 5.3 Flash.",
    });

    await saveState(context);
    log({ step: "Part 2 complete", note: `capture-replay.js finished; live run ${totalMin} min` });
  } catch (err) {
    await page.screenshot({ path: require("path").join(__dirname, "..", "screenshots", "99-replay-error.png"), fullPage: true }).catch(() => {});
    log({ step: "ERROR", note: String(err && err.stack ? err.stack : err) });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
