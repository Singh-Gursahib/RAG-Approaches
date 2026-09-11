// Focused captures for the Word guide (no model calls): each strategy simulation card, and the
// key panels of Compare, Evaluate, Recommend, Profiler, and History. Reuses the browser state
// saved by the earlier captures, so Compare, History, and Profiler show the GLM 5.3 Flash runs.
const { BASE, launch, shot, panel, sleep, dismissTour, log } = require("./common");

(async () => {
  const { browser, page } = await launch();
  try {
    // --- Strategy simulations: just the animation card --------------------------------
    await page.goto(BASE + "/");
    await dismissTour(page);
    const sims = page.locator("section", { hasText: "Seven ways to find an answer" }).first();
    await sims.scrollIntoViewIfNeeded();
    const auto = sims.getByRole("button", { name: /Auto-playing/ });
    if (await auto.isVisible().catch(() => false)) await auto.click();
    const rail = sims.locator("button[aria-current]");
    const stage = sims.locator("div.shadow-card").first();
    for (let i = 0; i < (await rail.count()); i++) {
      const btn = rail.nth(i);
      const label = (await btn.innerText()).trim();
      await btn.click();
      await sleep(4200);
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await shot(stage, `g-sim-${slug}`, { step: `Simulation card: ${label}` });
    }

    // --- Compare -----------------------------------------------------------------------
    await page.goto(BASE + "/compare");
    await page.getByText("Answers, side by side").waitFor();
    await sleep(3000);
    await shot(panel(page, "Answers, side by side"), "g-compare-answers", { step: "Compare: answers" });
    await shot(panel(page, "What stands out"), "g-compare-insights", { step: "Compare: insights" });
    await shot(panel(page, "Cost per strategy").locator("xpath=.."), "g-compare-cost-latency", { step: "Compare: cost and latency" });
    await shot(panel(page, "Pipeline diff"), "g-compare-pipeline-diff", { step: "Compare: pipeline diff" });

    // --- Evaluate ----------------------------------------------------------------------
    await page.goto(BASE + "/evaluate");
    await sleep(1500);
    await page.getByRole("button", { name: "Load sample", exact: true }).click();
    await sleep(2500);
    await page.getByRole("button", { name: "Load sample set" }).click();
    await sleep(1500);
    await shot(panel(page, "Question set with gold answers", "h2"), "g-eval-questions", { step: "Evaluate: question set" });

    // --- Recommend ---------------------------------------------------------------------
    await page.goto(BASE + "/recommend");
    await sleep(1500);
    await panel(page, "1 · Pick your use case").locator("button").first().click();
    await sleep(800);
    const groups = panel(page, "2 · A few questions").locator("div.flex.flex-wrap.gap-2");
    for (let i = 0; i < (await groups.count()); i++) {
      await groups.nth(i).locator("button").first().click();
      await sleep(250);
    }
    await sleep(1500);
    await shot(panel(page, "2 · A few questions"), "g-recommend-questions", { step: "Recommend: questions" });
    await shot(panel(page, "Your recommendation"), "g-recommend-result", { step: "Recommend: result" });

    // --- Profiler ----------------------------------------------------------------------
    await page.goto(BASE + "/profiler");
    await sleep(4000);
    await shot(panel(page, "Model price tier"), "g-profiler-price", { step: "Profiler: price tier" });
    await shot(panel(page, "Cost × quality"), "g-profiler-pareto", { step: "Profiler: cost and quality" });
    await shot(panel(page, "Total cost (re-priced)").locator("xpath=.."), "g-profiler-costs", { step: "Profiler: costs" });

    // --- History -----------------------------------------------------------------------
    await page.goto(BASE + "/history");
    await sleep(2500);
    await shot(page, "g-history", { step: "History" });

    log({ step: "Guide extras complete", note: "capture-guide-extras.js finished" });
  } catch (err) {
    log({ step: "ERROR", note: String(err && err.stack ? err.stack : err) });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
